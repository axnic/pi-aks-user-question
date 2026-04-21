/**
 * form/inputs/choice.test.ts
 *
 * All tests for ChoiceInput (single-select and multi-select): state machine,
 * renderWidget, handleInput, scrollbar, and Other... mode.
 */

import { describe, expect, it, vi } from "vitest";
import { ChoiceInput } from "./choice";
import type { InputCallbacks, RenderContext } from "./types";

// ── Identity theme (no ANSI) ──────────────────────────────────────────────────

const theme = {
  fg: (_: string, s: string) => s,
  bold: (s: string) => s,
};

// ── Mock Editor ───────────────────────────────────────────────────────────────

class MockEditor {
  private _text = "";
  onSubmit: ((value: string) => void) | undefined;
  getText(): string {
    return this._text;
  }
  setText(t: string): void {
    this._text = t;
  }
  handleInput(data: string): void {
    if (data === "\x7f") {
      this._text = this._text.slice(0, -1);
    } else if (data.length === 1 && data >= " ") {
      this._text += data;
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
  editor?: import("@mariozechner/pi-tui").Editor,
  maxW = 80,
  maxH = 4,
): RenderContext {
  return { theme: theme as any, editor: editor ?? mockEditor(), maxW, maxH };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const choiceQ = {
  id: "language",
  question: "Which language?",
  header: "Language",
  type: "choice" as const,
  required: false,
  allowOther: true,
  options: [
    { label: "TypeScript" },
    { label: "Rust" },
    { label: "Python" },
    { label: "Go" },
  ],
};

const multiQ = {
  id: "interests",
  question: "Pick interests",
  header: "Interests",
  type: "multichoice" as const,
  options: [{ label: "Code" }, { label: "Design" }, { label: "Testing" }],
  allowOther: false,
};

// ── Single-select — state machine ─────────────────────────────────────────────

describe("ChoiceInput (single) — state machine", () => {
  it("isAnswered() returns false before selection", () => {
    const input = new ChoiceInput(choiceQ, mockEditor(), noopCallbacks());
    expect(input.isAnswered()).toBe(false);
  });

  it("Space selects first option without advancing", () => {
    const cb = noopCallbacks();
    const input = new ChoiceInput(choiceQ, mockEditor(), cb);
    input.handleInput(" ");
    expect(input.isAnswered()).toBe(true);
    expect(input.getTypedValue()).toBe("TypeScript");
    expect(cb.onAdvance).not.toHaveBeenCalled();
  });

  it("Enter advances without requiring a selection", () => {
    const cb = noopCallbacks();
    const input = new ChoiceInput(choiceQ, mockEditor(), cb);
    input.handleInput("\r");
    expect(cb.onAdvance).toHaveBeenCalledOnce();
    expect(input.isAnswered()).toBe(false);
  });

  it("↓ Space selects second option", () => {
    const input = new ChoiceInput(choiceQ, mockEditor(), noopCallbacks());
    input.handleInput("\x1b[B"); // ↓
    input.handleInput(" ");
    expect(input.getTypedValue()).toBe("Rust");
  });

  it("↑ at position 0 stays at 0", () => {
    const input = new ChoiceInput(choiceQ, mockEditor(), noopCallbacks());
    input.handleInput("\x1b[A"); // ↑ — no effect
    input.handleInput(" ");
    expect(input.getTypedValue()).toBe("TypeScript");
  });

  it("cursor stops at last option when allowOther=false", () => {
    const binaryQ = {
      ...choiceQ,
      allowOther: false,
      options: [{ label: "Agree" }, { label: "Disagree" }],
    };
    const input = new ChoiceInput(binaryQ, mockEditor(), noopCallbacks());
    input.handleInput("\x1b[B"); // → Disagree
    input.handleInput("\x1b[B"); // → stays at Disagree
    input.handleInput(" ");
    expect(input.getTypedValue()).toBe("Disagree");
  });

  it("cursor can reach Other row (index 4) when allowOther=true", () => {
    const input = new ChoiceInput(choiceQ, mockEditor(), noopCallbacks());
    for (let i = 0; i < 5; i++) input.handleInput("\x1b[B");
    input.handleInput("\x1b[B"); // extra ↓ — shouldn't go past Other row
    // On Other row: Enter activates otherMode, not a regular selection
    expect(input.isAnswered()).toBe(false);
  });

  it("getReviewValue() returns selected label", () => {
    const input = new ChoiceInput(choiceQ, mockEditor(), noopCallbacks());
    input.handleInput(" ");
    expect(input.getReviewValue()).toBe("TypeScript");
  });

  it("re-selecting same option via Space is a no-op (cannot devalidate)", () => {
    const cb = noopCallbacks();
    const input = new ChoiceInput(choiceQ, mockEditor(), cb);
    input.handleInput(" "); // select TypeScript
    input.handleInput(" "); // re-select same — should still be selected
    expect(cb.onAdvance).not.toHaveBeenCalled();
    expect(input.getTypedValue()).toBe("TypeScript");
  });

  it("Escape returns false (not consumed in normal mode)", () => {
    const input = new ChoiceInput(choiceQ, mockEditor(), noopCallbacks());
    expect(input.handleInput("\x1b")).toBe(false);
  });
});

// ── Multi-select — state machine ──────────────────────────────────────────────

describe("ChoiceInput (multi) — state machine", () => {
  it("isAnswered() returns false before selection", () => {
    const input = new ChoiceInput(multiQ, mockEditor(), noopCallbacks(), true);
    expect(input.isAnswered()).toBe(false);
  });

  it("Space toggles a checkbox on", () => {
    const input = new ChoiceInput(multiQ, mockEditor(), noopCallbacks(), true);
    input.handleInput(" ");
    expect(input.isAnswered()).toBe(true);
    expect(input.getTypedValue() as string[]).toContain("Code");
  });

  it("Space again toggles the same checkbox off", () => {
    const input = new ChoiceInput(multiQ, mockEditor(), noopCallbacks(), true);
    input.handleInput(" ");
    input.handleInput(" "); // toggle off
    expect(input.isAnswered()).toBe(false);
    expect(input.getTypedValue()).toEqual([]);
  });

  it("multiple options can be selected simultaneously", () => {
    const input = new ChoiceInput(multiQ, mockEditor(), noopCallbacks(), true);
    input.handleInput(" "); // Code
    input.handleInput("\x1b[B"); // ↓
    input.handleInput(" "); // Design
    const val = input.getTypedValue() as string[];
    expect(val).toContain("Code");
    expect(val).toContain("Design");
  });

  it("getReviewValue() joins labels with comma", () => {
    const input = new ChoiceInput(multiQ, mockEditor(), noopCallbacks(), true);
    input.handleInput(" "); // Code
    input.handleInput("\x1b[B"); // ↓
    input.handleInput(" "); // Design
    expect(input.getReviewValue()).toBe("Code, Design");
  });

  it("Space does not auto-advance; Enter advances to next question", () => {
    const cb = noopCallbacks();
    const input = new ChoiceInput(multiQ, mockEditor(), cb, true);
    input.handleInput(" ");
    expect(cb.onAdvance).not.toHaveBeenCalled();
    input.handleInput("\r");
    expect(cb.onAdvance).toHaveBeenCalledOnce();
  });
});

// ── renderWidget ──────────────────────────────────────────────────────────────

describe("ChoiceInput (single) — renderWidget", () => {
  const q = {
    id: "lang",
    question: "Pick a language",
    header: "Lang",
    type: "choice" as const,
    options: [
      { label: "TypeScript", description: "Static typing" },
      { label: "Rust" },
      { label: "Python" },
    ],
    allowOther: false,
  };

  it("renders numbered rows with checkboxes", () => {
    const ed = mockEditor();
    const input = new ChoiceInput(q, ed, noopCallbacks());
    const lines = input.renderWidget(ctx(ed));
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("1.");
    expect(lines[0]).toContain("TypeScript");
    expect(lines[0]).toContain("[ ]");
  });

  it("first row has › cursor", () => {
    const ed = mockEditor();
    const input = new ChoiceInput(q, ed, noopCallbacks());
    const lines = input.renderWidget(ctx(ed));
    expect(lines[0]).toContain("›");
  });

  it("selected option shows ✔", () => {
    const ed = mockEditor();
    const input = new ChoiceInput(q, ed, noopCallbacks());
    input.handleInput(" ");
    const lines = input.renderWidget(ctx(ed));
    expect(lines[0]).toContain("✔");
  });

  it("description appears inline on the same line as its option", () => {
    const ed = mockEditor();
    const input = new ChoiceInput(q, ed, noopCallbacks());
    const lines = input.renderWidget(ctx(ed));
    expect(lines[0]).toContain("TypeScript");
    expect(lines[0]).toContain("Static typing");
  });

  it("allowOther=true adds an Other... row", () => {
    const withOther = { ...q, allowOther: true };
    const ed = mockEditor();
    const input = new ChoiceInput(withOther, ed, noopCallbacks());
    const lines = input.renderWidget(ctx(ed));
    const otherLine = lines.find((l) => l.includes("Other"));
    expect(otherLine).toBeDefined();
  });
});

describe("ChoiceInput (multi) — renderWidget", () => {
  it("multiple options can show ✔ simultaneously", () => {
    const ed = mockEditor();
    const input = new ChoiceInput(multiQ, ed, noopCallbacks(), true);
    input.handleInput(" "); // toggle Code
    input.handleInput("\x1b[B"); // ↓
    input.handleInput(" "); // toggle Design
    const lines = input.renderWidget(ctx(ed));
    const checkedLines = lines.filter((l) => l.includes("✔"));
    expect(checkedLines).toHaveLength(2);
  });
});

// ── Scrollbar ─────────────────────────────────────────────────────────────────

describe("ChoiceInput — scrollbar", () => {
  const manyOptions = Array.from({ length: 8 }, (_, i) => ({
    label: `Option ${i + 1}`,
  }));
  const manyQ = {
    id: "many",
    question: "Pick one",
    header: "Many",
    type: "choice" as const,
    options: manyOptions,
    allowOther: false,
  };

  it("shows scrollbar characters when options > MAX_VISIBLE_OPTIONS", () => {
    const ed = mockEditor();
    const input = new ChoiceInput(manyQ, ed, noopCallbacks());
    const lines = input.renderWidget(ctx(ed));
    const hasScrollbar = lines.some((l) => l.includes("│") || l.includes("┃"));
    expect(hasScrollbar).toBe(true);
  });

  it("shows only MAX_VISIBLE_OPTIONS option lines plus arrow indicators", () => {
    const ed = mockEditor();
    const input = new ChoiceInput(manyQ, ed, noopCallbacks());
    const lines = input.renderWidget(ctx(ed));
    const optionLines = lines.filter((l) => l.includes("."));
    expect(optionLines).toHaveLength(4);
    expect(lines[lines.length - 1]).toContain("▼");
  });
});

// ── maxH vertical scaling ─────────────────────────────────────────────────────

describe("ChoiceInput — maxH vertical scaling", () => {
  const manyOptions = Array.from({ length: 8 }, (_, i) => ({
    label: `Option ${i + 1}`,
  }));
  const manyQ = {
    id: "many",
    question: "Pick one",
    header: "Many",
    type: "choice" as const,
    options: manyOptions,
    allowOther: false,
  };

  it("maxH=4 (default): shows 4 visible rows when scrollable", () => {
    const ed = mockEditor();
    const input = new ChoiceInput(manyQ, ed, noopCallbacks());
    const lines = input.renderWidget(ctx(ed, 80, 4));
    const optionLines = lines.filter((l) => l.includes("."));
    expect(optionLines).toHaveLength(4);
  });

  it("maxH=6: shows 6 visible rows when scrollable", () => {
    const ed = mockEditor();
    const input = new ChoiceInput(manyQ, ed, noopCallbacks());
    const lines = input.renderWidget(ctx(ed, 80, 6));
    const optionLines = lines.filter((l) => l.includes("."));
    expect(optionLines).toHaveLength(6);
  });

  it("maxH=10: shows all 8 rows without arrows when every option fits", () => {
    const ed = mockEditor();
    const input = new ChoiceInput(manyQ, ed, noopCallbacks());
    const lines = input.renderWidget(ctx(ed, 80, 10));
    const optionLines = lines.filter((l) => l.includes("."));
    expect(optionLines).toHaveLength(8);
    expect(lines.every((l) => !l.includes("▼") && !l.includes("▲"))).toBe(true);
  });

  it("maxH=2: shows only 2 rows with scrollbar when list is much longer", () => {
    const ed = mockEditor();
    const input = new ChoiceInput(manyQ, ed, noopCallbacks());
    const lines = input.renderWidget(ctx(ed, 80, 2));
    const optionLines = lines.filter((l) => l.includes("."));
    expect(optionLines).toHaveLength(2);
    const hasScrollbar = lines.some((l) => l.includes("│") || l.includes("┃"));
    expect(hasScrollbar).toBe(true);
  });
});

// ── Other... mode ─────────────────────────────────────────────────────────────

describe("ChoiceInput — Other... mode", () => {
  it("pressing Space on Other row enters otherMode", () => {
    const input = new ChoiceInput(choiceQ, mockEditor(), noopCallbacks());
    for (let i = 0; i < 4; i++) input.handleInput("\x1b[B"); // reach Other row
    input.handleInput(" "); // enter otherMode
    // In otherMode: input consumes all keys
    expect(input.handleInput("Z")).toBe(true);
  });

  it("Escape in otherMode exits without submitting", () => {
    const cb = noopCallbacks();
    const ed = mockEditor();
    const input = new ChoiceInput(choiceQ, ed, cb);
    for (let i = 0; i < 4; i++) input.handleInput("\x1b[B");
    input.handleInput(" "); // enter otherMode
    input.handleInput("\x1b"); // exit otherMode
    expect(cb.onAdvance).not.toHaveBeenCalled();
    expect(input.isAnswered()).toBe(false);
  });

  it("Enter in otherMode with text confirms and advances", () => {
    const cb = noopCallbacks();
    const ed = mockEditor();
    const input = new ChoiceInput(choiceQ, ed, cb);
    for (let i = 0; i < 4; i++) input.handleInput("\x1b[B");
    input.handleInput(" "); // enter otherMode
    (ed as unknown as MockEditor).setText("Haskell");
    input.handleInput("\r"); // confirm
    expect(cb.onAdvance).toHaveBeenCalledOnce();
    expect(input.getTypedValue()).toBe("Haskell");
    expect(input.getReviewValue()).toBe("Haskell (Other)");
  });
});
