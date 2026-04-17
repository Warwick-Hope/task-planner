# Task Planner

Internal task planning web application for Plant Plan Ltd.

## Tech stack

- [Next.js 14](https://nextjs.org) — App router, TypeScript
- [Tailwind CSS](https://tailwindcss.com)
- [Supabase](https://supabase.com) — backend, auth, database

## Getting started

1. Copy `.env.local` and populate with your Supabase project credentials:

   ```
   NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Run the development server:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
/app          — Next.js App Router pages and layouts
/components   — Shared UI components
/lib          — Utility helpers (e.g. Supabase client)
/types        — Shared TypeScript types
```
