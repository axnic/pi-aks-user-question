# AGENTS.md

Context and instructions for AI coding agents working in this repository.

## Dev Environment

All dev tooling is managed via [mise](https://mise.run).

```sh
# Setup (run once after clone)
mise trust && mise install
pnpm install
```

Common commands (short aliases available — see `mise.toml`):

```sh
mise run lint             # run Trunk (check only)
mise run lint:fix         # auto-fix all lint issues
mise run build            # bundle extension to dist/index.js
```

Linter configs: `.trunk/trunk.yaml` (Trunk — manages all linters), `.commitlintrc.js` (commit messages).

> **Build:** `mise run build` runs `node build.mjs`, which bundles `src/index.ts` and all
> imports under `src/` into `dist/index.js` via esbuild. During local development, pi loads
> `.ts` files directly — no build is needed. The compiled `dist/` is used for distribution
> and production deployments.

## Testing

```sh
pnpm test                            # run full vitest suite (all spec files)
pnpm run test:watch                  # watch mode
npx vitest run --reporter=verbose    # verbose output
```

Test layout:

- `tests/*.md` — scenario descriptions used as integration test fixtures
- `scripts/*.spec.mjs` — unit tests for standalone scripts

## Commit / PR Instructions

Commit format follows **Conventional Commits with a mandatory scope**:

```text
type(scope): Subject
```

The scope is **required** and must be one of: `form`, `schema`, `validation`, `docs`, `deps`, `tooling`. The subject uses sentence case. The `commit-msg` git hook enforces this automatically (via `commitlint`). See `.commitlintrc.js` for the full ruleset.

Run `mise run lint:commitlint` to validate a commit message manually.

## Architecture

The extension is a single-layer pi extension that exposes one tool: **`ask_user_question`**.

### Entry point (`src/index.ts`)

Registers the `ask_user_question` tool with pi. When invoked, it:

1. Validates the incoming parameters against the JSON Schema (`src/schema.ts`).
2. Normalizes each question through `normalizeQuestion()` (`src/helpers.ts`).
3. Opens a TUI form via `src/form/` and waits for the user to submit or cancel.
4. Returns a `FormResult` with structured answers to the LLM.

### Form (`src/form/`)

- **`src/form/index.ts`** — orchestrates the form lifecycle (open, render loop, collect answers).
- **`src/form/state.ts`** — pure state machine; all transitions are side-effect-free functions.
- **`src/form/handlers.ts`** — maps raw key events to state transitions.
- **`src/form/renderers.ts`** — renders state to TUI output strings (one per line).

### Shared modules (`src/`)

- **`src/schema.ts`** — TypeBox JSON Schema for the `ask_user_question` tool parameters.
- **`src/types.ts`** — shared TypeScript interfaces (`Option`, `Validation`, `Question`, `Answer`, `FormResult`).
- **`src/helpers.ts`** — stateless utility functions (`normalizeQuestion`, `errorResult`, `stripAnsi`, `isBorderLine`).
- **`src/validation.ts`** — text input validation (`validateTextInput`), covers url, email, ip, number, integer, regex.

### Test scenarios (`tests/`)

Markdown files describing form scenarios. Each file encodes a fixture: a set of questions and the expected interaction sequence. Colocated with the test runner that parses them.

## Key Conventions

### State machine is pure

All form state transitions in `src/form/state.ts` and `src/form/handlers.ts` are pure functions with no side effects. This makes them cheap to unit-test in isolation without a running pi instance.

### `Question` normalization

Raw questions from the LLM may omit optional fields. Always pass questions through `normalizeQuestion()` (`src/helpers.ts`) before using them. After normalization:

- `type === "text"` → `multiSelect: false`, `allowOther: false`.
- `type === "choice"` → `allowOther` defaults to `true`.
- `validation` is only present on `"text"` questions.

### Commit scope list

The allowed scopes (enforced by `.commitlintrc.js`) are:

| Scope        | Area                                |
| ------------ | ----------------------------------- |
| `form`       | Form lifecycle and TUI rendering    |
| `schema`     | Tool parameter schema (`schema.ts`) |
| `validation` | Text input validation logic         |
| `docs`       | Documentation                       |
| `deps`       | Dependency updates                  |
| `tooling`    | mise, trunk, commitlint, etc.       |

### Never store secrets

The tool processes user input and returns it to the LLM. Never log raw answers. `~/.pi/agent/settings.json` is plain text — never store API keys or tokens there.
