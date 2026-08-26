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
 * Two independent knobs, because the four outputs need three different
 * combinations of them:
 *
 * `bleed` — the background is a full-bleed square rather than the `rx="112"`
 * rounded rect. A maskable icon needs it because the launcher crops the icon to
 * its own shape, and iOS needs it because it applies its own rounding to the
 * square it is given: hand iOS the rounded artwork and the corners outside the
 * radius show as slivers of whatever is behind them.
 *
 * `transparent` — the corners outside the rounded rect become alpha instead of
 * the page's white background. Only the `purpose: "any"` icons want this: they
 * are composited onto a browser tab or a taskbar, and baked white showed as four
 * white wedges on a dark Windows taskbar. The bleeding icons have no exposed
 * corners to make transparent, and iOS composites transparency to *black*, so
 * an alpha channel there would trade white slivers for black ones.
 *
 * `markScale` — the mark is shrunk only for the maskable icon, so it sits inside
 * the middle 80% that survives a launcher cropping it to a circle. iOS does not
 * crop, so `apple-touch-icon.png` keeps the mark at full size.
 */
const OUTPUTS = [
  { file: 'icon-192.png', size: 192, bleed: false, transparent: true, markScale: 1 },
  { file: 'icon-512.png', size: 512, bleed: false, transparent: true, markScale: 1 },
  { file: 'icon-maskable-512.png', size: 512, bleed: true, transparent: false, markScale: 0.62 },
  // iOS ignores `purpose`, so this is the square artwork at Apple's touch-icon
  // size — full bleed, opaque, and left for iOS to round.
  { file: 'apple-touch-icon.png', size: 180, bleed: true, transparent: false, markScale: 1 },
]

const source = await readFile(path.join(PUBLIC_DIR, 'icon.svg'), 'utf8')
// Strip the licence-style comment so it cannot confuse the inline parse.
const svg = source.slice(source.indexOf('<svg'))

const browser = await chromium.launch()

for (const { file, size, bleed, transparent, markScale } of OUTPUTS) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })

  // The mark is drawn on a 512 grid centred on (256, 256), so scaling it about
  // that point is all the safe zone needs.
  let markup = bleed ? svg.replace(/rx="112"/, 'rx="0"') : svg
  if (markScale !== 1) {
    markup = markup.replace(
      /<g fill="#ffffff">/,
      `<g fill="#ffffff" transform="translate(256 256) scale(${markScale}) translate(-256 -256)">`
    )
  }

  await page.setContent(
    `<!doctype html><style>html,body{margin:0;padding:0}svg{display:block;width:${size}px;height:${size}px}</style>${markup}`
  )
  const png = await page.locator('svg').screenshot({ omitBackground: transparent })
  await writeFile(path.join(PUBLIC_DIR, file), png)
  await page.close()
  console.log(
    `${file.padEnd(24)} ${size}x${size}  ${bleed ? 'full bleed' : 'rounded   '}  ` +
      `${transparent ? 'alpha ' : 'opaque'}  mark ${markScale === 1 ? 'full' : `${markScale * 100}%`}`
  )
}

await browser.close()
