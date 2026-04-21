# UI Layout

## Layout system

Pi uses full-width separator lines. No box border.

```text
────────────────────────────────────────────────────────────────────────────────
[tab bar — only for multi-question forms]

 Question text in bold ?
 Description in dim (max 4 lines)

[input widget]

 ✘ Error message (if validation fails)

 Footer keyboard hints
────────────────────────────────────────────────────────────────────────────────
```

Single-question forms hide the tab bar entirely. The rest of the layout is identical.

## Tab bar

When the call contains more than one question, a tab/chip bar is rendered between the separators. Each chip shows:

- A state symbol (`✔` answered / `·` pending / `✦` required pending / `≡` review)
- The `header` label (truncated to 20 chars max)
- `[…]` brackets around the active chip

```text
 ≺  ✔ [Interests] │ ·  Vibe Check  │ ✦  Feedback  │ ≡  Review  ≻
```

When too many tabs exist to fit on one line, the overflow sides show `…` ellipsis chips. The expand-from-active algorithm starts from the active tab and alternately adds tabs left and right until the width is exhausted:

```text
≺  …  │ ✔  Interests  │ · [Vibe Check] │ ✦  Feedback  │  …  ≻
```

Arrows `≺` `≻` are pushed to the terminal edges when overflow is present.

## Input widgets

### Text input

```text
 > typed text here           ← Editor with terminal cursor
 > placeholder dim           ← when empty (placeholder in dim)
```

**Keyboard:** Enter → validate and advance · All printable keys → forwarded to Editor · Shift+Enter → blocked (single-line) · Tab/Shift+Tab, Escape → not consumed (handled by Tabs/Form)

### Number input

```text
 > 42                        ← Editor with terminal cursor
 > 8080                      ← dim placeholder when empty
 0 [──────────●──────] 100   ← slider when both min and max are set
```

**Keyboard:** 0-9, `-`, `.`, `e`/`E` → inserted (rejected if result is invalid number prefix) · ↑/↓ → increment/decrement by step · Enter → validate and advance · Backspace, ←/→ → forwarded to Editor

### Choice input (single-select)

```text
│ › 1. [✔] TypeScript             ← │ = scrollbar track, ┃ = thumb
┃   2. [ ] Rust                   ← ›  = cursor (accent)
│   3. [ ] Python                 ← [✔] = selected (green checkmark)
│   4. [ ] Go                     ← [ ] = unselected (dim)
```

With option descriptions (inline when they fit):

```text
│ › 1. [✔] TypeScript  ─ Strongly typed superset of JS
┃   2. [ ] Rust         ─ Memory safe, zero-cost abstractions
│   3. [ ] Python       ─ Dynamic, extensive ecosystem
```

Scrollbar appears when options exceed 4 visible rows. `▲` and `▼` arrows show above/below the list when scrollable.

**Keyboard:** ↑/↓ → move cursor · Space → select (clear-all + pick; cannot deselect) · Enter → advance · Space on "Other…" row → opens inline editor

### Multichoice input (multi-select)

Same rendering as choice. Differences in behavior:

- Space toggles freely (select or deselect)
- Multiple options can be selected simultaneously
- `minSelections`/`maxSelections` are accepted in the schema but **not enforced in the UI** — treat them as advisory metadata for now

**Keyboard:** ↑/↓ → move cursor · Space → toggle checkbox · Enter → advance (blocked if required and nothing selected)

### Boolean input

```text
 ✔ Yes                  ← checkmark + trueColor when selected
   No                   ← dim when not selected
```

Or with custom labels:

```text
   Keep                 ← dim when not selected
 ✘ Overwrite            ← ✘ + falseColor when selected
```

**Keyboard:** ↑/↓ → toggle between Yes and No · Y → select Yes · N → select No · Enter → confirm and advance

### "Other…" row (choice/multichoice)

The "Other…" row appears at the bottom of choice/multichoice lists unless `allowOther: false`:

```text
   3. [ ] Other...      ← default state (dim)
   3. [✔] Other: text   ← after entering custom text
   3. [✔] editor▏       ← inline editor while typing
```

**Keyboard (Other mode):** Enter → confirm text and advance · Escape → discard and exit Other mode · Erasing all text → auto-exits Other mode

## Color system

| Element                                    | Color                |
| ------------------------------------------ | -------------------- |
| `✔` symbol and answered chip label         | green (`success`)    |
| `·` symbol and pending optional chip label | dim                  |
| `✦` symbol and required pending chip label | orange (`warning`)   |
| `[active]` chip brackets and label         | text (never colored) |
| `≺` `≻` `│` decorators                     | dim                  |
| `›` option cursor                          | accent               |
| `[✔]` checkbox checkmark                   | green (`success`)    |
| `[ ]` empty checkbox                       | dim                  |
| Option label (cursor row)                  | accent               |
| Option label (selected, not cursor)        | text                 |
| Option label (unselected, not cursor)      | muted                |
| Option description                         | dim                  |
| `✘` error message                          | red (`error`)        |
| `⚠` optional-unanswered warning            | orange (`warning`)   |
| Question text                              | bold text            |
| Description text                           | dim                  |
| Footer hints                               | dim                  |
| Separator lines `─`                        | accent               |
| Placeholder text (text/number)             | dim                  |
| `(not answered)` in review                 | dim                  |
| Number slider track `─`                    | dim                  |
| Number slider thumb `●`                    | accent               |
| Scrollbar track `│`                        | dim                  |
| Scrollbar thumb `┃`                        | accent               |
| Scroll arrows `▲` `▼`                      | dim                  |

### Review tab `≡` color

The `≡` symbol and "Review" label are colored based on the overall completion state:

| Completion state                              | Color              |
| --------------------------------------------- | ------------------ |
| One or more **required** questions unanswered | red (`error`)      |
| Only **optional** questions unanswered        | orange (`warning`) |
| All questions answered                        | green (`success`)  |

The `[ ]` brackets on the active chip are never colored regardless of the review state.

## Review screen

The review screen shows a scrollable summary of all answers. Submission is always available via Enter — unanswered required questions trigger a warning banner but do not block submission.

```text
 Review your answers:

 ✘ 2 required questions unanswered      ← warning line

│ What is 1? ····· Answer 1             ← scrollbar + question + dots + value
┃ What is 2? ····· Answer 2
│ What is 3? ····· (not answered)       ← dim when unanswered

 Enter submit · Tab/Shift+Tab edit · Esc cancel · ↑/↓ scroll
```

### Warning line

| State                                | Banner                                         |
| ------------------------------------ | ---------------------------------------------- |
| Required question(s) unanswered      | `✘ N required question(s) unanswered` (red)    |
| Only optional question(s) unanswered | `⚠ N optional question(s) unanswered` (orange) |
| All answered                         | blank line (preserves stable height)           |

### Review scrolling

When questions exceed `visibleCount` (= `maxH - 6`), a scrollbar appears on the left. The frame height stays constant while scrolling (blank padding fills unused rows). ↑/↓ moves the viewport; the scrollbar thumb tracks position.

### Review question styling

- Unanswered **required** questions → header in warning color
- Answered/optional questions → header in accent color
- Values → plain text, truncated to available width
- Unanswered values → `(not answered)` in dim

## Exit confirmation

Pressing Escape (outside the "Other…" editor) shows a confirmation dialog:

```text
 ⚠ Are you sure you want to quit?
   All answers will be lost.

 [Y]es, quit  ·  [N]o, continue
```

**Keyboard:** Y → quit (cancel form) · N → dismiss dialog · Enter → confirm highlighted option · ←/→ → toggle highlight between Y and N · Any other key → dismiss dialog

The selected option is shown in bold text; the other is dim.

## Footer

The footer keyboard hint line adapts to the active input and form context. Hints are joined with `·` separators.

### Per-input hints

| Input type           | Hints                                             |
| -------------------- | ------------------------------------------------- |
| Text                 | `Enter next`                                      |
| Number               | `↑/↓ ±{step} · Enter next`                        |
| Boolean              | `↑/↓ choose · Enter next`                         |
| Choice / Multichoice | `↑/↓ navigate · Space select/toggle · Enter next` |
| Choice (Other mode)  | `Enter confirm · Esc cancel`                      |

### Global hints (appended after input hints)

| Context        | Additional hints                |
| -------------- | ------------------------------- |
| Multi-question | `Tab/Shift+Tab switch question` |
| Always         | `Esc quit`                      |

### Review screen footer

```text
 Enter submit · Tab/Shift+Tab edit · Esc cancel · ↑/↓ scroll
```

The `↑/↓ scroll` hint only appears when the question list is scrollable.

---

See [`styles/`](./styles/) for annotated renders of every state and input type combination across pi, Claude Code, and Gemini.
