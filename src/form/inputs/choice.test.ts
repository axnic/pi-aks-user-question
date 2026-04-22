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

// ── minSelections enforcement ──────────────────────────────────────────────────

describe("ChoiceInput (multi) — minSelections", () => {
  const minQ = {
    id: "features",
    question: "Pick features?",
    header: "Features",
    type: "multichoice" as const,
    options: [{ label: "Auth" }, { label: "Cache" }, { label: "Logging" }],
    allowOther: false,
    minSelections: 2,
  };

  it("isAnswered() returns false when count < minSelections", () => {
    const input = new ChoiceInput(minQ, mockEditor(), noopCallbacks(), true);
    input.handleInput(" "); // select Auth (count=1, min=2)
    expect(input.isAnswered()).toBe(false);
  });

  it("isAnswered() returns true when count >= minSelections", () => {
    const input = new ChoiceInput(minQ, mockEditor(), noopCallbacks(), true);
    input.handleInput(" "); // Auth
    input.handleInput("\x1b[B");
    input.handleInput(" "); // Cache (count=2)
    expect(input.isAnswered()).toBe(true);
  });

  it("Enter is blocked when count < minSelections", () => {
    const cb = noopCallbacks();
    const input = new ChoiceInput(minQ, mockEditor(), cb, true);
    input.handleInput(" "); // count=1
    input.handleInput("\r");
    expect(cb.onAdvance).not.toHaveBeenCalled();
  });

  it("getValidationError() returns message when Enter is blocked by minSelections", () => {
    const input = new ChoiceInput(minQ, mockEditor(), noopCallbacks(), true);
    input.handleInput(" "); // count=1
    input.handleInput("\r"); // trigger error
    expect(input.getValidationError()).toBe("Select at least 2 items");
  });

  it("Enter advances when count >= minSelections", () => {
    const cb = noopCallbacks();
    const input = new ChoiceInput(minQ, mockEditor(), cb, true);
    input.handleInput(" "); // Auth
    input.handleInput("\x1b[B");
    input.handleInput(" "); // Cache (count=2)
    input.handleInput("\r");
    expect(cb.onAdvance).toHaveBeenCalledOnce();
  });

  it("error clears when selection count reaches minSelections", () => {
    const input = new ChoiceInput(minQ, mockEditor(), noopCallbacks(), true);
    input.handleInput(" "); // count=1
    input.handleInput("\r"); // trigger error
    expect(input.getValidationError()).toBe("Select at least 2 items");
    input.handleInput("\x1b[B");
    input.handleInput(" "); // count=2 — error cleared on successful toggle
    expect(input.getValidationError()).toBeUndefined();
  });

  it("singular 'item' message when minSelections=1", () => {
    const singleMinQ = { ...minQ, minSelections: 1 };
    const input = new ChoiceInput(
      singleMinQ,
      mockEditor(),
      noopCallbacks(),
      true,
    );
    input.handleInput("\r"); // trigger error with 0 selected
    expect(input.getValidationError()).toBe("Select at least 1 item");
  });

  it("Enter is blocked when count=0 (before minSelections=2)", () => {
    const cb = noopCallbacks();
    const input = new ChoiceInput(minQ, mockEditor(), cb, true);
    input.handleInput("\r"); // no selections at all
    expect(cb.onAdvance).not.toHaveBeenCalled();
    expect(input.getValidationError()).toBe("Select at least 2 items");
  });
});

// ── maxSelections enforcement ──────────────────────────────────────────────────

describe("ChoiceInput (multi) — maxSelections", () => {
  const maxQ = {
    id: "features",
    question: "Pick up to 2 features?",
    header: "Features",
    type: "multichoice" as const,
    options: [{ label: "Auth" }, { label: "Cache" }, { label: "Logging" }],
    allowOther: false,
    maxSelections: 2,
  };

  it("Space selects normally when below maxSelections", () => {
    const input = new ChoiceInput(maxQ, mockEditor(), noopCallbacks(), true);
    input.handleInput(" "); // Auth (count=1)
    expect(input.getTypedValue() as string[]).toContain("Auth");
    expect(input.getValidationError()).toBeUndefined();
  });

  it("Space is blocked when at maxSelections", () => {
    const input = new ChoiceInput(maxQ, mockEditor(), noopCallbacks(), true);
    input.handleInput(" "); // Auth
    input.handleInput("\x1b[B");
    input.handleInput(" "); // Cache (count=2, at max)
    input.handleInput("\x1b[B");
    input.handleInput(" "); // Logging — blocked
    expect(input.getTypedValue() as string[]).not.toContain("Logging");
  });

  it("getValidationError() returns message when Space is blocked by maxSelections", () => {
    const input = new ChoiceInput(maxQ, mockEditor(), noopCallbacks(), true);
    input.handleInput(" "); // Auth
    input.handleInput("\x1b[B");
    input.handleInput(" "); // Cache (count=2)
    input.handleInput("\x1b[B");
    input.handleInput(" "); // Logging — triggers error
    expect(input.getValidationError()).toBe("Maximum 2 items selected");
  });

  it("error clears when an option is deselected", () => {
    const input = new ChoiceInput(maxQ, mockEditor(), noopCallbacks(), true);
    input.handleInput(" "); // Auth
    input.handleInput("\x1b[B");
    input.handleInput(" "); // Cache (count=2)
    input.handleInput("\x1b[B");
    input.handleInput(" "); // blocked → error set
    input.handleInput("\x1b[A"); // back to Cache
    input.handleInput(" "); // deselect Cache → error cleared
    expect(input.getValidationError()).toBeUndefined();
  });

  it("singular 'item' message when maxSelections=1", () => {
    const singleMaxQ = { ...maxQ, maxSelections: 1 };
    const input = new ChoiceInput(
      singleMaxQ,
      mockEditor(),
      noopCallbacks(),
      true,
    );
    input.handleInput(" "); // Auth (count=1, at max)
    input.handleInput("\x1b[B");
    input.handleInput(" "); // Cache — blocked
    expect(input.getValidationError()).toBe("Maximum 1 item selected");
  });

  it("Enter still advances when at maxSelections (no minSelections)", () => {
    const cb = noopCallbacks();
    const input = new ChoiceInput(maxQ, mockEditor(), cb, true);
    input.handleInput(" "); // Auth
    input.handleInput("\x1b[B");
    input.handleInput(" "); // Cache (count=2)
    input.handleInput("\r");
    expect(cb.onAdvance).toHaveBeenCalledOnce();
  });

  it("Other row is blocked when at maxSelections and Other not already set", () => {
    const withOtherQ = { ...maxQ, allowOther: true };
    const input = new ChoiceInput(
      withOtherQ,
      mockEditor(),
      noopCallbacks(),
      true,
    );
    input.handleInput(" "); // Auth
    input.handleInput("\x1b[B");
    input.handleInput(" "); // Cache (count=2, at max)
    // Move to Other row (index 3)
    input.handleInput("\x1b[B");
    input.handleInput("\x1b[B");
    input.handleInput(" "); // try to enter otherMode — blocked
    expect(input.getValidationError()).toBe("Maximum 2 items selected");
  });
});

// ── minSelections + maxSelections combined ────────────────────────────────────

describe("ChoiceInput (multi) — minSelections + maxSelections combined", () => {
  const combinedQ = {
    id: "features",
    question: "Pick 2-3 features?",
    header: "Features",
    type: "multichoice" as const,
    options: [
      { label: "Auth" },
      { label: "Cache" },
      { label: "Logging" },
      { label: "Metrics" },
    ],
    allowOther: false,
    minSelections: 2,
    maxSelections: 3,
  };

  it("Enter is blocked below minSelections even with maxSelections set", () => {
    const cb = noopCallbacks();
    const input = new ChoiceInput(combinedQ, mockEditor(), cb, true);
    input.handleInput(" "); // Auth (count=1)
    input.handleInput("\r");
    expect(cb.onAdvance).not.toHaveBeenCalled();
    expect(input.getValidationError()).toBe("Select at least 2 items");
  });

  it("Space is blocked above maxSelections even with minSelections set", () => {
    const input = new ChoiceInput(
      combinedQ,
      mockEditor(),
      noopCallbacks(),
      true,
    );
    input.handleInput(" "); // Auth
    input.handleInput("\x1b[B");
    input.handleInput(" "); // Cache
    input.handleInput("\x1b[B");
    input.handleInput(" "); // Logging (count=3, at max)
    input.handleInput("\x1b[B");
    input.handleInput(" "); // Metrics — blocked
    expect(input.getValidationError()).toBe("Maximum 3 items selected");
    expect(input.getTypedValue() as string[]).not.toContain("Metrics");
  });

  it("Enter advances when count is between min and max (inclusive)", () => {
    const cb = noopCallbacks();
    const input = new ChoiceInput(combinedQ, mockEditor(), cb, true);
    input.handleInput(" "); // Auth
    input.handleInput("\x1b[B");
    input.handleInput(" "); // Cache (count=2)
    input.handleInput("\r");
    expect(cb.onAdvance).toHaveBeenCalledOnce();
  });
});

// ── footer hints with constraints ─────────────────────────────────────────────

describe("ChoiceInput (multi) — getFooterHints with constraints", () => {
  const minQ = {
    id: "f",
    question: "Pick?",
    header: "F",
    type: "multichoice" as const,
    options: [{ label: "A" }, { label: "B" }, { label: "C" }],
    allowOther: false,
    minSelections: 2,
  };

  const maxQ = {
    id: "f",
    question: "Pick?",
    header: "F",
    type: "multichoice" as const,
    options: [{ label: "A" }, { label: "B" }, { label: "C" }],
    allowOther: false,
    maxSelections: 2,
  };

  it("shows 'select at least N' in Enter hint when below minSelections", () => {
    const input = new ChoiceInput(minQ, mockEditor(), noopCallbacks(), true);
    input.handleInput(" "); // 1 selected, below min=2
    const hints = input.getFooterHints();
    const enterHint = hints.find((h) => h.keys.includes("enter" as any));
    expect(enterHint?.action).toContain("select at least 2");
  });

  it("shows plain 'next' in Enter hint when count >= minSelections", () => {
    const input = new ChoiceInput(minQ, mockEditor(), noopCallbacks(), true);
    input.handleInput(" "); // A
    input.handleInput("\x1b[B");
    input.handleInput(" "); // B (count=2)
    const hints = input.getFooterHints();
    const enterHint = hints.find((h) => h.keys.includes("enter" as any));
    expect(enterHint?.action).toBe("next");
  });

  it("shows count/max in Enter hint when maxSelections is set", () => {
    const input = new ChoiceInput(maxQ, mockEditor(), noopCallbacks(), true);
    input.handleInput(" "); // 1 selected
    const hints = input.getFooterHints();
    const enterHint = hints.find((h) => h.keys.includes("enter" as any));
    expect(enterHint?.action).toContain("1/2");
  });

  it("plain multi without constraints shows 'next' in Enter hint", () => {
    const plain = {
      id: "f",
      question: "Pick?",
      header: "F",
      type: "multichoice" as const,
      options: [{ label: "A" }, { label: "B" }],
      allowOther: false,
    };
    const input = new ChoiceInput(plain, mockEditor(), noopCallbacks(), true);
    const hints = input.getFooterHints();
    const enterHint = hints.find((h) => h.keys.includes("enter" as any));
    expect(enterHint?.action).toBe("next");
  });
});

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
