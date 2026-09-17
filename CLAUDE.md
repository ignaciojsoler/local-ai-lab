# local-ai-lab

A portfolio site where Hugging Face models run entirely in the visitor's
browser. Static Astro site, React islands, transformers.js, deployed to Vercel.

- Design spec: `docs/superpowers/specs/2026-09-17-local-ai-lab-design.md`
- Implementation plan: `docs/superpowers/plans/2026-09-17-local-ai-lab.md`

## Tooling

**Use Bun. Always.** Never npm, npx, or yarn.

| Task | Command |
|---|---|
| Install dependencies | `bun install` |
| Add a dependency | `bun add <pkg>` |
| Add a dev dependency | `bun add -d <pkg>` |
| Run a one-off binary | `bunx <cmd>` |
| Run a package script | `bun run <script>` |

The committed lockfile is `bun.lock`. Do not commit `package-lock.json` or
`yarn.lock`.

Run the tests with `bun run test`, **not** `bun test`. Bare `bun test` invokes
Bun's own test runner, which ignores `vitest.config.ts` and therefore loads
neither the jsdom environment nor the setup file.

## Conventions

- All code, comments, documentation, and UI copy are written in English.
- Colors are CSS custom properties. No hardcoded hex values in components.
- All inference runs in a Web Worker, never on the main thread.
- No model is downloaded until the visitor explicitly asks for it.
