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
mise run docs:schema      # regenerate docs/schema.json from TypeBox schemas
mise run pi:sandbox       # launch pi in an isolated demo home
mise run docs:demo        # render docs/demo/demo.tape with VHS
```

Linter configs: `.trunk/trunk.yaml` (Trunk — manages all linters), `.commitlintrc.js` (commit messages).

> **Build:** `mise run build` runs `node build.mjs`, which bundles `index.ts` and all
> imports under `src/` into `dist/index.js` via esbuild. During local development, pi loads
> `.ts` files directly — no build is needed. The compiled `dist/` is used for distribution
> and production deployments.

## Demo recording

The repository includes a small VHS scaffold for recording a terminal demo from
code.

`vhs` is intentionally external to `mise` because it is only needed when
updating the presentation, not for normal development. Install it with your
system package manager before running `mise run docs:demo`.

Run `mise run pi:sandbox -- --scenarii docs/demo/basic.scenarii.json` to launch
`pi` with `HOME=.demo/pi-home`, a scrubbed environment, `--no-skills`,
`--no-prompt-templates`, and `.demo/pi-home` as the working directory. The
launcher creates the symlink
`.demo/pi-home/.pi/agent/extensions/pi-aks-user-question -> <repo root>`,
loads a second extension explicitly for the canned in-process provider, writes
the selected scenarii into `.demo/pi-home/.pi/agent/sandboxed-pi/scenarii.json`,
and regenerates a local `.demo/pi-home/.pi/agent/models.json` so Pi selects the
demo provider from a clean sandbox state. That keeps the demo isolated from any
personal `~/.pi` configuration and avoids loading repo-level skills or AGENTS
files.

The scenarii file is mandatory. It must be a non-empty JSON array of objects
with either `user`/`assistant` strings (text reply) or `user`/`tool_call` (tool
invocation), for example `docs/demo/basic.scenarii.json`. If the live prompt
does not exactly match one of the configured `user` strings, the provider
replies with the list of allowed prompts instead of inventing a new answer.

`mise run docs:demo` renders `docs/demo/demo.tape`. The checked-in tape is only
a starting point so the command path stays reproducible; edit it with the real
demo flow when you are ready to record the final presentation.

## Testing

```sh
pnpm test                            # run full vitest suite (all spec files)
pnpm run test:watch                  # watch mode
npx vitest run --reporter=verbose    # verbose output
```

Test layout:

- `src/form/inputs/*.test.ts` — unit tests for each input type (text, number, boolean, choice)
- `src/form/form.test.ts` — integration tests for the Form (tabs, review, scroll, exit confirmation)
- `src/form/tabs.test.ts` — unit tests for the Tabs component
- `src/form/review.test.ts` — unit tests for the ReviewScreen component
- `src/schema.test.ts` — runtime validation tests for AskUserQuestionParams
- `src/helpers.test.ts` — unit tests for helper utilities
- `src/validation.test.ts` — unit tests for text/number input validation
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

### Entry point (`index.ts`)

Registers the `ask_user_question` tool with pi. When invoked, it:

1. Validates the incoming parameters via `validateFormParams()` in `src/form/index.ts`.
2. Opens a TUI form via `createFormFromParams()` and waits for the user to submit or cancel.
3. Returns a `FormResult` with structured answers to the LLM.

Also defines `renderCall` (displays the tool invocation in chat history) and `renderResult` (displays per-answer summary with ✔/· symbols).

### Form (`src/form/`)

- **`src/form/index.ts`** — public entry point: `createFormFromParams()` validates raw params and builds the form; `createForm()` is the low-level factory that instantiates inputs, wires deferred callbacks, and creates the Form instance.
- **`src/form/form.ts`** — `Form` class: orchestrates the form lifecycle — keyboard delegation chain (exit confirm → active input → review screen → tabs → escape), input activate/deactivate on tab switches, frame rendering (question + description + widget + error + footer hints), and final answer collection.
- **`src/form/tabs.ts`** — `Tabs` class: manages tab navigation state and renders the horizontal tab bar with answered/required/review indicators. Uses an expand-from-active overflow algorithm with `…` ellipsis chips when tabs don't fit.
- **`src/form/review.ts`** — `ReviewScreen` class: renders a scrollable summary of all answers with ↑/↓ navigation, scrollbar, and warning banners for unanswered questions.
- **`src/form/question.ts`** — `FormQuestion` interface: links a normalized `Question` to its interactive `Input` widget plus display metadata (header, description, required flag).
- **`src/form/scrollbar.ts`** — shared scrollbar character utility: computes thumb/track characters for a given scroll position. Used by ChoiceInput and ReviewScreen.

### Inputs (`src/form/inputs/`)

Each input type is a self-contained module (class + colocated test file):

- **`types.ts`** — `Input` / `BaseInput` / `InputCallbacks` / `RenderContext` abstractions shared by all input types.
- **`text.ts`** — `TextInput`: single-line text with a shared `Editor`, debounced validation, and placeholder. Lifecycle: `activate()` loads value into Editor, `deactivate()` saves it back.
- **`number.ts`** — `NumberInput`: numeric input using the shared `Editor` with insert-then-revert validation (rejects invalid characters immediately). Shows a visual range slider when both `min` and `max` are set. ↑/↓ arrows increment/decrement by `step`.
- **`boolean.ts`** — `BooleanInput`: vertical yes/no toggle with customizable labels and colors. Does NOT use the shared Editor — state is entirely internal.
- **`choice.ts`** — `ChoiceInput`: unified implementation for both single-select (`choice`) and multi-select (`multichoice`). Features numbered option list, scrollbar for long lists, cursor navigation, and an optional "Other…" free-text row with inline editor.

### Shared modules (`src/`)

- **`src/schema.ts`** — TypeBox JSON Schema for the `ask_user_question` tool parameters. Defines 5 question type variants as a discriminated union on `type`. Also the source of truth for `docs/schema.json` (generated via `scripts/generate-schema.ts`).
- **`src/types.ts`** — shared TypeScript interfaces derived from the schema via `Static<typeof ...>`: `Question`, `Answer`, `FormResult`, `ChoiceOption`, `BooleanCustomizableOption`, `InputType`, `InputTypeValueMap`, `InputValue`.
- **`src/helpers.ts`** — stateless utility functions: `errorResult()`, `stripAnsi()`, `isBorderLine()`, `MAX_VISIBLE_OPTIONS`.
- **`src/validation.ts`** — text and number input validation: 8 formats (`url`, `email`, `ip`, `ipv4`, `ipv6`, `number`, `integer`, `regex`) with optional allow/deny lists for IP and email, CIDR range support via `net.BlockList`, and custom error messages. Exports `validate()` dispatcher and `createValidator()` factory.

### Tests

- **`src/form/inputs/*.test.ts`** — unit tests organised by input type (text, number, boolean, choice).
- **`src/form/form.test.ts`** — integration tests for the Form (tabs, review, scroll, exit confirmation).
- **`src/form/tabs.test.ts`** — unit tests for the Tabs component.
- **`src/form/review.test.ts`** — unit tests for the ReviewScreen component.
- **`src/schema.test.ts`** — schema pattern validation tests (question field pattern, placeholder single-line constraint).
- **`src/helpers.test.ts`** — tests for stripAnsi, isBorderLine, errorResult.
- **`src/validation.test.ts`** — tests for all 8 validation formats.
- **`scripts/*.spec.mjs`** — unit tests for standalone scripts.

## Key Conventions

### Input lifecycle

Editor-backed inputs (`TextInput`, `NumberInput`) follow an activate/deactivate lifecycle managed by the `Form` class. `BooleanInput` and `ChoiceInput` manage their own state directly without the shared `Editor`.

- `activate()` — loads the committed value into the shared `Editor`, wires `onSubmit`.
- `deactivate()` — saves the current Editor text, clears dirty flags, releases the Editor.
- `handleInput(data)` — processes keystrokes while active. Returns `true` if consumed.
- `renderWidget(ctx: RenderContext)` — produces display lines for the current state. Receives `{ theme, editor, maxW, maxH }`.

State transitions within inputs are pure where possible; side effects are limited to Editor interactions and callback invocations (`onAdvance`, `onRetreat`, `onSubmit`, `onRefresh`).

### Keyboard delegation chain

The Form handles keypresses in strict priority order:

1. **Exit confirm dialog** (if visible) — Y/Enter=quit, N/Enter=continue, other=dismiss.
2. **Active input** — delegates to `input.handleInput(data)`.
3. **Review screen** (if on review tab) — Enter=submit, ↑/↓=scroll.
4. **Tabs** — Tab/Shift+Tab switches questions.
5. **Escape** — shows exit confirmation dialog.

### Question types

Questions from the LLM are structurally validated by `validateFormParams()` in `src/form/index.ts` (checks required fields, type allowlist, option counts, minSelections ≤ maxSelections) and then passed as-is to the input constructors — there is no normalization step.

- `choice` and `multichoice` inputs treat an absent `allowOther` as `true`: the "Other…" row appears unless `allowOther: false` is set explicitly.
- `validation` is available on `text` questions (8 string formats via `src/validation.ts`) and `number` questions (`integer`/`number` format with min/max bounds).

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
