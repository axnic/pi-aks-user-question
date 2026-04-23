# sandboxed-pi

Launches `pi` in an isolated, deterministic demo environment driven by a
scenarii JSON file. No real AI API calls are ever made — every response is
served from the scenarii file.

Designed for reproducible VHS demo recordings that work identically across
different machines and developer environments.

## Files

| File                | Purpose                                                                              |
| ------------------- | ------------------------------------------------------------------------------------ |
| `index.mjs`         | Entry point: sets up the sandbox HOME, writes config, spawns `pi`.                   |
| `provider.mjs`      | pi extension: registers the scenarii stream handler as a custom provider.            |
| `scenarii.mjs`      | Shared logic: arg parsing, scenarii loading, prompt matching.                        |
| `constants.mjs`     | Shared provider/model identifiers referenced by both `index.mjs` and `provider.mjs`. |
| `scenarii.spec.mjs` | Vitest unit tests for `scenarii.mjs`.                                                |

## Scenarii format

A scenarii file is a **non-empty JSON array** of entries. Each entry binds a
user prompt to either a plain text response or a tool invocation:

**Text response:**

```json
{
  "user": "Summarize this project",
  "assistant": "This extension renders a terminal form for structured answers."
}
```

**Tool call** (e.g. to open the interactive form):

```json
{
  "user": "Configure my server",
  "tool_call": {
    "name": "ask_user_question",
    "arguments": {
      "questions": [
        {
          "id": "env",
          "type": "choice",
          "question": "Which environment?",
          "header": "Env",
          "options": [{ "label": "Staging" }, { "label": "Production" }]
        }
      ]
    }
  }
}
```

- `user` — the exact prompt the user must type (whitespace-normalised).
- `assistant` — the canned text the provider will return.
- `tool_call.name` / `tool_call.arguments` — invokes a pi tool directly.

Scenarii files live under `docs/demo/` and use the `.scenarii.json` extension.

If the user types a prompt that does not match any entry, the provider
responds with a message that lists all allowed prompts.

## Usage

```sh
# via mise
mise run pi:sandbox -- --scenarii docs/demo/basic.scenarii.json

# directly
node scripts/sandboxed-pi/index.mjs --scenarii docs/demo/basic.scenarii.json

# forward extra flags to pi (after --)
node scripts/sandboxed-pi/index.mjs --scenarii docs/demo/basic.scenarii.json -- --list-models
```

`--scenarii` is required.

## How it works

```txt
index.mjs
  │
  ├─ Parses --scenarii and loads the scenarii file.
  ├─ Creates .demo/pi-home/ (isolated HOME):
  │    ├─ .pi/agent/models.json       ← registers demo provider+model at startup
  │    ├─ .pi/agent/settings.json     ← sets demo provider as default
  │    ├─ .pi/agent/sandboxed-pi/scenarii.json  ← pre-processed scenarii state
  │    └─ .pi/agent/extensions/
  │         ├─ pi-aks-user-question → <repo>   (symlink)
  │         └─ sandboxed-pi-provider.mjs → provider.mjs  (symlink)
  └─ Spawns pi with --extension provider.mjs, --no-skills, --no-prompt-templates
       and a minimal, trimmed environment (HOME, PATH, TERM, LANG, …)

provider.mjs  (loaded by pi as an extension)
  └─ Registers a streamSimple handler under the "demo" provider name.
       On each turn, reads the last user message from context and calls
       buildScenariiReply() to return either a text stream or a tool call.
```

### Why `models.json`?

pi resolves `--provider` / default provider **before** extensions finish
loading. Writing `models.json` into the sandbox HOME means the demo model is
already present in pi's `ModelRegistry` at startup — so the default provider
set in `settings.json` is resolved correctly without any CLI flags.

### Why `--extension`?

Extensions discovered through symlinks in `~/.pi/agent/extensions/` may not
load fast enough for the provider to be registered before the first turn.
Passing `--extension <absolute-path>` directly ensures the provider is always
loaded synchronously during pi's startup sequence.
