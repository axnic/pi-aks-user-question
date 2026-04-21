<!-- markdownlint-disable MD036 -->

# ask_user — UI Views Reference (Gemini)

This document is a technical reference for the `ask_user` component as rendered in Gemini's TUI. Each section presents a view with its JSON input, a visual breakdown, and an honest assessment.

> The JSON Schema is in the [Appendix](#appendix--json-schema).

---

## View 1 — Multi-Select (Choice with Scroll)

**Trigger:** `type: "choice"`, `multiSelect: true`, multiple questions in the call — renders inside a boxed modal with a tab bar and scroll arrows when options overflow.

### Input JSON

```json
{
  "questions": [
    {
      "question": "Which aspects of software engineering do you enjoy most?",
      "header": "Interests",
      "type": "choice",
      "multiSelect": true,
      "options": [
        {
          "label": "Code Investigation",
          "description": "Researching and analyzing codebases"
        },
        {
          "label": "Development",
          "description": "Implementing new features or fixing bugs"
        },
        {
          "label": "DevOps/Config",
          "description": "Configuring environments and CI/CD"
        }
      ]
    },
    {
      "question": "Are you having a productive day so far?",
      "header": "Vibe Check",
      "type": "yesno"
    },
    {
      "question": "Is there anything specific you'd like me to help you with right now?",
      "header": "Feedback",
      "type": "text",
      "placeholder": "Type your feedback here..."
    }
  ]
}
```

### Render

```text
╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Answer Questions                                                                                             │
│                                                                                                              │
│ ← □ Interests │ □ Vibe Check │ □ Feedback │ ≡ Review →                                                       │
│                                                                                                              │
│ Which aspects of software engineering do you enjoy most?                                                     │
│ (Select all that apply)                                                                                      │
│                                                                                                              │
│ ▲                                                                                                            │
│   1. [ ] Code Investigation                                                                                  │
│       Researching and analyzing codebases                                                                    │
│ ● 2. [ ] Development                                                                                         │
│       Implementing new features or fixing bugs                                                               │
│   3. [ ] DevOps/Config                                                                                       │
│       Configuring environments and CI/CD                                                                     │
│ ▼                                                                                                            │
│                                                                                                              │
│ Enter to select · ←/→ to switch questions · Esc to cancel                                                    │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

### Visual Breakdown

| Element                                  | Description                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `╭─╮` box                                | Wraps the entire component — creates a modal-like feel, visually isolated from terminal output.               |
| Tab bar (`□ Interests │ □ Vibe Check …`) | One tab per `header`. `□` = unanswered, `✓` = answered. `≡ Review` is a reserved slot for the summary screen. |
| `▲` / `▼` arrows                         | Scroll indicators — appear when options overflow the visible area (max ~3 visible at once).                   |
| `●` bullet                               | Currently focused option (cursor). Separate from the `[ ]` selection checkbox.                                |
| `[ ]` checkbox                           | Unselected state. Becomes `[✓]` when toggled.                                                                 |
| `(Select all that apply)`                | Auto-injected hint when `multiSelect: true`.                                                                  |
| `←/→` footer                             | Switches between questions when no text input is active.                                                      |

### Assessment

✅ The boxed modal gives the component a clear visual boundary — feels like a deliberate overlay, not an inline prompt.  
✅ The tab bar with `header` chips is clean and shows progress at a glance.  
✅ `▲`/`▼` scroll is a smart solution for overflow — keeps the list compact while signaling that more options exist.  
⚠️ Not a fan of the `□` checkbox inside the tab chips — it clutters the tab label and renders inconsistently across fonts.  
⚠️ The vertical `▲`/`▼` arrows are not the most elegant indicator, but they are functional and especially useful when there are many options.  
⚠️ The box makes the UI feel modal/dynamic — useful, but needs to be tested at different terminal widths.

---

## View 2 — Yes/No Single Select

**Trigger:** `type: "yesno"`. Renders exactly two options with no checkboxes, no scroll arrows.

### Input JSON

```json
{
  "questions": [
    {
      "question": "Which aspects of software engineering do you enjoy most?",
      "header": "Interests",
      "type": "choice",
      "multiSelect": true,
      "options": [
        {
          "label": "Code Investigation",
          "description": "Researching and analyzing codebases"
        },
        {
          "label": "Development",
          "description": "Implementing new features or fixing bugs"
        },
        {
          "label": "DevOps/Config",
          "description": "Configuring environments and CI/CD"
        }
      ]
    },
    {
      "question": "Are you having a productive day so far?",
      "header": "Vibe Check",
      "type": "yesno"
    },
    {
      "question": "Is there anything specific you'd like me to help you with right now?",
      "header": "Feedback",
      "type": "text",
      "placeholder": "Type your feedback here..."
    }
  ]
}
```

> Same call as View 1 — this is the second question in the same multi-question flow.

### Render

```text
╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Answer Questions                                                                                             │
│                                                                                                              │
│ ← ✓ Interests │ □ Vibe Check │ □ Feedback │ ≡ Review →                                                       │
│                                                                                                              │
│ Are you having a productive day so far?                                                                      │
│                                                                                                              │
│   1.  Yes                                                                                                    │
│ ● 2.  No                                                                                                     │
│                                                                                                              │
│ Enter to select · ←/→ to switch questions · Esc to cancel                                                    │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

### Visual Breakdown

| Element             | Description                                                        |
| ------------------- | ------------------------------------------------------------------ |
| `✓ Interests` tab   | The previous question is now marked answered in the tab bar.       |
| No `[ ]` checkboxes | `yesno` type renders plain numbered options — no checkbox clutter. |
| No `▲`/`▼` arrows   | Exactly two options, no scroll needed.                             |
| `●` bullet          | Navigation cursor only. Confirms on Enter.                         |

### Assessment

✅ Stripping the checkboxes for a binary choice is the right call — simpler and cleaner.  
✅ No scroll arrows needed; the layout breathes.  
⚠️ The `✓` checkmark used in the tab bar (`✓ Interests`) renders poorly in some terminal fonts — the glyph is thin and can blend into the surrounding text.  
⚠️ Visually, the `yesno` and `choice` types look almost identical at a glance — the only difference is the absence of `[ ]`. A subtle indicator (e.g., a `(Yes / No)` hint below the question) would help disambiguate.

---

## View 3 — Text Input

**Trigger:** `type: "text"`. Replaces the option list with an inline text field. Keyboard navigation hints adapt automatically.

### Input JSON

```json
{
  "questions": [
    {
      "question": "Which aspects of software engineering do you enjoy most?",
      "header": "Interests",
      "type": "choice",
      "multiSelect": true,
      "options": [
        {
          "label": "Code Investigation",
          "description": "Researching and analyzing codebases"
        },
        {
          "label": "Development",
          "description": "Implementing new features or fixing bugs"
        },
        {
          "label": "DevOps/Config",
          "description": "Configuring environments and CI/CD"
        }
      ]
    },
    {
      "question": "Are you having a productive day so far?",
      "header": "Vibe Check",
      "type": "yesno"
    },
    {
      "question": "Is there anything specific you'd like me to help you with right now?",
      "header": "Feedback",
      "type": "text",
      "placeholder": "Type your feedback here..."
    }
  ]
}
```

> Same call — this is the third question, rendered when the user navigates to the `Feedback` tab.

### Render

```text
╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Answer Questions                                                                                             │
│                                                                                                              │
│ ← ✓ Interests │ □ Vibe Check │ □ Feedback │ ≡ Review →                                                       │
│                                                                                                              │
│ Is there anything specific you'd like me to help you with right now?                                         │
│                                                                                                              │
│ > Type your feedback here...                                                                                 │
│                                                                                                              │
│                                                                                                              │
│ Enter to submit · Tab/Shift+Tab to switch questions · Esc to cancel                                          │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

### Visual Breakdown

| Element          | Description                                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `> …` prompt     | Inline text field rendered with a `>` cursor prefix. The `placeholder` value is shown dimmed until the user types.                                                                         |
| Background color | The input row should render with a distinct background color to visually distinguish the active field.                                                                                     |
| Footer hint swap | On `choice`/`yesno` views: `←/→ to switch questions`. On `text` views: `Tab/Shift+Tab to switch questions`. This is because `←`/`→` are consumed by text cursor movement inside the field. |

### Assessment

✅ **This is the missing piece from the Claude Code UI.** A proper text input as a first-class question type is essential.  
✅ The adaptive keyboard hint is smart and correct UX — arrow keys must not compete with text navigation.  
✅ The `placeholder` field (`"Type your feedback here..."`) maps directly to a schema property — easy to customize per question.  
✅ The distinct background color on the input row (implied by the design) makes the active field immediately legible.  
⚠️ The `>` prefix is functional but plain. A slightly styled prompt character or input box border would reinforce the "editable field" affordance.

---

## View 4 — Review Screen

**Trigger:** User navigates to the `≡ Review` tab in the header. UI-generated — no direct JSON input field.

### Render

```text
╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Answer Questions                                                                                             │
│                                                                                                              │
│ ← ✓ Interests │ □ Vibe Check │ □ Feedback │ ≡ Review →                                                       │
│                                                                                                              │
│ Review your answers:                                                                                         │
│                                                                                                              │
│ ⚠ You have 2 unanswered questions                                                                            │
│                                                                                                              │
│ Interests  → Code Investigation, Development                                                                 │
│ Vibe Check → (not answered)                                                                                  │
│ Feedback   → (not answered)                                                                                  │
│                                                                                                              │
│ Enter to submit · Tab/Shift+Tab to edit answers · Esc to cancel                                              │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

### Visual Breakdown

| Element                             | Description                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| `≡ Review` tab                      | Reserved slot always present at the end of the tab bar — the `≡` glyph signals a summary/list view. |
| `⚠ You have N unanswered questions` | Count-based warning, not just a boolean flag. More specific than Claude Code's version.             |
| `Header → answer` format            | One line per question using the `header` as the key. Compact and scannable.                         |
| `(not answered)`                    | Shown in orange — stands out without being alarming.                                                |
| Footer                              | `Tab/Shift+Tab to edit answers` — lets the user jump back to any question directly.                 |

### Assessment

✅ **Preferred over Claude Code's review screen.** The one-liner format (`Header → answer`) is significantly more readable at a glance.  
✅ Using `header` as the label (not the full question text) keeps each row short and consistent.  
✅ The `(not answered)` state in orange is clear and visually distinct without being aggressive.  
✅ Showing a count (`2 unanswered`) is more informative than a generic warning.  
✅ `Tab/Shift+Tab to edit answers` in the footer provides a direct path back to individual questions.

---

## View 5 — Single-Question Select (Minimal Chrome)

**Trigger:** Only one question in the call. The UI drops the tab bar and renders a focused, minimal single-question layout with scroll and a hard cap of 3 visible options.

### Input JSON

```json
{
  "questions": [
    {
      "question": "Which programming language do you prefer working with most?",
      "header": "Language",
      "type": "choice",
      "multiSelect": false,
      "options": [
        {
          "label": "TypeScript",
          "description": "Static typing, fast execution, large ecosystem"
        },
        {
          "label": "Rust",
          "description": "Memory safety, performance, systems programming"
        },
        {
          "label": "Python",
          "description": "Simplicity, data science, machine learning"
        }
      ]
    }
  ]
}
```

### Render

```text
╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ Answer Questions                                                                                             │
│                                                                                                              │
│ Which programming language do you prefer working with most?                                                  │
│                                                                                                              │
│ ▲                                                                                                            │
│ ● 1.  TypeScript                                                                                             │
│       Static typing, fast execution, large ecosystem                                                         │
│   2.  Rust                                                                                                   │
│       Memory safety, performance, systems programming                                                        │
│   3.  Python                                                                                                 │
│       Simplicity, data science, machine learning                                                             │
│ ▼                                                                                                            │
│                                                                                                              │
│ Enter to select · ↑/↓ to navigate · Esc to cancel                                                            │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

### Visual Breakdown

| Element                     | Description                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| No tab bar                  | Single-question calls strip the navigation header — no progress chips, no `≡ Review`. Cleaner, more focused.                   |
| `▲`/`▼` + 3 visible options | The scroll system caps visible items at 3. Even if you have 4 options, only 3 are shown at once with an arrow indicating more. |
| `●` bullet                  | Navigation cursor for the focused option. No `[ ]` checkboxes (single-select).                                                 |
| `↑/↓ to navigate`           | Footer uses vertical arrows — consistent with option scrolling in this single-focus context.                                   |

### Assessment

✅ **Very clean.** Removing the tab bar for single-question calls is the right call — less chrome, more focus.  
✅ The 3-item visible cap with scroll is a good constraint — keeps the box height predictable and consistent.  
✅ The `▲`/`▼` scroll pattern works well here; with a fixed-height box, it's the natural solution for overflow.  
⚠️ The `●` cursor and the lack of a `[ ]` checkbox could confuse users who navigated from a multi-select view. A subtle visual cue (e.g., `○` for single-select cursor vs `●` for confirmed selection) could help.

---

## Overall Assessment

This is a strong UI style overall — more polished than the Claude Code reference in several key areas.

| Pattern                  | Status                                                                      |
| ------------------------ | --------------------------------------------------------------------------- |
| Multi-select with scroll | ✅ Good — box + scroll works, refine the `□` tab checkbox                   |
| Yes/No select            | ✅ Fine — checkmark glyph in tab renders poorly, needs font testing         |
| **Text input**           | ✅ **Top — this is the missing piece. Adaptive hints are excellent.**       |
| **Review screen**        | ✅ **Preferred. 1-line format + orange "not answered" is the right model.** |
| Single-question select   | ✅ Very clean, 3-item scroll cap is a good constraint                       |

### Ideas Worth Importing

The following patterns from this style are worth pulling into the final design:

| Pattern                                          | Why                                                      |
| ------------------------------------------------ | -------------------------------------------------------- |
| `type: "text"` with `placeholder`                | First-class text input, no workaround needed             |
| Adaptive footer hints (`←/→` vs `Tab/Shift+Tab`) | Correct and smart — arrow keys belong to text navigation |
| `Header → answer` format in Review               | More compact and readable than full question text        |
| `(not answered)` in orange                       | Clear state, non-blocking, appropriately visible         |
| 3-item visible cap + `▲`/`▼` scroll              | Keeps box height predictable; scales to more options     |
| Boxed modal frame (`╭─╮`)                        | Clear visual boundary; feels intentional, not inline     |

---

## Appendix — JSON Schema

```json
{
  "type": "object",
  "properties": {
    "questions": {
      "type": "array",
      "minItems": 1,
      "maxItems": 4,
      "items": {
        "type": "object",
        "properties": {
          "question": {
            "type": "string",
            "description": "The full question to ask the user."
          },
          "header": {
            "type": "string",
            "description": "Short label shown as a tab/chip (e.g. 'Auth', 'Config')."
          },
          "type": {
            "type": "string",
            "enum": ["choice", "text", "yesno"],
            "default": "choice",
            "description": "The question type. 'choice' = option list. 'yesno' = binary. 'text' = free-form input."
          },
          "options": {
            "type": "array",
            "minItems": 2,
            "maxItems": 4,
            "description": "Required when type='choice'. List of selectable options.",
            "items": {
              "type": "object",
              "properties": {
                "label": {
                  "type": "string",
                  "description": "Display text for the option (1-5 words)."
                },
                "description": {
                  "type": "string",
                  "description": "Short explanation of the option."
                }
              },
              "required": ["label", "description"]
            }
          },
          "multiSelect": {
            "type": "boolean",
            "description": "If true, allows selecting multiple options. Only valid for type='choice'."
          },
          "placeholder": {
            "type": "string",
            "description": "Hint text shown in the input field. Used for type='text' or the auto-injected 'Other' option."
          }
        },
        "required": ["question", "header", "type"]
      }
    }
  },
  "required": ["questions"]
}
```

**Key constraints at a glance**

| Rule                          | Value                                            |
| ----------------------------- | ------------------------------------------------ |
| Questions per call            | 1 – 4                                            |
| Options per question (choice) | 2 – 4                                            |
| `options` required when       | `type: "choice"`                                 |
| `multiSelect` applies to      | `type: "choice"` only                            |
| `placeholder` applies to      | `type: "text"` or the auto-injected Other option |
| Visible options before scroll | 3 max                                            |
| Single-question calls         | Tab bar is hidden — minimal chrome mode          |
