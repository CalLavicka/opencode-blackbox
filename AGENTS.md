Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## Formatting

- Use `bun run format` (oxfmt).
- Formatting rules: single quotes, no semicolons.
- Formatter config lives in `oxfmtrc.json`.

## APIs

- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Opencode Plugin

- Plugin entrypoint: `src/index.ts` (default export is the plugin).
- Redaction logic lives in `src/redact.ts` and AST caching in `src/ast.ts`.
- Helper utilities for blackbox gating are in `src/blackbox-utils.ts`.
- Tests live in `tests/` with fixtures in `tests/fixtures`.
- The formatter config is `oxfmtrc.json`.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from 'bun:test'

test('hello world', () => {
  expect(1).toBe(1)
})
```
