#!/usr/bin/env node
/**
 * check-docs — the guard that keeps a project's documents honest.
 *
 * Portable version of System_Data_Sync's scripts/check-docs.mjs. Every check
 * below exists because it actually happened in that project, and each one
 * degrades to a skip when the input it needs is absent, so the same file works
 * in a Node monorepo, a folder of PowerShell scripts, or a folder of documents
 * with no code at all.
 *
 *   1. stale-command        a command named in a document that does not exist
 *   2. broken-doc-link      a document link or reference pointing at nothing
 *   3. missing-from-map     a document nobody's router mentions, so nobody reads
 *   4. duplicate-kb-entry   two knowledge entries with the same number
 *   5. kb-index-mismatch    the index and the entries disagree
 *   6. dangling-kb-ref      "KB.md #N" where N does not exist
 *   7. revived-retired-fact a withdrawn figure restated as if it were live
 *   8. stale-claim          a work claim whose branch is gone or whose date is old
 *   9. stale-status         the status section is older than the work it describes
 *
 * Run:       node scripts/check-docs.mjs
 * Softly:    node scripts/check-docs.mjs --warn-only    (nothing fails the run)
 * Elsewhere: DOCCHECK_ROOT=/path/to/project node check-docs.mjs
 *
 * Configure with an optional .doccheck.json at the project root — see guard.md
 * in the project-docs skill for the full list of keys.
 *
 * This is a linter for prose, so it is deliberately conservative: it reads
 * commands out of code spans and fenced blocks, never out of sentences, because
 * "pnpm blocks esbuild's install script" is a sentence about pnpm, not a command.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';

const run = promisify(execFile);

// ── where are we ─────────────────────────────────────────────────────────────
//
// Dropped in as <project>/scripts/check-docs.mjs, the project root is one level
// up. Run from anywhere else, the working directory is the project.

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const root = process.env.DOCCHECK_ROOT
  ? resolve(process.env.DOCCHECK_ROOT)
  : /[\\/]scripts[\\/]?$/.test(scriptDir)
    ? resolve(scriptDir, '..')
    : process.cwd();
const rel = (p) => relative(root, p).replaceAll('\\', '/');

const argv = process.argv.slice(2);
const WARN_ONLY = argv.includes('--warn-only');

// ── configuration ────────────────────────────────────────────────────────────

const DEFAULTS = {
  kbFile: 'KB.md',
  statusFile: 'PLAN.md',
  mapFile: 'CLAUDE.md',
  claimFile: 'WORKSTREAMS.md',
  staleStatusDays: 4,
  staleClaimDays: 2,
  requireKbIndexFrom: 15,
  skipDirs: [],
  externalDocs: [],
  mapExempt: ['README.md', 'CHANGELOG.md', 'LICENSE.md', 'SECURITY.md', 'AGENTS.md'],
  disable: [],
};

let userCfg = {};
try {
  userCfg = JSON.parse(await readFile(join(root, '.doccheck.json'), 'utf8'));
} catch {
  // No config is the normal case.
}
const CFG = { ...DEFAULTS, ...userCfg };
const on = (name) => !CFG.disable.includes(name);

// ── findings ─────────────────────────────────────────────────────────────────

const problems = [];
const notes = [];
const fail = (check, file, line, detail, fix) =>
  problems.push({ sev: 'fail', check, file, line, detail, fix });
const warn = (check, file, line, detail, fix) =>
  problems.push({ sev: 'warn', check, file, line, detail, fix });

// ── read the project ─────────────────────────────────────────────────────────

const SKIP = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', '.turbo',
  'coverage', 'venv', '.venv', 'env', '__pycache__', '.worktrees', 'specs',
  'archive', 'archives', 'backups', 'backup', '.vercel', '.vscode', '.idea',
  'bin', 'obj', 'scratch', 'tmp', '.pytest_cache', '.mypy_cache',
  // A worktree is a complete copy of every source file, so walking one means
  // reading every document twice — and pulling its package.json into the
  // allowlist, which lets a dead command resolve against a copy of the manifest.
  // Measured on CPQ: four nested worktrees turned one real finding into twenty.
  'worktrees', '.worktrees',
  ...CFG.skipDirs,
]);
const KEEP_DOT_DIRS = new Set(['.github', '.githooks']);

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    if (entry.isDirectory() && entry.name.startsWith('.') && !KEEP_DOT_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

const allFiles = [];
for await (const f of walk(root)) allFiles.push(f);

const lower = (s) => s.toLowerCase();
const fileSet = new Set(allFiles.map((f) => lower(rel(f))));
const basenames = new Set(allFiles.map((f) => lower(rel(f)).split('/').pop()));
const docFiles = allFiles.filter((f) => lower(f).endsWith('.md'));

const CODE_EXT = [
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.ps1', '.psm1', '.py', '.sql',
  '.sh', '.cs', '.yml', '.yaml', '.tf', '.go', '.rb', '.java', '.kt', '.php',
];
const codeFiles = allFiles.filter((f) => CODE_EXT.some((e) => lower(f).endsWith(e)));

/** Contents of everything worth scanning for references. Large files skipped. */
const read = new Map();
for (const f of [...docFiles, ...codeFiles]) {
  try {
    const info = await stat(f);
    if (info.size > 800_000) continue;
    read.set(f, await readFile(f, 'utf8'));
  } catch {
    // Unreadable is not this script's business.
  }
}

const doc = (name) => {
  const p = join(root, name);
  return read.has(p) ? { path: p, text: read.get(p) } : null;
};

if (docFiles.length === 0) {
  console.log('check-docs — no documents found. Nothing to check.');
  process.exit(0);
}

// ── helpers ──────────────────────────────────────────────────────────────────

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The strings in a document that are meant to be executed rather than read.
 * In prose only a code span counts; inside a fence the whole line does.
 */
function commandStrings(lines) {
  const out = [];
  let inFence = false;
  lines.forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }
    if (inFence) {
      out.push({ text: line, line: i });
      return;
    }
    for (const m of line.matchAll(/`([^`]+)`/g)) out.push({ text: m[1], line: i });
  });
  return out;
}

// ── 1. every command named in a document must exist ──────────────────────────

if (on('stale-command')) {
  const scriptNames = new Set();
  for (const f of allFiles.filter((p) => lower(p).endsWith('package.json'))) {
    try {
      const parsed = JSON.parse(await readFile(f, 'utf8'));
      for (const name of Object.keys(parsed.scripts ?? {})) scriptNames.add(name);
    } catch {
      // A malformed manifest is not this check's business.
    }
  }

  // Runner subcommands are always real, so never flag them as missing scripts.
  const BUILTINS = new Set([
    'install', 'i', 'ci', 'add', 'remove', 'rm', 'update', 'up', 'why', 'list',
    'ls', 'run', 'exec', 'dlx', 'npx', 'store', 'outdated', 'link', 'unlink',
    'prune', 'rebuild', 'audit', 'publish', 'pack', 'init', 'setup', 'env',
    'config', 'test', 'start', 'version', 'login', 'logout', 'create', 'dedupe',
    'approve-builds', 'deploy', 'help',
  ]);

  // A document may legitimately name a command that is gone — to say it was
  // renamed, or to cite the mistake that motivated a check. The window is the
  // matched line plus the one above it, and the vocabulary is unambiguous:
  // widen either and a genuinely dead command slips through, because in dense
  // prose some neighbouring line always contains a word like "removed".
  const EXCUSED = /renamed|no longer exists?|does not exist|no such (?:script|file|command)|would have caught|corrected to|used to be|deprecated/i;

  const PLACEHOLDER = /[<>${}*|]/;

  for (const file of docFiles) {
    const lines = read.get(file)?.split(/\r?\n/);
    if (!lines) continue;

    for (const { text, line } of commandStrings(lines)) {
      const context = lines.slice(Math.max(0, line - 1), line + 1).join('\n');
      if (EXCUSED.test(context)) continue;

      // a) a package script: pnpm <name>, npm run <name>, yarn <name>
      if (scriptNames.size) {
        for (const m of text.matchAll(/(?:^|[\s;&|(])(?:pnpm|npm|yarn|bun)\s+(?:run\s+)?([a-z][a-z0-9:._-]*)/g)) {
          const name = m[1];
          if (BUILTINS.has(name) || scriptNames.has(name)) continue;
          if (name.endsWith(':')) continue; // `npm run sync:*` written as a family, not a script
          fail(
            'stale-command',
            rel(file),
            line + 1,
            `\`${m[0].trim()}\` names a script that no package.json defines`,
            'add the script, correct the document, or say on the same line that it no longer exists',
          );
        }
      }

      // b) a file being executed: node x.mjs, pwsh x.ps1, ./x.sh, python x.py
      //
      // A warning, not a failure. A package script either exists or does not; a
      // path in prose is often illustrative — `pwsh script.ps1` teaching a rule,
      // or a file under a folder this walk deliberately skips.
      const paths = [
        ...text.matchAll(/(?:^|[\s;&|(])(?:node|tsx|ts-node|deno|pwsh|powershell|python3?|py|bash|sh)\s+(?:-File\s+|-f\s+)?["']?([\w.][\w./\\-]*\.(?:mjs|cjs|js|ts|ps1|psm1|py|sh))["']?/gi),
        ...text.matchAll(/(?:^|\s)(\.[\\/][\w./\\-]*\.(?:ps1|sh|mjs|cjs|js|py))/g),
      ];
      for (const m of paths) {
        let p = m[1];
        if (PLACEHOLDER.test(p)) continue;
        if (/^[a-zA-Z]:/.test(p) || p.startsWith('/') || p.startsWith('\\')) continue; // absolute — may be elsewhere
        p = p.replace(/^\.[\\/]/, '').replaceAll('\\', '/');
        if (SKIP.has(p.split('/')[0])) continue; // lives somewhere this walk does not go
        if (fileSet.has(lower(p))) continue;
        // Tolerate a path written relative to the document's own folder.
        if (fileSet.has(lower(rel(join(dirname(file), p))))) continue;
        // A bare filename in a runbook is run after a `cd`, so match on the
        // basename anywhere in the project before calling it missing.
        const base = lower(p.split('/').pop());
        if (!p.includes('/') && basenames.has(base)) continue;
        warn(
          'stale-command',
          rel(file),
          line + 1,
          `runs \`${p}\`, which is not in the project`,
          'correct the path, or say on the same line that the file no longer exists',
        );
      }
    }
  }
}

// ── 2. every document reference must resolve ─────────────────────────────────
//
// A broken explicit link fails; a broken bare mention only warns, because a
// document legitimately names files that live outside the project.

if (on('broken-doc-link')) {
  const external = new Set(CFG.externalDocs.map(lower));
  const resolves = (from, target) => {
    // %20 and friends: a link written by a tool, against a filename with spaces.
    let t = target.replaceAll('\\', '/');
    try {
      t = decodeURIComponent(t);
    } catch {
      // Leave a malformed escape alone.
    }
    if ([rel(join(dirname(from), t)), t].some((c) => fileSet.has(lower(c)))) return true;
    // A bare name with no folder in it — cited the way these documents cite each
    // other, and satisfied by the file existing anywhere in the project.
    return !t.includes('/') && basenames.has(lower(t));
  };

  for (const file of docFiles) {
    const lines = read.get(file)?.split(/\r?\n/);
    if (!lines) continue;
    lines.forEach((line, i) => {
      // Explicit markdown links to a local document or script.
      for (const m of line.matchAll(/\]\(([^)#\s]+\.(?:md|mjs|js|ts|ps1|py|sql|sh|csv|json))(?:#[^)]*)?\)/gi)) {
        const target = m[1];
        if (/^(?:https?:|mailto:|[a-zA-Z]:)/.test(target) || target.startsWith('/')) continue;
        if (external.has(lower(target))) continue;
        if (resolves(file, target)) continue;
        fail('broken-doc-link', rel(file), i + 1, `links to \`${target}\`, which does not exist`, 'correct the path, or remove the link');
      }
      // A bare, backticked document name — the way these projects cite each other.
      for (const m of line.matchAll(/`([A-Za-z0-9_.-]+\.md)`/g)) {
        const target = m[1];
        if (external.has(lower(target))) continue;
        if (resolves(file, target)) continue;
        warn(
          'broken-doc-link',
          rel(file),
          i + 1,
          `mentions \`${target}\`, which is not in this project`,
          'if it lives elsewhere on purpose, add it to externalDocs in .doccheck.json; otherwise correct the name',
        );
      }
    });
  }
}

// ── 3. every document must be reachable from the router ──────────────────────
//
// A document nobody's map mentions is a document nobody reads. This is how a
// standing prohibition ended up invisible to the sessions it was written for.

if (on('missing-from-map') && doc(CFG.mapFile)) {
  const exempt = new Set(CFG.mapExempt.map(lower));
  const haystack = [doc(CFG.mapFile), doc(CFG.statusFile)]
    .filter(Boolean)
    .map((d) => d.text)
    .join('\n');

  for (const file of docFiles) {
    const r = rel(file);
    // Root documents only. These are the ones a session reads on arrival, so
    // these are the ones the router owes an entry. Notes filed inside a data or
    // working folder are not the router's job.
    if (r.includes('/')) continue;
    const name = r;
    if (exempt.has(lower(name)) || lower(name) === lower(CFG.mapFile)) continue;
    if (haystack.includes(name)) continue;
    fail(
      'missing-from-map',
      r,
      0,
      `is not mentioned in ${CFG.mapFile}${doc(CFG.statusFile) ? ` or ${CFG.statusFile}` : ''}`,
      'add a row to the document table saying what it holds — or delete the document',
    );
  }
}

// ── 4, 5, 6. the knowledge base: numbering, index, references ────────────────

const kb = doc(CFG.kbFile);
const kbEntries = new Map(); // number -> line
// An entry heading, in any of the forms these projects actually use: `### 7. Title`,
// `## 7 — Title`, `### #7: Title`. The number cap keeps a heading that opens with a
// year — `## 2026 — review` — from registering as a phantom entry.
const ENTRY_HEADING = /^#{2,4}\s*#?(\d{1,3})\s*[.):—–-]\s/;
if (kb) {
  const lines = kb.text.split(/\r?\n/);
  const found = [];
  lines.forEach((line, i) => {
    const m = line.match(ENTRY_HEADING);
    if (m) found.push({ num: Number(m[1]), line: i + 1 });
  });

  for (const e of found) {
    if (kbEntries.has(e.num)) {
      if (on('duplicate-kb-entry')) {
        fail(
          'duplicate-kb-entry',
          CFG.kbFile,
          e.line,
          `entry #${e.num} is defined twice (also at line ${kbEntries.get(e.num)})`,
          'renumber the later one to one past the highest in the index, and update every reference to it',
        );
      }
    } else {
      kbEntries.set(e.num, e.line);
    }
  }

  if (on('kb-index-mismatch')) {
    // Scanned only ABOVE the first entry heading. An index row and an ordinary
    // table row are indistinguishable by shape, so an entry that tabulates
    // counts otherwise registers its own row numbers as index entries — and the
    // check then passes, or fails, on a coincidence.
    const firstEntry = lines.findIndex((l) => ENTRY_HEADING.test(l));
    const indexText = (firstEntry === -1 ? lines : lines.slice(0, firstEntry)).join('\n');
    const indexNums = new Set(
      [...indexText.matchAll(/^\|\s*#?(\d+)\s*\|/gm)].map((m) => Number(m[1])),
    );
    // An index table that exists but holds no rows is not the same as no index:
    // the contract has been set up and then not kept, so hold it to the contract.
    const hasIndexTable = /^\|\s*#\s*\|/m.test(indexText);

    if (indexNums.size === 0 && !hasIndexTable) {
      if (kbEntries.size >= CFG.requireKbIndexFrom) {
        fail(
          'kb-index-mismatch',
          CFG.kbFile,
          1,
          `${kbEntries.size} entries and no index`,
          'add an index table above the entries — number, title, section, status — so a session reads one section instead of the file',
        );
      } else if (kbEntries.size > 0) {
        notes.push(`${CFG.kbFile} has no index yet. Add one before it reaches ${CFG.requireKbIndexFrom} entries.`);
      }
    } else {
      for (const [num, line] of kbEntries) {
        if (!indexNums.has(num)) {
          fail('kb-index-mismatch', CFG.kbFile, line, `entry #${num} has no index row`, 'add its row to the end of the index');
        }
      }
      for (const n of indexNums) {
        if (!kbEntries.has(n)) {
          fail('kb-index-mismatch', CFG.kbFile, 0, `the index lists #${n} but no such entry exists`, 'remove the index row, or write the entry');
        }
      }
    }
  }

  if (on('dangling-kb-ref') && kbEntries.size) {
    const refRe = new RegExp(`(?:${escapeRe(CFG.kbFile)}|\\bKB)\`?\\s+#(\\d+)`, 'g');
    for (const [file, source] of read) {
      source.split(/\r?\n/).forEach((line, i) => {
        for (const m of line.matchAll(refRe)) {
          const n = Number(m[1]);
          if (kbEntries.has(n)) continue;
          fail(
            'dangling-kb-ref',
            rel(file),
            i + 1,
            `references ${CFG.kbFile} #${n}, which does not exist`,
            'correct the number — entries are never renumbered, so a gap is a gap',
          );
        }
      });
    }
  }
}

// ── 7. a retired fact must never be restated as live ─────────────────────────
//
// The registry is data, not code: a table under a heading that says these are
// dead. Maintaining it is prose, which is the only form that gets maintained.

if (on('revived-retired-fact')) {
  // The registry heading must be unambiguous, and so must the rows. Both are
  // tight on purpose: a first draft matched any heading containing "dead" or
  // "superseded" and read every table under it, which in prose this dense meant
  // registering column headers like "Host" and "Tier" as retired facts and
  // reporting 181 problems, none of them real.
  //
  //   heading — says both *what* is dead and *that* it is dead
  //   row     — the retired pattern in `backticks` or **bold**, first cell
  const RETIRED_HEADING = /\b(?:dead|retired|withdrawn|never quote|do not quote)\b/i;
  const RETIRED_SUBJECT = /\b(?:number|figure|fact|claim|statistic|measurement|rate)/i;
  const registry = [];
  const registryLines = new Map(); // file path -> line indices to ignore
  let hasRegistryHeading = false;

  for (const file of docFiles) {
    const lines = read.get(file)?.split(/\r?\n/);
    if (!lines) continue;
    const ignore = new Set();
    let inSection = false;
    let level = 0;
    lines.forEach((line, i) => {
      const h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) {
        const thisLevel = h[1].length;
        if (inSection && thisLevel <= level) inSection = false;
        if (RETIRED_HEADING.test(h[2]) && RETIRED_SUBJECT.test(h[2])) {
          inSection = true;
          level = thisLevel;
          hasRegistryHeading = true;
        }
        return;
      }
      if (!inSection) return;
      const row = line.match(/^\|\s*(.+?)\s*\|/);
      if (!row) return;
      // The pattern is whatever is marked up in the first cell. Requiring the
      // markup is what keeps a header row, or a sentence, out of the registry.
      const marked = row[1].match(/`([^`]+)`|\*\*([^*]+)\*\*/);
      if (!marked) return;
      const cell = (marked[1] ?? marked[2]).trim();
      if (!cell || cell.length < 3) return;
      ignore.add(i);
      let re;
      if (cell.startsWith('/') && cell.lastIndexOf('/') > 0) {
        try {
          re = new RegExp(cell.slice(1, cell.lastIndexOf('/')), 'i');
        } catch {
          return;
        }
      } else {
        re = new RegExp(escapeRe(cell), 'i');
      }
      registry.push({ re, what: cell });
    });
    if (ignore.size) registryLines.set(file, ignore);
  }

  if (registry.length === 0) {
    // A registry with a heading and no rows yet is a new project, not a fault.
    if (!hasRegistryHeading) {
      notes.push('No retired-facts registry found. Add a "Numbers and facts that are dead" table so withdrawn figures cannot come back.');
    }
  } else {
    // Vocabulary that marks a figure as dead rather than asserted. Bare emoji are
    // deliberately excluded: they appear all over these documents as emphasis, so
    // accepting them lets a revived figure through.
    const WITHDRAWN = /withdraw|supersed|retract|\bdead\b|wrong|stale|corrected|fictitious|blended|not the current|no longer|do not quote|never quote|retired/i;

    for (const file of docFiles) {
      const lines = read.get(file)?.split(/\r?\n/);
      if (!lines) continue;
      const ignore = registryLines.get(file) ?? new Set();
      let heading = '';
      let headingAt = -1;
      lines.forEach((line, i) => {
        if (/^#{1,4}\s/.test(line)) {
          heading = line;
          headingAt = i;
        }
        if (ignore.has(i)) return;
        for (const { re, what } of registry) {
          if (!re.test(line)) continue;
          // Context is the nearest heading, a tight ±2 lines, and every
          // blockquote between that heading and here.
          //
          // The ±2 is tight on purpose: at ±10 an unrelated neighbouring line
          // containing "corrected" was enough to let a freshly asserted figure
          // pass. The blockquotes are what make it accurate anyway, because the
          // convention these documents follow is that a withdrawal note sits at
          // the *top* of the section it withdraws — so it is reliably further
          // than two lines from the figure, and reliably a `> ⚠️ …` banner.
          const parts = [heading, ...lines.slice(Math.max(0, i - 2), i + 3)];
          for (let j = Math.max(0, headingAt); j < i; j++) {
            if (/^\s*>/.test(lines[j])) parts.push(lines[j]);
          }
          if (WITHDRAWN.test(parts.join('\n'))) continue;
          fail(
            'revived-retired-fact',
            rel(file),
            i + 1,
            `restates the retired "${what}" without saying it is dead`,
            'remove it, or say on the line or in the section heading that it is withdrawn',
          );
        }
      });
    }
  }
}

// ── git, for the two checks that need it ─────────────────────────────────────

const isGit = existsSync(join(root, '.git'));
let remoteBranches = null;
let localBranches = null;
let lastCommitDate = null;

if (isGit) {
  try {
    const { stdout } = await run('git', ['ls-remote', '--heads', 'origin'], { cwd: root, timeout: 20_000 });
    remoteBranches = new Set([...stdout.matchAll(/refs\/heads\/(\S+)/g)].map((m) => m[1]));
  } catch {
    notes.push('Could not reach origin, so branch claims were checked against local branches only.');
  }
  try {
    const { stdout } = await run('git', ['for-each-ref', '--format=%(refname:short)', 'refs/heads'], { cwd: root, timeout: 10_000 });
    localBranches = new Set(stdout.split(/\r?\n/).filter(Boolean));
  } catch {
    // Not fatal.
  }
  try {
    const { stdout } = await run('git', ['log', '-1', '--format=%cI'], { cwd: root, timeout: 10_000 });
    const d = new Date(stdout.trim());
    if (!Number.isNaN(d.getTime())) lastCommitDate = d;
  } catch {
    // Not fatal.
  }
}

// ── 8. a claim must name a live branch, and must not be old ──────────────────
//
// The claim board cannot clear itself: a change removes the previous claim and
// leaves its own behind, so a finished claim survives until somebody notices,
// and nobody notices. Hence both halves — a dead branch, or a stale date.

if (on('stale-claim')) {
  const board = doc(CFG.claimFile);
  if (board) {
    const claimTable = board.text.split(/^## /m)[0];
    const lines = board.text.split(/\r?\n/);
    const today = new Date();
    const branches = remoteBranches ?? localBranches;

    for (const rowMatch of claimTable.matchAll(/^\|.+\|\s*$/gm)) {
      const row = rowMatch[0];
      if (/^\|[\s:|-]+\|$/.test(row)) continue; // separator
      const line = lines.findIndex((l) => l.trim() === row.trim()) + 1;

      const date = row.match(/\b(\d{4}-\d{2}-\d{2})\b/);
      const branch = [...row.matchAll(/`([a-z][a-z0-9]*\/[a-z0-9._/-]+)`/gi)].map((m) => m[1])[0];
      if (!date && !branch) continue; // header row, or prose

      if (branch && branches && !branches.has(branch)) {
        fail(
          'stale-claim',
          CFG.claimFile,
          line,
          `claims \`${branch}\`, which no longer exists`,
          'the work landed — remove the row and add a line to "Recently finished"',
        );
        continue;
      }
      if (date) {
        const age = Math.floor((today - new Date(date[1])) / 86_400_000);
        if (age > CFG.staleClaimDays) {
          fail(
            'stale-claim',
            CFG.claimFile,
            line,
            `claim dated ${date[1]} is ${age} days old`,
            `finish it and clear the row, or re-date it today — claims are meant to be same-day (staleClaimDays is ${CFG.staleClaimDays})`,
          );
        }
      }
    }
  }
}

// ── 9. the status section must not be older than the work ────────────────────
//
// The failure this whole method exists to prevent: a session reads the status,
// believes it, and either rebuilds something finished or reports a position that
// moved days ago.

if (on('stale-status')) {
  const status = doc(CFG.statusFile);
  if (!status) {
    notes.push(`No ${CFG.statusFile}. A project with no written status is one nobody can pick up.`);
  } else {
    const stamp = status.text.match(/\*\*(?:Updated|Status as at|As at|Last updated)[:*]*\*{0,2}\s*:?\s*(\d{4}-\d{2}-\d{2})/i);
    if (!stamp) {
      fail(
        'stale-status',
        CFG.statusFile,
        1,
        'carries no "**Updated:** YYYY-MM-DD" stamp, so staleness cannot be detected',
        'add the stamp to the status section and move it every time the position changes',
      );
    } else {
      const stated = new Date(stamp[1]);
      let newest = lastCommitDate;
      let newestFrom = 'the last commit';
      if (!newest) {
        for (const f of codeFiles) {
          try {
            const info = await stat(f);
            if (!newest || info.mtime > newest) {
              newest = info.mtime;
              newestFrom = rel(f);
            }
          } catch {
            // skip
          }
        }
      }
      if (newest) {
        const drift = Math.floor((newest - stated) / 86_400_000);
        if (drift > CFG.staleStatusDays) {
          fail(
            'stale-status',
            CFG.statusFile,
            status.text.split(/\r?\n/).findIndex((l) => l.includes(stamp[1])) + 1,
            `says ${stamp[1]}, but ${newestFrom} is ${drift} days newer`,
            'update the status section and its stamp, or say why the work did not change the position',
          );
        }
      }
    }
  }
}

// ── report ───────────────────────────────────────────────────────────────────

const fails = problems.filter((p) => p.sev === 'fail');
const warns = problems.filter((p) => p.sev === 'warn');
const CHECKS = 9;

for (const n of notes) console.log(`check-docs — note: ${n}`);

if (problems.length === 0) {
  console.log(`check-docs — PASS. ${CHECKS} checks, ${docFiles.length} documents, ${rel(root) || '.'}`);
  process.exit(0);
}

const report = (items, emit) => {
  const byCheck = new Map();
  for (const p of items) {
    if (!byCheck.has(p.check)) byCheck.set(p.check, []);
    byCheck.get(p.check).push(p);
  }
  for (const [check, list] of byCheck) {
    emit(`  ${check} (${list.length}):`);
    for (const p of list) {
      emit(`    ${p.file}${p.line ? `:${p.line}` : ''} — ${p.detail}`);
      emit(`      fix: ${p.fix}`);
    }
    emit('');
  }
};

if (fails.length && !WARN_ONLY) {
  console.error('check-docs — FAIL. The documents disagree with the project.\n');
  report(fails, (s) => console.error(s));
} else if (fails.length) {
  console.log('check-docs — would FAIL (--warn-only).\n');
  report(fails, (s) => console.log(s));
}
if (warns.length) {
  console.log('check-docs — worth a look, not a failure:\n');
  report(warns, (s) => console.log(s));
}

if (fails.length && !WARN_ONLY) {
  console.error(
    `${fails.length} problem(s)${warns.length ? `, ${warns.length} warning(s)` : ''}. ` +
      "Every check here exists because it already happened — read the project's doc-tidy record before deciding one is a false positive.",
  );
  process.exit(1);
}
process.exit(0);
