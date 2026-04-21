<!-- markdownlint-disable MD040 MD036 -->

# AskUserQuestion — Pi Layout Reference

Visual reference for all TUI states and component variants.
Color annotations are shown as inline comments after each render.

---

## Legend

| Symbol           | Meaning                              | Color                  |
| ---------------- | ------------------------------------ | ---------------------- |
| `✔`              | Question answered                    | green                  |
| `·`              | Question pending (optional)          | dim                    |
| `✦`              | Question pending (required)          | orange                 |
| `≡`              | Review tab                           | dim                    |
| `[…]`            | Active tab                           | white / bright         |
| `›`              | Focused option (cursor)              | accent                 |
| `[✔]`            | Selected checkbox                    | green (checkmark only) |
| `[ ]`            | Unselected checkbox                  | normal                 |
| `✘`              | Blocking error (required unanswered) | red                    |
| `❕`             | Warning (optional unanswered)        | orange                 |
| `(not answered)` | Missing answer in review             | dim                    |

---

## 1. Separator & Frame

Pi uses full-width separator lines, same system as Claude Code. No box border.

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
[content area]
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
[footer — keyboard hints]
```

---

## 2. Tabs

### 2a. No tab bar — single question

When the call contains exactly one question, the tab bar is hidden entirely.

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

 Which programming language do you prefer working with most?

  1. TypeScript
     └─ Static typing, fast execution, large ecosystem
› 2. Rust
     └─ Memory safety, performance, systems programming
  3. Python
     └─ Simplicity, data science, machine learning

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Enter to select · ↑/↓ to navigate · Esc to cancel
```

```text
# Colors:
# › ─── accent
```

---

### 2b. First question active

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  ✔ [Interests] │ ·  Vibe Check  │ ✦  Feedback  │ ≡  Review   ≻
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
```

```text
# Colors:
# ≺ ≻ ─── dim
# ✔ ─── green ; [Interests] ─── white/bright (active, brackets visible)
# · Vibe Check ─── dim
# ✦ ─── orange ; Feedback ─── orange
# ≡ Review ─── dim
```

---

### 2c. Middle question active

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  ✔  Interests  │ · [Vibe Check] │ ✦  Feedback  │ ≡  Review   ≻
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
```

```text
# Colors:
# ✔ Interests ─── green, dim (not active)
# [Vibe Check] ─── white/bright (active)
# ✦ Feedback ─── orange
# ≡ Review ─── dim
```

---

### 2d. Required question active

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  ✔  Interests  │ ·  Vibe Check  │ ✦ [Feedback] │ ≡  Review   ≻
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
```

```text
# Colors:
# ✔ Interests ─── green, dim
# · Vibe Check ─── dim
# ✦ ─── orange ; [Feedback] ─── white/bright (active, still shows ✦ for required)
# ≡ Review ─── dim
```

---

### 2e. Review tab active (all answered)

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  ✔  Interests  │ ✔  Vibe Check  │ ✔  Feedback  │ ≡ [Review]  ≻
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
```

```text
# Colors:
# all ✔ ─── green, dim (not active)
# ≡ [Review] ─── white/bright (active)
```

---

### 2f. Tab overflow — right side hidden

When there are more questions than fit in the header width, the overflow side shows `…`.

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  ✔ [Interests] │ ·  Vibe Check  │ ✦  Feedback  │  …  ≻
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
```

```text
# Colors:
# [Interests] ─── white/bright (active)
# … ─── dim, indicates more tabs to the right
```

---

### 2g. Tab overflow — left side hidden

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  …  │ ✦  Feedback  │ ·  Stack  │ ·  Timeline  │ ≡ [Review]  ≻
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
```

```
# Colors:
# … ─── dim, indicates more tabs to the left
# ≡ [Review] ─── white/bright (active)
```

---

### 2h. Tab overflow — both sides

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  …  │ ✔  Interests  │ · [Vibe Check] │ ✦  Feedback  │  …  ≻
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
```

```
# Colors:
# both … ─── dim
# [Vibe Check] ─── white/bright (active)
```

---

## 3. Question Description

Optional markdown text rendered below the question. Supports **bold**, _italic_, underline. Hard limit: 3–4 lines.

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  ✔ [Interests] │ ·  Vibe Check  │ ✦  Feedback  │ ≡  Review   ≻

 Which aspects of software engineering do you enjoy most?
 This helps us tailor suggestions to your workflow. Select **all that apply**.

  1. Code Investigation
     └─ Researching and analyzing codebases
› 2. Development
     └─ Implementing new features or fixing bugs

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Enter to select · ←/→ to switch questions · Esc to cancel
```

```
# Colors:
# description line ─── dim, with bold rendered if terminal supports it
```

---

## 4. Choice — Single Select

### 4a. Simple (3 options, no scroll)

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  ·  Language  │ ·  Projects  │ ≡  Review   ≻

 Which programming language do you prefer working with most?

  1. TypeScript
     └─ Static typing, fast execution, large ecosystem
› 2. Rust
     └─ Memory safety, performance, systems programming
  3. Python
     └─ Simplicity, data science, machine learning
  4. Other...

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Enter to select · ←/→ to switch questions · Esc to cancel
```

```
# Colors:
# › ─── accent
# 4. Other... ─── auto-injected by UI, dim
# option labels ─── normal
# option descriptions ─── dim
```

---

### 4b. With scroll (5+ options, ▲/▼ visible)

Scroll arrows appear when the option list exceeds the visible window (4–5 options max before scrolling).

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  ·  Language  │ ·  Projects  │ ≡  Review   ≻

 Which programming language do you prefer working with most?

 ▲
  1. TypeScript
     └─ Static typing, fast execution, large ecosystem
› 2. Rust
     └─ Memory safety, performance, systems programming
  3. Python
     └─ Simplicity, data science, machine learning
  4. Go
     └─ Concurrency primitives, fast compilation
 ▼

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Enter to select · ←/→ to switch questions · Esc to cancel
```

```
# Colors:
# ▲ ▼ ─── dim (visible only when content overflows)
# › ─── accent
```

---

### 4c. With allowOther: false (2 options — binary choice)

Use `choice` with 2 options and `allowOther: false` for binary/agree-disagree questions. Replaces the former `yesno` type.

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  ✔  Interests  │ ✦ [Agreement] │ ≡  Review   ≻

 Do you agree with this proposed approach?

› 1. Agree
     └─ I'm on board with this direction
  2. Disagree
     └─ I have concerns or a different preference

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Enter to select · ←/→ to switch questions · Esc to cancel
```

```
# Colors:
# ✦ [Agreement] ─── orange symbol, white label (active + required)
# › ─── accent
# No "Other..." option — allowOther: false
```

---

## 5. Choice — Multi Select

### 5a. Simple (3 options, some checked)

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  · [Interests] │ ✦  Stack  │ ≡  Review   ≻

 Which aspects of software engineering do you enjoy most?
 Select all that apply.

  1. [✔] Code Investigation
         └─ Researching and analyzing codebases
› 2. [ ] Development
         └─ Implementing new features or fixing bugs
  3. [✔] DevOps/Config
         └─ Configuring environments and CI/CD
  4. [ ] Other...

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Enter to toggle · ←/→ to switch questions · Esc to cancel
```

```
# Colors:
# [✔] ─── brackets normal, ✔ green
# [ ] ─── dim
# › ─── accent
# "Select all that apply." ─── dim (description field)
# 4. Other... ─── auto-injected, dim
```

---

### 5b. Multi select with scroll (5+ options, some checked)

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  · [Interests] │ ✦  Stack  │ ≡  Review   ≻

 Which aspects of software engineering do you enjoy most?
 Select all that apply.

 ▲
   1. [✔] Code Investigation
          └─ Researching and analyzing codebases
 › 2. [ ] Development
          └─ Implementing new features or fixing bugs
   3. [✔] DevOps/Config
          └─ Configuring environments and CI/CD
   4. [ ] Architecture & Design
          └─ System design, patterns, and best practices
 ▼

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Enter to toggle · ←/→ to switch questions · Esc to cancel
```

```
# Colors:
# ▲ ▼ ─── dim
# [✔] ─── brackets normal, ✔ green
# › ─── accent
```

---

## 6. Text Input

### 6a. Empty — placeholder visible

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  ✔  Interests  │ · [Feedback] │ ≡  Review   ≻

 Is there anything specific you'd like me to help you with right now?

 > Type your feedback here...

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Enter to submit · Tab/Shift+Tab to switch questions · Esc to cancel
```

```
# Colors:
# > ─── accent
# input field ─── contrasted background, full width
# placeholder text ─── dim
# footer uses Tab/Shift+Tab instead of ←/→ (arrows reserved for text cursor)
```

---

### 6b. With content typed

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  ✔  Interests  │ · [Feedback] │ ≡  Review   ≻

 Is there anything specific you'd like me to help you with right now?

 > Better error messages in the CLI output_

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Enter to submit · Tab/Shift+Tab to switch questions · Esc to cancel
```

```
# Colors:
# > ─── accent
# typed text ─── normal (on contrasted background)
# _ ─── blinking cursor
```

---

### 6c. Validation error — format mismatch

Shown after the user presses Enter with an invalid value. The error appears inline below the field.

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  ✔  Interests  │ ✦ [Server IP] │ ≡  Review   ≻

 What is the IP address of your production server?

 > not-an-ip-address_

 ✘ Invalid format — expected a valid IPv4 address (e.g. 192.168.1.1)

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Enter to submit · Tab/Shift+Tab to switch questions · Esc to cancel
```

```
# Colors:
# > ─── accent
# input field ─── contrasted background, red border or tint on error
# ✘ error line ─── red
```

---

### 6d. Validation error — custom errorMessage

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  ✔  Interests  │ ✦ [Port] │ ≡  Review   ≻

 Which port should the server listen on?

 > 99999_

 ✘ Port must be between 1 and 65535

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Enter to submit · Tab/Shift+Tab to switch questions · Esc to cancel
```

```
# Colors:
# ✘ error ─── red (uses errorMessage from schema)
```

---

## 7. Review Screen

### 7a. All questions answered

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  ✔  Interests  │ ✔  Vibe Check  │ ✔  Feedback  │ ≡ [Review]  ≻

 Review your answers:

 Interests  → Code Investigation, DevOps/Config
 Vibe Check → Yes
 Feedback   → Better error messages in the CLI output

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Enter to submit · Tab/Shift+Tab to edit answers · Esc to cancel
```

```
# Colors:
# question headers (Interests, Vibe Check…) ─── bold
# answers ─── normal
# → separator ─── dim
# › ─── accent
```

---

### 7b. Required question unanswered — blocks submission

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  ✔  Interests  │ ·  Vibe Check  │ ✦  Feedback  │ ≡ [Review]  ≻

 Review your answers:

 ✘ You have 1 unanswered required question

 Interests  → Code Investigation, DevOps/Config
 Vibe Check → (not answered)
 Feedback   → (not answered)

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Enter to submit · Tab/Shift+Tab to edit answers · Esc to cancel
```

```
# Colors:
# ✘ warning line ─── red
# Feedback row ─── orange (required, unanswered)
# (not answered) ─── dim
# "Submit anyway" is still available but de-emphasized
```

---

### 7c. Optional questions unanswered — warning only

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  ✔  Interests  │ ·  Vibe Check  │ ·  Feedback  │ ≡ [Review]  ≻

 Review your answers:

 ⚠ You have 2 unanswered questions

 Interests  → Code Investigation, DevOps/Config
 Vibe Check → (not answered)
 Feedback   → (not answered)

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Enter to submit · Tab/Shift+Tab to edit answers · Esc to cancel
```

```
# Colors:
# ⚠ warning line ─── orange
# (not answered) ─── dim
# Vibe Check, Feedback rows ─── normal (not required, so no orange highlight)
# Submit is available and primary
```

---

### 7d. Mixed — one required unanswered, one optional unanswered

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  ✔  Interests  │ ✦  Feedback  │ ·  Notes  │ ≡ [Review]  ≻

 Review your answers:

 ✘ You have 1 unanswered required question

 Interests → Code Investigation, DevOps/Config
 Feedback  → (not answered)
 Notes     → (not answered)

 Answer required questions before submitting.

› 1. Go back
  2. Submit anyway

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Enter to select · Tab/Shift+Tab to edit answers · Esc to cancel
```

```
# Colors:
# ✘ line ─── red (because at least one required is missing)
# Feedback row ─── orange (required, unanswered)
# Notes row ─── normal (optional, unanswered — not highlighted)
# (not answered) ─── dim in both rows
```

---

## 8. Footer Variants

Three footer modes depending on context:

### 8a. Choice / single question

```text
 Enter to select · ←/→ to switch questions · Esc to cancel
```

### 8b. Multi-select (toggle mode)

```text
 Enter to toggle · ←/→ to switch questions · Esc to cancel
```

### 8c. Text input (arrows reserved for cursor)

```text
 Enter to submit · Tab/Shift+Tab to switch questions · Esc to cancel
```

### 8d. Review screen

```text
 Enter to submit · Tab/Shift+Tab to edit answers · Esc to cancel
```

### 8e. Single question (no tab navigation hint)

```text
 Enter to select · ↑/↓ to navigate · Esc to cancel
```

---

## 9. Full Flow Examples

### 9a. Multi-question flow — all three input types

**Input JSON**

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
        },
        { "label": "Architecture", "description": "System design and patterns" }
      ]
    },
    {
      "question": "Are you having a productive day so far?",
      "header": "Vibe Check",
      "type": "choice",
      "multiSelect": false,
      "allowOther": false,
      "options": [
        { "label": "Yes", "description": "Things are going well" },
        { "label": "No", "description": "Could be better" }
      ]
    },
    {
      "question": "Is there anything specific you'd like me to help you with right now?",
      "header": "Feedback",
      "type": "text",
      "required": true,
      "placeholder": "Type your feedback here..."
    }
  ]
}
```

**Screen 1 — Multi-select (Interests)**

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  · [Interests] │ ·  Vibe Check  │ ✦  Feedback  │ ≡  Review   ≻

 Which aspects of software engineering do you enjoy most?
 Select all that apply.

  1. [✔] Code Investigation
          Researching and analyzing codebases
› 2. [ ] Development
          Implementing new features or fixing bugs
  3. [✔] DevOps/Config
          Configuring environments and CI/CD
  4. [ ] Architecture
          System design and patterns
  5. [ ] Other...

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Enter to toggle · ←/→ to switch questions · Esc to cancel
```

**Screen 2 — Single select / binary choice (Vibe Check)**

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  ✔  Interests  │ · [Vibe Check] │ ✦  Feedback  │ ≡  Review   ≻

 Are you having a productive day so far?

› 1. Yes
      Things are going well
  2. No
      Could be better

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Enter to select · ←/→ to switch questions · Esc to cancel
```

**Screen 3 — Text input (Feedback, required)**

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  ✔  Interests  │ ✔  Vibe Check  │ ✦ [Feedback] │ ≡  Review   ≻

 Is there anything specific you'd like me to help you with right now?

 > Better error messages in the CLI output_

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Enter to submit · Tab/Shift+Tab to switch questions · Esc to cancel
```

**Screen 4 — Review (all answered)**

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  ✔  Interests  │ ✔  Vibe Check  │ ✔  Feedback  │ ≡ [Review]  ≻

 Review your answers:

 Interests  → Code Investigation, DevOps/Config
 Vibe Check → Yes
 Feedback   → Better error messages in the CLI output

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Enter to submit · Tab/Shift+Tab to edit answers · Esc to cancel
```

---

### 9b. Single question — no tabs, with scroll

**Input JSON**

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
        },
        {
          "label": "Go",
          "description": "Concurrency primitives, fast compilation"
        },
        {
          "label": "Elixir",
          "description": "Fault-tolerant, functional, BEAM VM"
        }
      ]
    }
  ]
}
```

**Render**

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

 Which programming language do you prefer working with most?

 ▲
  1. TypeScript
      Static typing, fast execution, large ecosystem
› 2. Rust
      Memory safety, performance, systems programming
  3. Python
      Simplicity, data science, machine learning
  4. Go
      Concurrency primitives, fast compilation
 ▼

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Enter to select · ↑/↓ to navigate · Esc to cancel
```

```
# No tab bar — single question
# ▲/▼ ─── dim, signals Elixir exists below (and more above if scrolled)
# › ─── accent
# footer has no ←/→ hint — no other questions to navigate to
```

---

### 9c. Text input with validation

**Input JSON**

```json
{
  "questions": [
    {
      "question": "What is the IP address of your production server?",
      "header": "Server IP",
      "type": "text",
      "required": true,
      "placeholder": "e.g. 192.168.1.1",
      "validation": {
        "format": "ipv4",
        "errorMessage": "Must be a valid IPv4 address (e.g. 192.168.1.1)"
      }
    },
    {
      "question": "Which port should the server listen on?",
      "header": "Port",
      "type": "text",
      "required": true,
      "placeholder": "e.g. 8080",
      "validation": {
        "format": "integer",
        "min": 1,
        "max": 65535,
        "errorMessage": "Port must be between 1 and 65535"
      }
    }
  ]
}
```

**Screen 1 — Valid input**

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  ✦ [Server IP] │ ✦  Port  │ ≡  Review   ≻

 What is the IP address of your production server?

 > 10.0.0.42_

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Enter to submit · Tab/Shift+Tab to switch questions · Esc to cancel
```

**Screen 2 — Invalid input (validation fires on submit)**

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  ✦ [Server IP] │ ✦  Port  │ ≡  Review   ≻

 What is the IP address of your production server?

 > not-an-ip_

 ✘ Must be a valid IPv4 address (e.g. 192.168.1.1)

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Enter to submit · Tab/Shift+Tab to switch questions · Esc to cancel
```

---

## 10. Edge Cases

### 10a. Long header — truncation at 12 chars

Headers exceeding 12 chars are truncated with `…` in the tab.

```text
 ≺  · [Architecture] │ ·  Preferences  │ ≡  Review   ≻
              ↑                ↑
         12 chars          truncated → "Preferenc…"
```

Recommended: keep headers under 12 chars (`Arch`, `Prefs`, `Style`, `Auth`).

---

### 10b. Single required question, unanswered on first Review visit

```text
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ≺  ✦  Feedback  │ ≡ [Review]  ≻

 Review your answers:

 ✘ You have 1 unanswered required question

 Feedback → (not answered)

────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Enter to submit · Tab/Shift+Tab to edit answers · Esc to cancel
```

```
# Colors:
# ✦ Feedback tab ─── orange (required, unanswered)
# ✘ line ─── red
# Feedback row ─── orange
```

---

### 10c. Description too long — rejected at validation

The `description` field on a question has a hard limit of 3–4 rendered lines. If the content exceeds this, it is refused at call time (not truncated silently).

```text
✘ AskUserQuestion: question[1].description exceeds the 4-line limit.
  Keep descriptions concise — they are secondary context, not documentation.
```

---

## Summary — Input type matrix

| Type     | multiSelect | allowOther | scroll         | Tab bar         |
| -------- | ----------- | ---------- | -------------- | --------------- |
| `choice` | false       | true       | if > 4 options | if > 1 question |
| `choice` | false       | false      | if > 4 options | if > 1 question |
| `choice` | true        | true       | if > 4 options | if > 1 question |
| `choice` | true        | false      | if > 4 options | if > 1 question |
| `text`   | —           | —          | —              | if > 1 question |
