# Clarity

A unified personal planning and household coordination app. One login, one planning system: a
personal workspace for horizon-based task planning with AI brain-dump capture, and a household
workspace for shared tasks, cleaning schedules, meal planning and shopping. The distinction
between the two is visibility and permissions, not separate modes.

A personal project, architected multi-tenant from day one.

## Tech stack

- [Next.js 14](https://nextjs.org) — App Router, TypeScript strict
- [Tailwind CSS](https://tailwindcss.com)
- [Supabase](https://supabase.com) — Postgres, RLS, Auth
- [Anthropic API](https://docs.anthropic.com) — brain-dump parsing, server-side only
- [Playwright](https://playwright.dev) — the end-to-end suite

## Getting started

```bash
npm install
npm run setup:hooks   # one-time, per clone — see CONTRIBUTING.md
npm run dev
```

`.env.local` is untracked and is not created for you. The variables it needs are listed in
[KB.md](KB.md) §Environment.

Open <http://localhost:3000>.

## Commands

```bash
npm run dev          # dev server
npm run build        # production build — also type-checks
npm run lint         # ESLint
npm run format       # prettier --write .
npm run test:e2e     # Playwright suite
npm run check:docs   # documentation guard
```

## Connecting Claude

Clarity is an MCP server at `/api/mcp`, so Claude can read and write tasks directly rather than
being told about them. Mint a token on the Connections page — it is shown once — and add it:

```bash
claude mcp add --transport http clarity https://task-planner-nine-sigma.vercel.app/api/mcp   --header "Authorization: Bearer clr_…"
```

Seven tools: `list_workspaces`, `list_categories`, `list_tasks`, `create_tasks`, `update_task`,
`complete_task` and `capture` — the brain dump, callable, so a transcript becomes tasks in one
step.

**A pasted token works in Claude Code and Claude Desktop, and not on claude.ai** — a connector
there authenticates by OAuth only, which is the next phase of work.

## Project structure

```
app/          Next.js App Router pages, layouts and API routes
components/   shared UI components
lib/          shared logic — horizon model, workspace scoping, Supabase clients
types/        shared TypeScript types
supabase/     migrations
e2e/          Playwright suite
```

## Where to read next

| Document | What it holds |
|---|---|
| [CLAUDE.md](CLAUDE.md) | The facts card — what prevents mistakes, and where each fact lives |
| [PLAN.md](PLAN.md) | The plan and the current status |
| [KB.md](KB.md) | Numbered gotchas, and the environment |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to work in this repo |
| [SCHEMA.md](SCHEMA.md) | The database shape |
