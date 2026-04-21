/**
 * form/inputs/number.test.ts
 *
 * All tests for NumberInput: state machine, renderWidget, handleInput,
 * and the isValidNumberPrefix guard function.
 *
 * The terminal cursor is emitted by the real Editor (via CURSOR_MARKER) inside
 * the actual TUI — MockEditor does not emit it. Cursor-position behaviour is
 * verified through state (getTypedValue, getReviewValue) rather than raw
 * render output.
 */

import { describe, expect, it, vi } from "vitest";
import { isValidNumberPrefix, NumberInput } from "./number";
import type { InputCallbacks, RenderContext } from "./types";

// ── Identity theme (no ANSI) ──────────────────────────────────────────────────

const theme = {
  fg: (_: string, s: string) => s,
  bold: (s: string) => s,
};

// ── Mock Editor (cursor-aware) ────────────────────────────────────────────────
//
// Simulates the subset of Editor behaviour used by NumberInput:
//   - printable chars inserted at cursor position
//   - backspace (\x7f) deletes the char before the cursor
//   - ← / → move the cursor left / right
//   - setText() resets the text and moves cursor to end
//   - render() returns [text] (no CURSOR_MARKER — that is the real TUI's job)

class MockEditor {
  private _text = "";
  private _cursor = 0;

  getText(): string {
    return this._text;
  }
  setText(t: string): void {
    this._text = t;
    this._cursor = t.length;
  }
  handleInput(data: string): void {
    if (data === "\x7f") {
      // backspace
      if (this._cursor > 0) {
        this._text =
          this._text.slice(0, this._cursor - 1) +
          this._text.slice(this._cursor);
        this._cursor--;
      }
    } else if (data === "\x1b[D") {
      // ← arrow
      if (this._cursor > 0) this._cursor--;
    } else if (data === "\x1b[C") {
      // → arrow
      if (this._cursor < this._text.length) this._cursor++;
    } else if (data.length === 1 && data >= " ") {
      this._text =
        this._text.slice(0, this._cursor) +
        data +
        this._text.slice(this._cursor);
      this._cursor++;
    }
  }
  render(_width: number): string[] {
    return [this._text];
  }
}

function mockEditor() {
  return new MockEditor() as unknown as import("@mariozechner/pi-tui").Editor;
}

function noopCallbacks(): InputCallbacks {
  return {
    onAdvance: vi.fn(),
    onRetreat: vi.fn(),
    onSubmit: vi.fn(),
    onRefresh: vi.fn(),
  };
}

function ctx(
  editor: import("@mariozechner/pi-tui").Editor,
  maxW = 80,
): RenderContext {
  return { theme: theme as any, editor, maxW, maxH: 4 };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const q = {
  id: "count",
  question: "How many?",
  header: "Count",
  type: "number" as const,
  placeholder: 35,
};

const rangeQ = {
  id: "vol",
  question: "Volume?",
  header: "Vol",
  type: "number" as const,
  defaultValue: 50,
  validation: { format: "number" as const, min: 0, max: 100 },
};

// ── isValidNumberPrefix ───────────────────────────────────────────────────────

describe("isValidNumberPrefix", () => {
  it("allows digits", () => {
    expect(isValidNumberPrefix("", "4", 0)).toBe(true);
    expect(isValidNumberPrefix("4", "2", 1)).toBe(true);
  });

  it("allows leading minus", () => {
    expect(isValidNumberPrefix("", "-", 0)).toBe(true);
  });

  it("rejects minus not at position 0 (unless after e/E)", () => {
    expect(isValidNumberPrefix("1", "-", 1)).toBe(false);
  });

  it("allows a single decimal point", () => {
    expect(isValidNumberPrefix("3", ".", 1)).toBe(true);
  });

  it("rejects a second decimal point", () => {
    expect(isValidNumberPrefix("3.1", ".", 3)).toBe(false);
  });

  it("allows scientific notation exponent", () => {
    expect(isValidNumberPrefix("3", "e", 1)).toBe(true);
  });

  it("rejects dot after exponent", () => {
    expect(isValidNumberPrefix("3e", ".", 2)).toBe(false);
  });

  it("rejects double exponent", () => {
    expect(isValidNumberPrefix("3e2", "e", 3)).toBe(false);
  });
});

// ── State machine ─────────────────────────────────────────────────────────────

describe("NumberInput — state machine", () => {
  it("isAnswered() returns false when buffer is empty", () => {
    const ed = mockEditor();
    const input = new NumberInput(q, ed, noopCallbacks());
    expect(input.isAnswered()).toBe(false);
  });

  it("isAnswered() returns true after typing a valid number and pressing Enter", () => {
    const ed = mockEditor();
    const cb = noopCallbacks();
    const input = new NumberInput(q, ed, cb);
    input.handleInput("4");
    input.handleInput("2");
    input.handleInput("\r");
    expect(input.isAnswered()).toBe(true);
    expect(input.getTypedValue()).toBe(42);
  });

  it("isAnswered() returns false for out-of-range value", () => {
    const ed = mockEditor();
    const cb = noopCallbacks();
    const input = new NumberInput(rangeQ, ed, cb);
    input.handleInput("1");
    input.handleInput("5");
    input.handleInput("0"); // 150 > max 100
    input.handleInput("\r");
    expect(input.isAnswered()).toBe(false);
  });

  it("getReviewValue() returns the raw text", () => {
    const ed = mockEditor();
    const cb = noopCallbacks();
    const input = new NumberInput(q, ed, cb);
    input.handleInput("7");
    input.handleInput("\r");
    expect(input.getReviewValue()).toBe("7");
  });

  it("↑ from empty uses placeholder as starting point", () => {
    const ed = mockEditor();
    const input = new NumberInput(q, ed, noopCallbacks()); // placeholder = 35
    input.handleInput("\x1b[A"); // ↑ → 35 + 1 = 36
    expect(input.getTypedValue()).toBe(36);
  });

  it("↓ from empty uses placeholder as starting point", () => {
    const ed = mockEditor();
    const input = new NumberInput(q, ed, noopCallbacks()); // placeholder = 35
    input.handleInput("\x1b[B"); // ↓ → 35 - 1 = 34
    expect(input.getTypedValue()).toBe(34);
  });

  it("↑ increments current value", () => {
    const ed = mockEditor();
    const input = new NumberInput(q, ed, noopCallbacks());
    input.handleInput("1");
    input.handleInput("0");
    input.handleInput("\x1b[A"); // ↑ → 11
    expect(input.getTypedValue()).toBe(11);
  });

  it("value is clamped to max on ↑", () => {
    const ed = mockEditor();
    const input = new NumberInput(rangeQ, ed, noopCallbacks());
    for (let i = 0; i < 200; i++) input.handleInput("\x1b[A");
    expect(input.getTypedValue()).toBe(100);
  });

  it("value is clamped to min on ↓", () => {
    const ed = mockEditor();
    const input = new NumberInput(rangeQ, ed, noopCallbacks());
    for (let i = 0; i < 200; i++) input.handleInput("\x1b[B");
    expect(input.getTypedValue()).toBe(0);
  });

  it("← / → move cursor, backspace deletes at cursor", () => {
    const ed = mockEditor();
    const cb = noopCallbacks();
    const input = new NumberInput(q, ed, cb);
    input.handleInput("4");
    input.handleInput("2");
    input.handleInput("\x1b[D"); // ← — move left (cursor between 4 and 2)
    input.handleInput("\x7f"); // backspace deletes char before cursor (the '4')
    input.handleInput("\r");
    expect(input.getTypedValue()).toBe(2);
  });

  it("no validation error on Enter with empty buffer when optional", () => {
    const ed = mockEditor();
    const input = new NumberInput(q, ed, noopCallbacks()); // q has no required flag
    input.handleInput("\r"); // empty buffer
    expect(input.getValidationError()).toBeUndefined();
  });

  it("validation error set on Enter with empty buffer when required", () => {
    const ed = mockEditor();
    const requiredQ = { ...q, required: true };
    const input = new NumberInput(requiredQ, ed, noopCallbacks());
    input.handleInput("\r"); // empty buffer
    expect(input.getValidationError()).toBeDefined();
  });

  it("activate() loads _rawText into the Editor", () => {
    const ed = mockEditor();
    const input = new NumberInput(q, ed, noopCallbacks());
    input.handleInput("9"); // _rawText = "9" via editor
    input.deactivate(); // ensure _rawText is persisted
    // Manually set _rawText through a series of inputs and test activate syncs
    input.activate(); // should call ed.setText("9")
    expect(ed.getText()).toBe("9");
  });

  it("deactivate() persists the Editor text to _rawText", () => {
    const ed = mockEditor();
    const input = new NumberInput(q, ed, noopCallbacks());
    input.handleInput("5");
    input.handleInput("5"); // editor text = "55"
    input.deactivate(); // should sync _rawText from editor
    // After deactivate, getTypedValue() reads from _rawText
    expect(input.getTypedValue()).toBe(55);
  });
});

// ── renderWidget ──────────────────────────────────────────────────────────────

describe("NumberInput — renderWidget", () => {
  it("shows placeholder when buffer is empty", () => {
    const ed = mockEditor();
    const input = new NumberInput(q, ed, noopCallbacks());
    const lines = input.renderWidget(ctx(ed));
    expect(lines[0]).toContain("35");
  });

  it("shows the typed number in the field line", () => {
    const ed = mockEditor();
    const input = new NumberInput(q, ed, noopCallbacks());
    input.handleInput("4");
    input.handleInput("2");
    const lines = input.renderWidget(ctx(ed));
    expect(lines[0]).toContain("42");
    // The terminal cursor is emitted by the real Editor — not by MockEditor.
    // Verify no literal box-drawing cursor (│) is used instead.
    expect(lines[0]).not.toContain("│");
  });

  it("renders a slider when both min and max are set", () => {
    const ed = mockEditor();
    const input = new NumberInput(rangeQ, ed, noopCallbacks());
    const lines = input.renderWidget(ctx(ed));
    expect(lines).toHaveLength(2); // text field + slider
    expect(lines[1]).toContain("●"); // thumb
    expect(lines[1]).toContain("0"); // min label
    expect(lines[1]).toContain("100"); // max label
  });

  it("no slider when only min is set", () => {
    const minOnlyQ = {
      id: "count",
      question: "How many?",
      header: "Count",
      type: "number" as const,
      validation: { format: "number" as const, min: 0 },
    };
    const ed = mockEditor();
    const input = new NumberInput(minOnlyQ, ed, noopCallbacks());
    const lines = input.renderWidget(ctx(ed));
    expect(lines).toHaveLength(1);
  });
});

// ── handleInput — unhandled keys ──────────────────────────────────────────────

describe("NumberInput — handleInput unhandled keys", () => {
  it("Tab returns false", () => {
    const ed = mockEditor();
    const input = new NumberInput(q, ed, noopCallbacks());
    expect(input.handleInput("\t")).toBe(false);
  });

  it("Escape returns false", () => {
    const ed = mockEditor();
    const input = new NumberInput(q, ed, noopCallbacks());
    expect(input.handleInput("\x1b")).toBe(false);
  });

  it("letter keys return false (invalid number chars)", () => {
    const ed = mockEditor();
    const input = new NumberInput(q, ed, noopCallbacks());
    expect(input.handleInput("z")).toBe(false);
  });
});

// ── Cursor editing via Editor (Bug 3) ─────────────────────────────────────────
//
// The terminal cursor is positioned by the real Editor using CURSOR_MARKER.
// In unit tests we verify that cursor movement correctly affects the text
// buffer state (via MockEditor), not raw render output.

describe("NumberInput — cursor editing (Bug 3)", () => {
  it("typed digit appears in rendered output", () => {
    const ed = mockEditor();
    const input = new NumberInput(q, ed, noopCallbacks());
    input.handleInput("9");
    expect(input.renderWidget(ctx(ed))[0]).toContain("9");
  });

  it("→ moves cursor right (render shows same text)", () => {
    const ed = mockEditor();
    const input = new NumberInput(q, ed, noopCallbacks());
    input.handleInput("7");
    input.handleInput("\x1b[D"); // ← move cursor left
    input.handleInput("\x1b[C"); // → move cursor right
    // After moving right again, inserting at end
    input.handleInput("3"); // appended: "73"
    expect(input.getTypedValue()).toBe(73);
  });

  it("backspace with cursor in middle removes correct char", () => {
    const ed = mockEditor();
    const input = new NumberInput(q, ed, noopCallbacks());
    input.handleInput("4");
    input.handleInput("2");
    input.handleInput("\x1b[D"); // ← cursor between 4 and 2
    input.handleInput("\x7f"); // delete "4"
    expect(input.getTypedValue()).toBe(2);
  });

  it("invalid chars are silently rejected, buffer unchanged", () => {
    const ed = mockEditor();
    const input = new NumberInput(q, ed, noopCallbacks());
    input.handleInput("5");
    input.handleInput("a"); // invalid — rejected
    input.handleInput("b"); // invalid — rejected
    expect(input.getReviewValue()).toBe("5");
  });
});
