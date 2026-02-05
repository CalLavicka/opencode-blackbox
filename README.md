# opencode-blackbox

Redacts implementation details in file reads for selected OpenCode agents.

## Install

```bash
bun install
```

## Enable in OpenCode

OpenCode loads plugins from `.opencode/plugins/` (project) or `~/.config/opencode/plugins/` (global). For a local checkout, symlink the plugin entrypoint:

```bash
ln -s ../opencode-blackbox/src/index.ts ../opencode/.opencode/plugins/blackbox.ts
```

If this gets published to npm later, add it to your config instead:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-blackbox"]
}
```

## Configure an agent

This plugin only redacts for agents that opt in via `options.blackbox`. You can also allowlist paths (for example, test fixtures) with `options.blackboxAllow`.

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "agent": {
    "test-builder": {
      "description": "Builds and runs tests with redaction",
      "model": "anthropic/claude-sonnet-4-5",
      "options": {
        "blackbox": true,
        "blackboxAllow": ["**/tests/**", "**/*.test.{ts,tsx}"],
      },
    },
  },
}
```

## Use

- In the TUI, select the agent with `Tab` or type `@test-builder` in a message.
- In the CLI, run `opencode run --agent test-builder "Run the test suite"`.

Notes:

- Only `read` output is redacted; files written in the same session are never redacted.
- Line counts are preserved and only implementation bodies/initializers are hidden.

## Agent file alternative

You can define the same agent in a file under `.opencode/agents/`:

```md
---
description: Builds and runs tests with redaction
model: anthropic/claude-sonnet-4-5
options:
  blackbox: true
  blackboxAllow:
    - '**/tests/**'
    - '**/*.test.{ts,tsx}'
---

You build tests using only public interfaces.
You observe behavior by running tests and report mismatches.
It is fine to create failing tests to flag unclear behavior.
If tests fail, suggest renames, doc updates, or fixes.
```

The filename becomes the agent name (e.g. `test-builder.md`).
