/**
 * form/inputs/text.test.ts
 *
 * All tests for TextInput: state machine, renderWidget, and handleInput.
 */

import { describe, expect, it, type Mock, vi } from "vitest";
import { TextInput } from "./text";
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

function ctx(editor: import("@mariozechner/pi-tui").Editor): RenderContext {
  return { theme: theme as any, editor, maxW: 80, maxH: 4 };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const q = {
  id: "name",
  question: "Your name?",
  header: "Name",
  type: "text" as const,
  placeholder: "e.g. John Doe",
  required: true,
};

const ipQ = {
  id: "ip",
  question: "IP?",
  header: "IP",
  type: "text" as const,
  placeholder: "1.2.3.4",
  validation: { format: "ipv4" as const, errorMessage: "Bad IP" },
};

// ── State machine ─────────────────────────────────────────────────────────────

describe("TextInput — state machine", () => {
  it("isAnswered() returns false when value is empty", () => {
    const input = new TextInput(q, mockEditor(), noopCallbacks());
    expect(input.isAnswered()).toBe(false);
  });

  it("isAnswered() returns true when text is committed via activate/deactivate", () => {
    const ed = mockEditor();
    const input = new TextInput({ ...q, validation: undefined }, ed, noopCallbacks());
    input.activate();
    (ed as unknown as MockEditor).setText("My name");
    input.deactivate();
    expect(input.isAnswered()).toBe(true);
    expect(input.getTypedValue()).toBe("My name");
  });

  it("isAnswered() is false when text fails validation", () => {
    const ed = mockEditor();
    const input = new TextInput(ipQ, ed, noopCallbacks());
    input.activate();
    (ed as unknown as MockEditor).setText("not-an-ip");
    input.deactivate();
    expect(input.isAnswered()).toBe(false);
  });

  it("isAnswered() is true when text passes validation", () => {
    const ed = mockEditor();
    const input = new TextInput(ipQ, ed, noopCallbacks());
    input.activate();
    (ed as unknown as MockEditor).setText("192.168.1.1");
    input.deactivate();
    expect(input.isAnswered()).toBe(true);
  });

  it("dirty flag: after typing (no submit), isAnswered returns false", () => {
    const ed = mockEditor();
    const input = new TextInput(q, ed, noopCallbacks());
    input.activate();
    (ed as unknown as MockEditor).setText("partial");
    input.handleInput("a"); // marks dirty
    expect(input.isAnswered()).toBe(false);
  });

  it("getTypedValue() returns committed value", () => {
    const ed = mockEditor();
    const input = new TextInput({ ...q, validation: undefined }, ed, noopCallbacks());
    input.activate();
    (ed as unknown as MockEditor).setText("Alice");
    input.deactivate();
    expect(input.getTypedValue()).toBe("Alice");
  });

  it("getReviewValue() matches getTypedValue()", () => {
    const ed = mockEditor();
    const input = new TextInput({ ...q, validation: undefined }, ed, noopCallbacks());
    input.activate();
    (ed as unknown as MockEditor).setText("Alice");
    input.deactivate();
    expect(input.getReviewValue()).toBe(input.getTypedValue());
  });
});

// ── renderWidget ──────────────────────────────────────────────────────────────

describe("TextInput — renderWidget", () => {
  it("shows placeholder when editor is empty", () => {
    const ed = mockEditor();
    const input = new TextInput(q, ed, noopCallbacks());
    const lines = input.renderWidget(ctx(ed));
    expect(lines[0]).toContain("e.g. John Doe");
    expect(lines[0]).toContain(">");
  });

  it("shows editor content when not empty", () => {
    const ed = mockEditor();
    (ed as unknown as MockEditor).setText("Alice");
    const input = new TextInput(q, ed, noopCallbacks());
    const lines = input.renderWidget(ctx(ed));
    expect(lines[0]).toContain("Alice");
  });
});

// ── handleInput ───────────────────────────────────────────────────────────────

describe("TextInput — handleInput", () => {
  it("Enter with valid text commits and calls onAdvance", () => {
    const cb = noopCallbacks();
    const ed = mockEditor();
    const input = new TextInput({ ...q, validation: undefined }, ed, cb);
    input.activate();
    (ed as unknown as MockEditor).setText("Bob");
    input.handleInput("\r");
    expect(cb.onAdvance).toHaveBeenCalledOnce();
    expect(input.getTypedValue()).toBe("Bob");
  });

  it("Enter with invalid IP shows error and does NOT advance", () => {
    const cb = noopCallbacks();
    const ed = mockEditor();
    const input = new TextInput(ipQ, ed, cb);
    input.activate();
    (ed as unknown as MockEditor).setText("bad");
    input.handleInput("\r");
    expect(cb.onAdvance).not.toHaveBeenCalled();
    expect(input.getValidationError()).toBe("Bad IP");
  });

  it("Enter with valid IP advances and clears error", () => {
    const cb = noopCallbacks();
    const ed = mockEditor();
    const input = new TextInput(ipQ, ed, cb);
    input.activate();
    (ed as unknown as MockEditor).setText("192.168.1.1");
    input.handleInput("\r");
    expect(cb.onAdvance).toHaveBeenCalledOnce();
    expect(input.getValidationError()).toBeUndefined();
  });

  it("Tab returns false (not consumed)", () => {
    const input = new TextInput(q, mockEditor(), noopCallbacks());
    expect(input.handleInput("\t")).toBe(false);
  });

  it("Shift+Tab returns false (not consumed)", () => {
    const input = new TextInput(q, mockEditor(), noopCallbacks());
    expect(input.handleInput("\x1b[Z")).toBe(false);
  });

  it("Escape returns false (not consumed)", () => {
    const input = new TextInput(q, mockEditor(), noopCallbacks());
    expect(input.handleInput("\x1b")).toBe(false);
  });

  it("regular character is forwarded to editor and marks dirty", () => {
    const cb = noopCallbacks();
    const ed = mockEditor();
    const input = new TextInput({ ...q, validation: undefined }, ed, cb);
    input.activate();
    input.handleInput("H");
    input.handleInput("i");
    expect((ed as unknown as MockEditor).getText()).toBe("Hi");
    expect(cb.onRefresh).toHaveBeenCalled();
  });

  it("typing clears a previous validation error immediately", () => {
    const cb = noopCallbacks();
    const ed = mockEditor();
    const input = new TextInput(ipQ, ed, cb);
    input.activate();
    (ed as unknown as MockEditor).setText("bad");
    input.handleInput("\r"); // set error
    expect(input.getValidationError()).toBe("Bad IP");
    input.handleInput("a"); // clears error immediately
    expect(input.getValidationError()).toBeUndefined();
  });
});

// ── dispose ───────────────────────────────────────────────────────────────────

describe("TextInput — dispose", () => {
  it("dispose() does not throw", () => {
    const input = new TextInput(q, mockEditor(), noopCallbacks());
    expect(() => input.dispose()).not.toThrow();
  });
});

// ── Bug fix: tab-switch saves and marks answered ──────────────────────────────

describe("TextInput — deactivate() saves and clears dirty (Bug 1)", () => {
  it("typing then Tab: isAnswered() is true when no validation", () => {
    const ed = mockEditor();
    const input = new TextInput({ ...q, validation: undefined }, ed, noopCallbacks());
    input.activate();
    // Type "Alice" char-by-char through handleInput (sets _isDirty)
    for (const ch of "Alice") input.handleInput(ch);
    expect(input.isAnswered()).toBe(false); // still dirty before Tab
    input.deactivate(); // simulates Tab navigation
    expect(input.isAnswered()).toBe(true);
    expect(input.getTypedValue()).toBe("Alice");
  });

  it("typing valid IP then Tab: isAnswered() is true", () => {
    const ed = mockEditor();
    const input = new TextInput(ipQ, ed, noopCallbacks());
    input.activate();
    input.handleInput("\x7f"); // trigger dirty (backspace on empty — no visible effect)
    (ed as unknown as MockEditor).setText("192.168.1.1");
    expect(input.isAnswered()).toBe(false); // dirty
    input.deactivate();
    expect(input.isAnswered()).toBe(true);
  });

  it("typing invalid IP then Tab: isAnswered() stays false", () => {
    const ed = mockEditor();
    const input = new TextInput(ipQ, ed, noopCallbacks());
    input.activate();
    input.handleInput("\x7f"); // trigger dirty
    (ed as unknown as MockEditor).setText("not-an-ip");
    input.deactivate();
    expect(input.isAnswered()).toBe(false); // invalid → stays pending
  });

  it("deactivate() cancels a pending debounce timer", () => {
    vi.useFakeTimers();
    const cb = noopCallbacks();
    const ed = mockEditor();
    const input = new TextInput(ipQ, ed, cb);
    input.activate();
    input.handleInput("x"); // starts debounce; also calls onRefresh synchronously
    (cb.onRefresh as unknown as Mock).mockClear(); // reset — we only care about the timer-triggered call
    input.deactivate(); // must cancel the timer
    vi.runAllTimers(); // if timer still fires, onRefresh would be called again
    expect(cb.onRefresh).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("empty text after Tab: isAnswered() is false (not pending)", () => {
    const ed = mockEditor();
    const input = new TextInput(q, ed, noopCallbacks());
    input.activate();
    input.handleInput("\x7f"); // trigger dirty on empty
    input.deactivate();
    expect(input.isAnswered()).toBe(false); // empty → not answered
  });
});

// ── Bug fix: single-line (block Shift+Enter) ──────────────────────────────────

describe("TextInput — single-line (Bug 2)", () => {
  it("\\n is consumed and NOT forwarded to the editor", () => {
    const ed = mockEditor();
    const input = new TextInput(q, ed, noopCallbacks());
    input.activate();
    const consumed = input.handleInput("\n");
    expect(consumed).toBe(true);
    expect((ed as unknown as MockEditor).getText()).toBe(""); // editor unchanged
  });

  it("editor text with \\n in it: renderWidget shows only the first line", () => {
    const ed = mockEditor();
    // Simulate a multi-line editor (e.g. via external setText)
    const mock = ed as unknown as MockEditor;
    // Override render to simulate multi-line output
    const originalRender = mock.render.bind(mock);
    mock.render = (_w: number) => ["line one", "line two", "line three"];
    mock.setText("line one\nline two\nline three");

    const input = new TextInput(q, ed, noopCallbacks());
    const lines = input.renderWidget(ctx(ed));
    // Only the first content line should appear
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("line one");
    expect(lines[0]).not.toContain("line two");

    mock.render = originalRender; // restore
  });

  it("deactivate() keeps only the first line when editor has multi-line text", () => {
    const ed = mockEditor();
    const input = new TextInput({ ...q, validation: undefined }, ed, noopCallbacks());
    input.activate();
    // Force multi-line text into the editor (simulates a terminal that allows newlines)
    (ed as unknown as MockEditor).setText("hello\nworld");
    input.handleInput("x"); // mark dirty so deactivate saves
    input.deactivate();
    expect(input.getTypedValue()).toBe("hello");
  });

  it("_submit() (Enter) keeps only the first line", () => {
    const ed = mockEditor();
    const cb = noopCallbacks();
    const input = new TextInput({ ...q, validation: undefined }, ed, cb);
    input.activate();
    (ed as unknown as MockEditor).setText("first line\nsecond line");
    input.handleInput("\r"); // Enter triggers _submit
    expect(input.getTypedValue()).toBe("first line");
  });
});
