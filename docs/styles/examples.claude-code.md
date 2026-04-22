<!-- markdownlint-disable MD036 -->

# AskUserQuestion — Claude Code UI Reference

Technical reference for the `AskUserQuestion` TUI component.
Each view is documented with: the rendered output, the JSON input that produces it, a visual breakdown, and an assessment.

---

## View 1 — Single Select

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
←  ☐ Langage  ☐ Projets  ☐ Style code  ☐ Priorité  ✔ Submit  →

Quel est ton langage de programmation préféré ?

❯ 1. Rust
     Performance maximale, mémoire sûre sans GC
  2. TypeScript
     JavaScript typé, idéal pour le web
  3. Python
     Simple et polyvalent, roi du data/ML
  4. Go
     Concurrence native, compilation rapide
  5. Type something.
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  6. Chat about this

Enter to select · Tab/Arrow keys to navigate · Esc to cancel
```

**Input JSON**

```json
{
  "questions": [
    {
      "question": "What is your favorite programming language?",
      "header": "Language",
      "multiSelect": false,
      "options": [
        {
          "label": "Rust",
          "description": "Maximum performance, memory-safe without GC"
        },
        {
          "label": "TypeScript",
          "description": "Typed JavaScript, ideal for the web"
        },
        {
          "label": "Python",
          "description": "Simple and versatile, king of data/ML"
        },
        { "label": "Go", "description": "Native concurrency, fast compilation" }
      ]
    }
  ]
}
```

**Visual breakdown**

| Element                      | Description                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| Header chips (`☐ Langage …`) | One chip per question, showing completion state. Arrows navigate between questions. |
| `❯` chevron                  | Cursor indicating the currently focused option.                                     |
| `label` + `description`      | Two-line layout per option — label is bold-equivalent, description is dimmer.       |
| `5. Type something.`         | Auto-injected by the UI — do **not** include "Other" in your `options` array.       |
| `Chat about this`            | Persistent escape hatch — always rendered outside the separator.                    |

**Assessment**

✅ Clean and minimal — easy to scan, no visual clutter.  
✅ Two-line options convey context without overwhelming.  
⚠️ The `❯` pointer is large and visually dominant for a simple list.  
⚠️ Tab-based navigation between questions is non-obvious (no visible affordance).  
⚠️ The checkbox in the header chips (`☐` / `☒`) is small and easy to miss as a progress indicator.

---

## View 2 — Multi Select

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
←  ☒ Langage  ☒ Projets  ☐ Style code  ☐ Priorité  ✔ Submit  →

Quels types de projets tu travailles en ce moment ?

  1. [✔] Web / API
  Applications web, REST ou GraphQL
❯ 2. [✔] CLI / Outils
  Outils en ligne de commande
  3. [ ] Data / ML
  Analyse de données, machine learning
  4. [✔] Infrastructure
  DevOps, cloud, systèmes distribués
  5. [ ] Type something
     Next
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  6. Chat about this

Enter to select · Tab/Arrow keys to navigate · Esc to cancel
```

**Input JSON**

```json
{
  "questions": [
    {
      "question": "What types of projects are you working on right now?",
      "header": "Projects",
      "multiSelect": true,
      "options": [
        {
          "label": "Web / API",
          "description": "Web applications, REST or GraphQL"
        },
        { "label": "CLI / Tools", "description": "Command-line tooling" },
        {
          "label": "Data / ML",
          "description": "Data analysis, machine learning"
        },
        {
          "label": "Infrastructure",
          "description": "DevOps, cloud, distributed systems"
        }
      ]
    }
  ]
}
```

**Visual breakdown**

| Element                 | Description                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| `[✔]` / `[ ]`           | Markdown-style checkboxes with a unicode checkmark inside. Space = toggle, Enter = confirm.       |
| `❯` chevron             | Cursor for navigation, independent from selection state.                                          |
| Multiple `[✔]` at once  | Any number of options can be checked before confirming.                                           |
| `answers` serialization | The UI concatenates selected labels as a comma-separated string, e.g. `"Web / API, CLI / Tools"`. |

**Assessment**

✅ **Favorite pattern.** The `[✔]` checkbox with a unicode checkmark is smart, clean, and immediately readable.  
✅ Selection state and navigation cursor are visually decoupled — no confusion between "hovering" and "checked".  
✅ Feels native to a terminal context without custom rendering tricks.  
⚠️ The `❯` pointer is still too large relative to the compact checkbox style.  
⚠️ No visual indication of a minimum or maximum selection count.

---

## View 3 — Review Screen

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

←  ☒ Langage  ☒ Projets  ☐ Style code  ☐ Priorité  ✔ Submit  →

Review your answers

⚠ You have not answered all questions

 ● Quel est ton langage de programmation préféré ?
   → Python
 ● Quels types de projets tu travailles en ce moment ?
   → Web / API, Infrastructure, CLI / Outils

Ready to submit your answers?

❯ 1. Submit answers
  2. Cancel
```

**Triggering condition**

This screen is not driven by a JSON input field — it is automatically displayed when the user reaches the `✔ Submit` chip in the header navigation. The UI constructs it from the current `answers` state.

**Visual breakdown**

| Element                                 | Description                                                                                  |
| --------------------------------------- | -------------------------------------------------------------------------------------------- |
| `⚠ You have not answered all questions` | Warning banner shown when at least one question has no answer. Submission is still possible. |
| `● Question → Answer`                   | Compact recap of collected answers. Multi-select answers are comma-joined.                   |
| `Submit / Cancel`                       | Binary confirmation before the final payload is returned.                                    |

**Assessment**

✅ Straightforward — no surprises, does exactly what it needs to.  
✅ The warning is non-blocking; partial submissions are allowed, which is the right default.  
✅ Keeps the header chip navigation visible so the user can still go back.

---

## View 4 — Enhanced Selector (Preview + Notes)

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ☐ Style

Comment veux-tu que je structure mes réponses ?

  1. Minimaliste (Recommended)    ┌───────────────────────────────────────────────────────┐
❯ 2. Avec contexte                │ Problème                                              │
  3. Tutoriel complet             │                                                       │
                                  │ Additionner deux entiers de façon sûre.               │
                                  │                                                       │
                                  │ Solution                                              │
                                  │                                                       │
                                  │ fn add(a: i32, b: i32) -> i32 {                       │
                                  │     a + b                                             │
                                  │ }                                                     │
                                  │                                                       │
                                  │ Pourquoi                                              │
                                  │                                                       │
                                  │ Rust garantit l'absence d'overflow en debug.          │
                                  └───────────────────────────────────────────────────────┘

                                  Notes: press n to add notes

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  Chat about this

Enter to select · ↑/↓ to navigate · n to add notes · Esc to cancel
```

**Input JSON**

````json
{
  "questions": [
    {
      "question": "How do you want me to structure my responses?",
      "header": "Style",
      "multiSelect": false,
      "options": [
        {
          "label": "Minimal",
          "description": "Short, targeted answers — no framing overhead"
        },
        {
          "label": "With context",
          "description": "Problem, solution, and rationale",
          "preview": "## Problem\n\nAdd two integers safely.\n\n## Solution\n\n```rust\nfn add(a: i32, b: i32) -> i32 {\n    a + b\n}\n```\n\n## Why\n\nRust guarantees no overflow in debug mode."
        },
        {
          "label": "Full tutorial",
          "description": "Step-by-step walkthrough with examples and references"
        }
      ]
    }
  ]
}
````

**Visual breakdown**

| Element                         | Description                                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Side-by-side panel              | Triggered when the focused option has a `preview` field. The panel renders raw text today; **target: rendered Markdown** (headers, code blocks, etc.). |
| `Notes: press n`                | Shortcut to annotate the current selection. Stored in `annotations[question].notes`.                                                                   |
| `annotations[question].preview` | Captures the markdown content of the selected preview for downstream use.                                                                              |
| Single-select only              | `preview` is exclusive to `multiSelect: false`. Adding it to a multi-select question is a schema violation.                                            |

**Assessment**

✅ **Strong pattern.** The side-by-side layout lets the user evaluate an option before committing — very useful for style/format choices.  
✅ The `n` shortcut for notes is lightweight and unobtrusive — power-user feature that doesn't pollute the default flow.  
✅ Extending this to `multiSelect: true` (enhanced multi-select) would unlock a lot of use cases.  
⚠️ The preview panel currently renders plain text — it should render Markdown (headings, code fences, bold, etc.) to be genuinely useful.

---

## Overall Assessment

This component is functional and covers the core use cases. The interaction model is a bit clunky in places, but the multi-select pattern stands out as the strongest design choice.

| Pattern                             | Status                                                   |
| ----------------------------------- | -------------------------------------------------------- |
| Single select                       | ✅ Ship it — simple and effective                        |
| **Multi select**                    | ✅ **Favorite — keep this exactly, refine pointer size** |
| Review screen                       | ✅ No changes needed                                     |
| Enhanced selector (preview + notes) | ✅ Want this — needs real MD rendering in the panel      |
| **Text input**                      | ❌ **Missing — no standalone free-text question type**   |

### Missing: Text Input

There is currently no way to ask for a free-form text answer as a first-class question type. The auto-injected "Type something" option is a workaround, not a solution. A dedicated text input question type should be added to the schema, for example:

```json
{
  "question": "What is the name of your project?",
  "header": "Project",
  "type": "text",
  "placeholder": "e.g. my-awesome-app"
}
```

This would render as a standard inline text prompt rather than a selection list.

---

## Appendix — JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "additionalProperties": false,
  "properties": {
    "questions": {
      "description": "Questions to ask the user (1-4 questions)",
      "type": "array",
      "minItems": 1,
      "maxItems": 4,
      "items": {
        "additionalProperties": false,
        "properties": {
          "question": {
            "description": "The complete question to ask the user. Should be clear, specific, and end with a question mark.",
            "type": "string"
          },
          "header": {
            "description": "Very short label displayed as a chip/tag (max 12 chars). Examples: \"Auth method\", \"Library\", \"Approach\".",
            "type": "string"
          },
          "multiSelect": {
            "default": false,
            "description": "Set to true to allow the user to select multiple options instead of just one.",
            "type": "boolean"
          },
          "options": {
            "description": "The available choices (2-4 options).",
            "type": "array",
            "minItems": 2,
            "maxItems": 4,
            "items": {
              "additionalProperties": false,
              "properties": {
                "label": {
                  "description": "Display text, concise (1-5 words).",
                  "type": "string"
                },
                "description": {
                  "description": "Explanation of the option / trade-offs.",
                  "type": "string"
                },
                "preview": {
                  "description": "Optional markdown preview (code, mockup…). Only for single-select. Triggers side-by-side layout.",
                  "type": "string"
                }
              },
              "required": ["label", "description"]
            }
          }
        },
        "required": ["question", "header", "options", "multiSelect"]
      }
    },
    "answers": {
      "description": "User answers collected by the component. Keyed by question text.",
      "type": "object",
      "additionalProperties": { "type": "string" }
    },
    "annotations": {
      "description": "Per-question annotations from the user (notes on preview selections). Keyed by question text.",
      "type": "object",
      "additionalProperties": {
        "additionalProperties": false,
        "properties": {
          "notes": { "type": "string" },
          "preview": { "type": "string" }
        }
      }
    },
    "metadata": {
      "description": "Optional metadata for analytics. Not displayed to the user.",
      "additionalProperties": false,
      "properties": {
        "source": {
          "description": "Identifier for the source of this question (e.g. \"remember\").",
          "type": "string"
        }
      }
    }
  },
  "required": ["questions"]
}
```

**Key constraints at a glance**

| Rule                            | Value                                         |
| ------------------------------- | --------------------------------------------- |
| Questions per call              | 1 – 4                                         |
| Options per question            | 2 – 4                                         |
| `header` max length             | ~12 chars                                     |
| `preview` allowed on            | single-select only                            |
| "Other / Type something" option | auto-injected by the UI — do not add manually |
