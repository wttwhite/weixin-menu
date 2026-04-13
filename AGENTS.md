# AGENTS

- For codebase understanding, dependency tracing, and repo exploration, prefer `ace-tool` first when it is available. Fall back to `rg` and direct file reads only when needed.
- When changing files under `shared/`, run `node scripts/sync-shared.cjs` before verification or deployment so generated runtime copies stay aligned.
- Before finishing work, run the relevant `vitest` command. For full verification, use `npx vitest run`.
