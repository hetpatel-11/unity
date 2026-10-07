# Unity frontend

Standalone React/Vite frontend extracted from ytimesy for the hackathon. The existing sidebar, conversation timeline, composer, model picker, task overview, diff viewer, file explorer/editor, terminal UI, and desktop UI are preserved.

```sh
pnpm install
pnpm dev
```

Open http://127.0.0.1:4317. Run `pnpm typecheck` and `pnpm build` to verify the frontend.

`src/App.tsx` composes the original components into one Unity conversation. `src/demo/` contains browser-only preview adapters and sample data. Messages and file edits live in memory and reset on reload. The account is a preview identity. Agent statuses are sample data. Provider connection, recovery, project-management, terminal, and desktop execution require a backend; this preview does not connect agents or save API keys.

No harness, server runtime, authentication implementation, database migrations, environment files, or credentials were imported. `FRONTEND_IMPORT.json` records the original checkout, source commit, copied UI files, and excluded backend imports. The source checkout was left untouched.
