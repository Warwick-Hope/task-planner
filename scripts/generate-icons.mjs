/**
 * Rasterises public/icon.svg into the PNGs the manifest and iOS need.
 *
 * Chrome will not treat the app as installable without a PNG of at least 192px,
 * so an SVG in the manifest is not enough. Rather than add an image library for
 * one job, this drives the Chromium that Playwright already installs — the same
 * renderer the icons will be displayed in.
 *
 * Run with `npm run build:icons`. Not part of the build: the output is committed,
 * and regenerating it on every deploy would mean a browser download in CI for
 * files that change perhaps twice a year.
 */
import { chromium } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const PUBLIC_DIR = path.join(process.cwd(), 'public')

/**
 * A maskable icon is cropped to whatever shape the launcher likes, so the mark
 * has to sit inside the middle 80% and the background has to bleed to the edge.
 * The "any" icons keep the rounded square, which is what shows in a browser tab
 * and on the install prompt.
 */
const OUTPUTS = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  // iOS applies its own rounding and does not understand `purpose`, so this is
  // the square artwork at Apple's touch-icon size.
  { file: 'apple-touch-icon.png', size: 180, maskable: false },
]

const source = await readFile(path.join(PUBLIC_DIR, 'icon.svg'), 'utf8')
// Strip the licence-style comment so it cannot confuse the inline parse.
const svg = source.slice(source.indexOf('<svg'))

const browser = await chromium.launch()

for (const { file, size, maskable } of OUTPUTS) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })

  // Maskable: square corners, mark scaled to 62% about the centre — comfortably
  // inside the 80% safe zone once a launcher crops it to a circle.
  const markup = maskable
    ? svg
        .replace(/rx="112"/, 'rx="0"')
        .replace(/<g fill="#ffffff">/, '<g fill="#ffffff" transform="translate(256 256) scale(0.62) translate(-256 -256)">')
    : svg

  await page.setContent(
    `<!doctype html><style>html,body{margin:0;padding:0}svg{display:block;width:${size}px;height:${size}px}</style>${markup}`
  )
  const png = await page.locator('svg').screenshot({ omitBackground: false })
  await writeFile(path.join(PUBLIC_DIR, file), png)
  await page.close()
  console.log(`${file.padEnd(24)} ${size}x${size}${maskable ? ' (maskable)' : ''}`)
}

await browser.close()
