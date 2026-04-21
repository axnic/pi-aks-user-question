# JSON Schema

The tool parameter schema is defined in `src/schema.ts` using [TypeBox](https://github.com/sinclairzx81/typebox). A machine-readable copy lives at [`schema.json`](./schema.json), generated via `mise run docs:schema` (or `npx tsx scripts/generate-schema.ts`).

## Question types

The `questions` array accepts 5 question types, discriminated by the `type` field:

| Type          | Widget                                     | Value type | Required fields                             |
| ------------- | ------------------------------------------ | ---------- | ------------------------------------------- |
| `text`        | Single-line editor + optional validation   | `string`   | `id`, `question`, `header`, `placeholder`   |
| `number`      | Numeric field + ↑/↓ step + optional slider | `number`   | `id`, `question`, `header`                  |
| `choice`      | Numbered list — pick one                   | `string`   | `id`, `question`, `header`, `options` (≥ 2) |
| `multichoice` | Checkbox list — pick many                  | `string[]` | `id`, `question`, `header`, `options` (≥ 2) |
| `boolean`     | Yes/No toggle                              | `boolean`  | `id`, `question`, `header`                  |

## Common fields

All question types share these base fields:

| Field         | Type      | Required | Description                                                    |
| ------------- | --------- | -------- | -------------------------------------------------------------- |
| `id`          | `string`  | yes      | Stable identifier — used to match answers back to questions    |
| `question`    | `string`  | yes      | Full question text (≤10 words, must end with `?` or no `?`)    |
| `header`      | `string`  | yes      | Short tab label (≤12 chars recommended)                        |
| `type`        | `string`  | yes      | One of: `text`, `number`, `choice`, `multichoice`, `boolean`   |
| `required`    | `boolean` | no       | Mark as mandatory — tab shows ✦, review warns (default: false) |
| `description` | `string`  | no       | Context shown below the question text (max 4 lines)            |

## Text question

Single-line free-form text input with optional format validation.

| Field         | Type     | Required | Description                                                            |
| ------------- | -------- | -------- | ---------------------------------------------------------------------- |
| `placeholder` | `string` | yes      | Hint text shown in the empty input (no newlines)                       |
| `validation`  | `object` | no       | String validation config (see [String validation](#string-validation)) |

```json
{
  "id": "endpoint",
  "type": "text",
  "question": "What is the API endpoint?",
  "header": "Endpoint",
  "placeholder": "e.g. https://api.example.com",
  "validation": { "format": "url", "protocols": ["https"] }
}
```

## Number question

Numeric input with optional ↑/↓ step increment and a visual range slider.

| Field         | Type     | Required | Description                                                               |
| ------------- | -------- | -------- | ------------------------------------------------------------------------- |
| `placeholder` | `number` | no       | Hint value shown when field is empty                                      |
| `step`        | `number` | no       | ↑/↓ increment/decrement step (default: 1)                                 |
| `validation`  | `object` | no       | Numeric validation config (see [Numeric validation](#numeric-validation)) |

A visual range slider appears automatically when both `min` and `max` are set in the validation.

```json
{
  "id": "port",
  "type": "number",
  "question": "Which port?",
  "header": "Port",
  "validation": { "format": "integer", "min": 1, "max": 65535 }
}
```

## Choice question

Single-select numbered list. Space selects an option (cannot deselect). Enter advances.

| Field        | Type       | Required | Description                                       |
| ------------ | ---------- | -------- | ------------------------------------------------- |
| `options`    | `Option[]` | yes (≥2) | Selectable options                                |
| `allowOther` | `boolean`  | no       | Append a free-text "Other…" entry (default: true) |

```json
{
  "id": "runtime",
  "type": "choice",
  "question": "Which runtime do you target?",
  "header": "Runtime",
  "options": [
    { "label": "Node.js", "description": "V8-based, most ecosystem support" },
    { "label": "Deno" },
    { "label": "Bun" }
  ],
  "allowOther": false
}
```

## Multichoice question

Multi-select checkbox list. Space toggles. Enter advances.

| Field           | Type       | Required | Description                                                           |
| --------------- | ---------- | -------- | --------------------------------------------------------------------- |
| `options`       | `Option[]` | yes (≥2) | Selectable options                                                    |
| `allowOther`    | `boolean`  | no       | Append a free-text "Other…" entry (default: true)                     |
| `minSelections` | `number`   | no       | Minimum selections required (≥ 1) — _schema-only; not enforced in UI_ |
| `maxSelections` | `number`   | no       | Maximum selections allowed — _schema-only; not enforced in UI_        |

```json
{
  "id": "features",
  "type": "multichoice",
  "question": "Which features should be enabled?",
  "header": "Features",
  "options": [
    { "label": "Auth" },
    { "label": "Caching" },
    { "label": "Logging" }
  ],
  "minSelections": 1
}
```

## Boolean question

Yes/No toggle with customizable labels and colors.

| Field          | Type      | Required | Description                             |
| -------------- | --------- | -------- | --------------------------------------- |
| `defaultValue` | `boolean` | no       | Initial selection (default: true = YES) |
| `true`         | `object`  | no       | Custom label and color for the YES side |
| `false`        | `object`  | no       | Custom label and color for the NO side  |

The `true`/`false` objects accept:

| Field   | Type     | Required | Default             | Description   |
| ------- | -------- | -------- | ------------------- | ------------- |
| `label` | `string` | **yes**  | —                   | Display label |
| `color` | `string` | no       | "success" / "error" | Theme color   |

```json
{
  "id": "overwrite",
  "type": "boolean",
  "question": "Overwrite existing files?",
  "header": "Overwrite",
  "defaultValue": false,
  "true": { "label": "Overwrite", "color": "error" },
  "false": { "label": "Keep", "color": "success" }
}
```

## Option shape

Used in `choice` and `multichoice` questions:

| Field         | Type     | Required | Description                         |
| ------------- | -------- | -------- | ----------------------------------- |
| `label`       | `string` | yes      | Display text (1–5 words)            |
| `description` | `string` | no       | Brief explanation shown below label |

## String validation

Available on `text` questions via the `validation` field. Discriminated union on `format`:

| Format    | Description                                          | Extra fields                                              |
| --------- | ---------------------------------------------------- | --------------------------------------------------------- |
| `url`     | Valid URL, optionally restricted to specific schemes | `protocols?: string[]`                                    |
| `email`   | Valid email address with optional domain filtering   | `domainAllowlist?: string[]`, `domainDenylist?: string[]` |
| `ip`      | IPv4 or IPv6 address                                 | `allowlist?: string[]` or `denylist?: string[]`           |
| `ipv4`    | Strict IPv4 only (dotted decimal)                    | `allowlist?: string[]` or `denylist?: string[]`           |
| `ipv6`    | RFC 4291 IPv6 only                                   | `allowlist?: string[]` or `denylist?: string[]`           |
| `number`  | Any finite decimal or integer                        | `min?: number`, `max?: number`                            |
| `integer` | Whole number only                                    | `min?: number`, `max?: number`                            |
| `regex`   | Custom JS regex pattern                              | `pattern?: string` (≤500 chars, no delimiters)            |

All formats accept an optional `errorMessage: string` to override the default error text.

IP formats support CIDR ranges in allow/deny lists (e.g. `"10.0.0.0/8"`, `"2001:db8::/32"`).

## Numeric validation

Available on `number` questions via the `validation` field. Subset of string validation:

| Format    | Description       | Extra fields                   |
| --------- | ----------------- | ------------------------------ |
| `number`  | Any finite number | `min?: number`, `max?: number` |
| `integer` | Whole number only | `min?: number`, `max?: number` |

Both accept `errorMessage?: string`.

---

## Design choices

### Five question types

| Type          | Widget                 | `options`    | `allowOther` | `placeholder` | `validation`    |
| ------------- | ---------------------- | ------------ | ------------ | ------------- | --------------- |
| `text`        | Single-line editor     | —            | —            | **required**  | string formats  |
| `number`      | Numeric field + slider | —            | —            | optional      | numeric formats |
| `choice`      | Numbered list          | **required** | applicable   | —             | —               |
| `multichoice` | Checkbox list          | **required** | applicable   | —             | —               |
| `boolean`     | Yes/No toggle          | —            | —            | —             | —               |

### `required` marks a question as mandatory

When true, the question's tab chip renders with a `✦` symbol in orange. The Review screen shows:

- **Required unanswered** → red `✘ N required question(s) unanswered` warning.
- **Optional unanswered** → orange `⚠ N optional question(s) unanswered` warning.
- **All answered** → no warning (blank placeholder to maintain stable height).

Individual input screens **do** block advancement when `required` is true and no value has been entered (the cursor stays on the current tab). The final Review screen, however, allows submission even with unanswered required questions — the warnings make the intent clear without hard-blocking the overall form.

### `allowOther` controls the auto-injected free-text option

By default, choice and multichoice questions append an "Other…" free-text entry at the bottom. Set `allowOther: false` to restrict the user strictly to the defined options — useful for controlled vocabularies or binary choices.

### `placeholder` is required for `text` questions

A text input without a hint is ambiguous — the user has no indication of the expected format, length, or intent. `placeholder` is the minimum viable label for a free-form field.

### Discriminated union on `type`

All 5 question types are modeled as a TypeBox discriminated union keyed on `type`. This gives the LLM a single flat structure per question type with clear required fields, rather than conditional `allOf`/`if-then` rules.

### Schema generation

`docs/schema.json` is generated from the TypeBox definitions in `src/schema.ts` via `scripts/generate-schema.ts`. Run `mise run docs:schema` to regenerate. The TypeBox schema is the single source of truth.
