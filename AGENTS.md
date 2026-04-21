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
2. Opens a TUI form via `src/form/` and waits for the user to submit or cancel.
3. Returns a `FormResult` with structured answers to the LLM.

### Form (`src/form/`)

- **`src/form/form.ts`** — `Form` class: orchestrates the form lifecycle — tab navigation, input activation/deactivation, review screen with scroll, exit confirmation, and answer collection.
- **`src/form/tabs.ts`** — `Tabs` component: renders the horizontal tab bar with answered/required indicators and auto-scrolling viewport.
- **`src/form/question.ts`** — `FormQuestion` interface linking a normalized `Question` to its interactive `Input` widget plus display metadata.
- **`src/form/scrollbar.ts`** — `Scrollbar` component: renders a vertical scrollbar indicator for long option lists and the review screen.
- **`src/form/index.ts`** — public entry point: creates the `Form` and wires it into the pi extension lifecycle.

### Inputs (`src/form/inputs/`)

Each input type is a self-contained module (class + colocated test file):

- **`types.ts`** — `Input` / `BaseInput` / `InputCallbacks` abstractions shared by all input types.
- **`text.ts`** — `TextInput`: single-line text with an `Editor`, debounced validation, and placeholder.
- **`number.ts`** — `NumberInput`: numeric input using a shared `Editor` with insert-then-revert validation.
- **`boolean.ts`** — `BooleanInput`: yes/no toggle with customisable labels and colours.
- **`choice.ts`** — `ChoiceInput`: single-select and multi-select option list with an optional "Other…" free-text row and scrollbar.

### Shared modules (`src/`)

- **`src/schema.ts`** — TypeBox JSON Schema for the `ask_user_question` tool parameters.
- **`src/types.ts`** — shared TypeScript interfaces (`Option`, `Validation`, `Question`, `Answer`, `FormResult`).
- **`src/helpers.ts`** — stateless utility functions (`errorResult`, `stripAnsi`, `isBorderLine`).
- **`src/validation.ts`** — text input validation (`validate`), covers url, email, ip, number, integer, regex.

### Tests

- **`src/form/inputs/*.test.ts`** — unit tests organised by input type (text, number, boolean, choice).
- **`src/form/form.test.ts`** — integration tests for the Form (tabs, review, scroll, exit confirmation).
- **`src/form/tabs.test.ts`** — unit tests for the Tabs component.
- **`tests/*.md`** — scenario descriptions used as integration test fixtures.

## Key Conventions

### Input lifecycle

Each input follows an activate/deactivate lifecycle:

- `activate()` — acquires the shared `Editor`, sets up submit handler.
- `deactivate()` — validates, saves the current value, releases the Editor.
- `handleInput(data)` — processes keystrokes while active.
- `renderWidget(maxW)` — produces display lines for the current state.

State transitions within inputs are pure where possible; side effects are limited to Editor interactions and callback invocations.

### Question types

Raw questions from the LLM are normalised at construction time in `src/form/index.ts`. After normalisation:

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
