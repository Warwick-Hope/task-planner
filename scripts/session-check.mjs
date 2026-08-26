#!/usr/bin/env node
/**
 * session-check — what else is running, before you touch anything.
 *
 * The failure this exists to prevent, measured on 26 Aug 2026: two Claude Code
 * sessions worked in `C:\Dev\task-planner` at the same time. One read PLAN.md,
 * spent forty minutes on a design, and went to write it back. In between, the
 * other session had committed twice, opened PR #18 and rewritten the same
 * section. Nothing warned either of them, because nothing was looking.
 *
 * Git handles concurrent work — but its unit of isolation is a **branch with its
 * own working tree**, not a branch alone. Two sessions sharing one directory are
 * not two contributors; they are two hands on one keyboard, and GitHub never
 * sees the conflict because it never gets that far.
 *
 * So this prints the things that decide whether it is safe to start:
 *
 *   - which working tree you are in, and whether it is the shared checkout
 *   - every other working tree, its branch, and whether it has uncommitted work
 *   - how far behind origin/main you are
 *   - open pull requests
 *   - the claim board, WORKSTREAMS.md
 *
 * Run:      npm run session
 * Silent:   node scripts/session-check.mjs --quiet   (findings only, no listing)
 *
 * It never exits non-zero. It is a briefing, not a gate — the gates are the
 * `pre-push` hook and `npm run check:docs`.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const QUIET = process.argv.includes('--quiet')

// ── running git without letting a failure end the run ────────────────────────
//
// Every call here is allowed to fail: no network, no `gh`, a fresh clone with no
// upstream. A briefing that crashes is worse than one with a gap in it, so each
// helper returns null and the caller renders a dash.

function git(...args) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

function gh(...args) {
  try {
    return execFileSync('gh', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 8000,
    }).trim()
  } catch {
    return null
  }
}

const root = git('rev-parse', '--show-toplevel')
if (!root) {
  console.error('Not a git repository — nothing to check.')
  process.exit(0)
}

// ── where am I ───────────────────────────────────────────────────────────────
//
// In a linked worktree `--git-dir` is <main>/.git/worktrees/<name> while
// `--git-common-dir` stays <main>/.git. In the shared checkout they are the same
// path. That difference is the whole test.

const gitDir = git('rev-parse', '--absolute-git-dir')
const commonDir = git('rev-parse', '--path-format=absolute', '--git-common-dir')
const isWorktree = Boolean(gitDir && commonDir && gitDir !== commonDir)

const branch = git('rev-parse', '--abbrev-ref', 'HEAD')
const dirty = (git('status', '--porcelain') ?? '').split('\n').filter(Boolean).length

// ── every working tree on this machine ───────────────────────────────────────
//
// `git worktree list --porcelain` gives path/HEAD/branch records separated by a
// blank line. Dirtiness is not in that output, so each tree is asked separately —
// it is the field that actually matters, because an uncommitted file in another
// tree is work in flight that no branch or PR reveals.

function worktrees() {
  const raw = git('worktree', 'list', '--porcelain')
  if (!raw) return []

  return raw
    .split(/\n\s*\n/)
    .map((block) => {
      const path = block.match(/^worktree (.+)$/m)?.[1]
      if (!path) return null
      const ref = block.match(/^branch (.+)$/m)?.[1]
      const head = block.match(/^HEAD ([0-9a-f]+)$/m)?.[1]
      let changes = null
      try {
        changes = execFileSync('git', ['-C', path, 'status', '--porcelain'], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore'],
        })
          .split('\n')
          .filter(Boolean).length
      } catch {
        // A worktree whose directory has been deleted but not pruned.
      }
      return {
        path: path.replaceAll('\\', '/'),
        branch: ref ? ref.replace('refs/heads/', '') : `detached @ ${head?.slice(0, 7) ?? '?'}`,
        changes,
        isMine: path.replaceAll('\\', '/') === root.replaceAll('\\', '/'),
      }
    })
    .filter(Boolean)
}

// ── the claim board ──────────────────────────────────────────────────────────
//
// Rows are read out of the table above the first `##`, which is the same slice
// check-docs.mjs validates. Parsing is deliberately loose: this prints what is
// there so a human can judge overlap, and the guard is what enforces the format.

function claims() {
  const file = join(root, 'WORKSTREAMS.md')
  if (!existsSync(file)) return null

  const text = readFileSync(file, 'utf8')
  const table = text.split(/^## /m)[0]

  return [...table.matchAll(/^\|(.+)\|\s*$/gm)]
    .map((m) => m[1].split('|').map((c) => c.trim()))
    .filter((cells) => cells.some((c) => /\d{4}-\d{2}-\d{2}/.test(c) || /`[a-z]+\//.test(c)))
    .map((cells) => ({
      when: cells.find((c) => /\d{4}-\d{2}-\d{2}/.test(c)) ?? '',
      branch: cells.find((c) => /`[a-z]+\//.test(c))?.replace(/`/g, '') ?? '',
      what: cells.slice(2).join(' · '),
    }))
}

// ── gather ───────────────────────────────────────────────────────────────────

git('fetch', 'origin', '--quiet')

const trees = worktrees()
const others = trees.filter((t) => !t.isMine)
const board = claims()

const behind = git('rev-list', '--count', 'HEAD..origin/main')
const ahead = git('rev-list', '--count', 'origin/main..HEAD')
const mainSha = git('rev-parse', '--short', 'origin/main')

const prJson = gh('pr', 'list', '--state', 'open', '--json', 'number,title,headRefName')
let prs = null
try {
  prs = prJson ? JSON.parse(prJson) : null
} catch {
  prs = null
}

// ── findings ─────────────────────────────────────────────────────────────────

const findings = []

if (!isWorktree && others.length > 0) {
  findings.push([
    `You are in the SHARED checkout and ${others.length} other working tree${others.length > 1 ? 's are' : ' is'} live.`,
    'Take your own before editing anything:',
    `  git worktree add C:/Dev/.worktrees/task-planner/<slug> -b <type>/<slug> origin/main`,
    '  then copy .env.local in — it is untracked, and dev and the CLI both need it.',
  ])
}

if (!isWorktree && others.length === 0 && branch !== 'main') {
  findings.push([
    `The shared checkout is on \`${branch}\`, not \`main\`.`,
    'Fine if you are the only session. If a second one starts, it inherits this branch.',
  ])
}

if (behind && Number(behind) > 0) {
  findings.push([
    `${behind} commit${behind === '1' ? '' : 's'} behind origin/main.`,
    '  git pull --rebase origin main',
  ])
}

for (const t of others) {
  if (t.changes > 0) {
    findings.push([
      `\`${t.branch}\` has ${t.changes} uncommitted file${t.changes === 1 ? '' : 's'} in ${t.path}.`,
      'Another session is probably mid-edit. Do not touch the documents it owns.',
    ])
  }
}

if (board === null) {
  findings.push([
    'No WORKSTREAMS.md, so there is no claim board.',
    'Two or more sessions at once is the trigger for creating one.',
  ])
}

const today = new Date().toISOString().slice(0, 10)
for (const c of board ?? []) {
  if (c.branch && c.branch !== branch) {
    findings.push([
      `\`${c.branch}\` claims: ${c.what}`,
      c.when === today
        ? 'Claimed today. If your task overlaps, narrow it or pick something else.'
        : `Claimed ${c.when}. Check it is still live before working around it.`,
    ])
  }
}

// ── render ───────────────────────────────────────────────────────────────────

// Colour only for a terminal. As a SessionStart hook this output is injected
// into the model's context, where escape codes are noise rather than emphasis.
const COLOUR = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR

const dim = (s) => (COLOUR ? `\x1b[2m${s}\x1b[0m` : s)
const bold = (s) => (COLOUR ? `\x1b[1m${s}\x1b[0m` : s)
const warn = (s) => (COLOUR ? `\x1b[33m${s}\x1b[0m` : s)

if (!QUIET) {
  console.log('')
  console.log(bold('  Clarity — session check') + dim(`   ${today}`))
  console.log('')
  console.log(
    `  ${'Working tree'.padEnd(14)} ${root.replaceAll('\\', '/')} ${dim(isWorktree ? '(worktree)' : '(shared checkout)')}`
  )
  console.log(`  ${'Branch'.padEnd(14)} ${branch}${dirty ? dim(`  — ${dirty} uncommitted`) : ''}`)
  console.log(
    `  ${'origin/main'.padEnd(14)} ${mainSha ?? '?'}` +
      dim(`  — ${behind ?? '?'} behind, ${ahead ?? '?'} ahead`)
  )

  if (others.length) {
    console.log('')
    console.log(`  ${bold('Other working trees')}`)
    for (const t of others) {
      const state =
        t.changes === null ? 'gone?' : t.changes > 0 ? `${t.changes} uncommitted` : 'clean'
      console.log(`    ${t.branch.padEnd(34)} ${dim(state)}`)
      console.log(`    ${dim(t.path)}`)
    }
  }

  if (prs?.length) {
    console.log('')
    console.log(`  ${bold('Open pull requests')}`)
    for (const p of prs) {
      console.log(`    #${String(p.number).padEnd(4)} ${p.title}`)
      console.log(`         ${dim(p.headRefName)}`)
    }
  } else if (prs?.length === 0) {
    console.log('')
    console.log(`  ${bold('Open pull requests')}   ${dim('none')}`)
  }

  if (board?.length) {
    console.log('')
    console.log(`  ${bold('Claimed')} ${dim('(WORKSTREAMS.md)')}`)
    for (const c of board) {
      console.log(`    ${c.when}  ${c.branch.padEnd(32)} ${dim(c.what)}`)
    }
  } else if (board?.length === 0) {
    console.log('')
    console.log(`  ${bold('Claimed')}   ${dim('nothing')}`)
  }

  console.log('')
}

if (findings.length) {
  for (const [head, ...rest] of findings) {
    console.log(`  ${warn('!')} ${head}`)
    for (const line of rest) console.log(`    ${dim(line)}`)
    console.log('')
  }
} else if (!QUIET) {
  console.log(dim('  Nothing in the way.'))
  console.log('')
}
