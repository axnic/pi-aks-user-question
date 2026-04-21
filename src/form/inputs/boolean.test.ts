/**
 * form/inputs/boolean.test.ts
 *
 * All tests for BooleanInput: state machine, renderWidget, and handleInput.
 */

import { describe, expect, it, vi } from "vitest";
import { BooleanInput } from "./boolean";
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
  handleInput(_data: string): void {}
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

function ctx(): RenderContext {
  return { theme: theme as any, editor: mockEditor(), maxW: 80, maxH: 4 };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const q = {
  id: "confirm",
  question: "Continue?",
  header: "Confirm",
  type: "boolean" as const,
  defaultValue: true,
};

// ── State machine ─────────────────────────────────────────────────────────────

describe("BooleanInput — state machine", () => {
  it("isAnswered() returns false before Enter", () => {
    const input = new BooleanInput(q, mockEditor(), noopCallbacks());
    expect(input.isAnswered()).toBe(false);
  });

  it("isAnswered() returns true after Enter", () => {
    const cb = noopCallbacks();
    const input = new BooleanInput(q, mockEditor(), cb);
    input.handleInput("\r");
    expect(input.isAnswered()).toBe(true);
    expect(cb.onAdvance).toHaveBeenCalledOnce();
  });

  it("getTypedValue() reflects defaultValue before interaction", () => {
    const input = new BooleanInput(q, mockEditor(), noopCallbacks());
    expect(input.getTypedValue()).toBe(true);
  });

  it("getTypedValue() is false after ↓", () => {
    const input = new BooleanInput(q, mockEditor(), noopCallbacks());
    input.handleInput("\x1b[B"); // ↓
    expect(input.getTypedValue()).toBe(false);
  });

  it("changing value resets isAnswered to false", () => {
    const input = new BooleanInput(q, mockEditor(), noopCallbacks());
    input.handleInput("\r"); // confirm
    input.handleInput("\x1b[B"); // ↓ change
    expect(input.isAnswered()).toBe(false);
  });

  it("getReviewValue() returns true label when true", () => {
    const input = new BooleanInput(q, mockEditor(), noopCallbacks());
    expect(input.getReviewValue()).toBe("Yes");
  });

  it("getReviewValue() returns false label after ↓ Enter", () => {
    const input = new BooleanInput(q, mockEditor(), noopCallbacks());
    input.handleInput("\x1b[B");
    input.handleInput("\r");
    expect(input.getReviewValue()).toBe("No");
  });

  it("Y sets value to true", () => {
    const input = new BooleanInput(q, mockEditor(), noopCallbacks());
    input.handleInput("\x1b[B"); // go to No
    input.handleInput("Y"); // back to Yes
    expect(input.getTypedValue()).toBe(true);
  });

  it("N sets value to false", () => {
    const input = new BooleanInput(q, mockEditor(), noopCallbacks());
    input.handleInput("N");
    expect(input.getTypedValue()).toBe(false);
  });

  it("↑ and ↓ both toggle the value", () => {
    const input = new BooleanInput(q, mockEditor(), noopCallbacks());
    input.handleInput("\x1b[A"); // ↑ — toggles from true → false
    expect(input.getTypedValue()).toBe(false);
    input.handleInput("\x1b[B"); // ↓ — toggles back to true
    expect(input.getTypedValue()).toBe(true);
  });
});

// ── renderWidget ──────────────────────────────────────────────────────────────

describe("BooleanInput — renderWidget", () => {
  it("renders two lines: the selected option has ✔, the other is plain", () => {
    const ed = mockEditor();
    const input = new BooleanInput(q, ed, noopCallbacks());
    const lines = input.renderWidget(ctx());
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("✔");
    expect(lines[0]).toContain("Yes");
    expect(lines[1]).toContain("No");
    expect(lines[1]).not.toContain("✔");
  });

  it("after ↓, No row has the ✘ checkmark", () => {
    const ed = mockEditor();
    const input = new BooleanInput(q, ed, noopCallbacks());
    input.handleInput("\x1b[B"); // ↓
    const lines = input.renderWidget(ctx());
    expect(lines[1]).toContain("✘");
    expect(lines[1]).toContain("No");
    expect(lines[0]).not.toContain("✔");
    expect(lines[0]).not.toContain("✘");
  });

  it("custom labels are used when provided", () => {
    const customQ = {
      ...q,
      true: { label: "Enable", color: "success" },
      false: { label: "Disable", color: "error" },
    };
    const input = new BooleanInput(customQ, mockEditor(), noopCallbacks());
    const lines = input.renderWidget(ctx());
    expect(lines[0]).toContain("Enable");
    expect(lines[1]).toContain("Disable");
  });
});

// ── handleInput — unhandled keys ──────────────────────────────────────────────

describe("BooleanInput — handleInput unhandled keys", () => {
  it("Tab returns false (not consumed)", () => {
    const input = new BooleanInput(q, mockEditor(), noopCallbacks());
    expect(input.handleInput("\t")).toBe(false);
  });

  it("Escape returns false (not consumed)", () => {
    const input = new BooleanInput(q, mockEditor(), noopCallbacks());
    expect(input.handleInput("\x1b")).toBe(false);
  });

  it("unrecognised key returns false", () => {
    const input = new BooleanInput(q, mockEditor(), noopCallbacks());
    expect(input.handleInput("x")).toBe(false);
  });
});
