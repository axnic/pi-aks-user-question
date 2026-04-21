/**
 * form/review.test.ts
 *
 * Unit tests for ReviewScreen: rendering layout, scrollbar, scroll navigation,
 * boundary clamping, submit action, reset, and different maxH values.
 */

import { describe, expect, it } from "vitest";
import type { FormQuestion } from "./question";
import { ReviewScreen } from "./review";

// ── Identity theme (no ANSI) ──────────────────────────────────────────────────

const theme = {
  fg: (_: string, s: string) => s,
  bold: (s: string) => s,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Builds a minimal FormQuestion array for testing.
 *
 * @param n           - Number of questions to create.
 * @param allAnswered - When true every input returns isAnswered() = true.
 */
function makeQuestions(n: number, allAnswered = false): FormQuestion[] {
  return Array.from({ length: n }, (_, i) => ({
    questionIdx: i,
    originalQuestion: undefined,
    question: `What is ${i + 1}?`,
    header: `Question ${i + 1}`,
    required: i === 0, // only the first question is required
    input: {
      isAnswered: () => allAnswered,
      getReviewValue: () => `Answer ${i + 1}`,
      type: "text",
      handleInput: () => false,
      renderWidget: () => [],
      getTypedValue: () => "",
      getFooterHints: () => [],
      getValidationError: () => undefined,
      dispose: () => {},
    } as any,
  }));
}

// ── Render — no scrollbar ─────────────────────────────────────────────────────

describe("ReviewScreen — render (no scroll)", () => {
  it("contains the heading", () => {
    const screen = new ReviewScreen(makeQuestions(3, true), theme as any);
    const output = screen.render(80, 15).join("\n");
    expect(output).toContain("Review your answers:");
  });

  it("shows all questions when they fit", () => {
    const screen = new ReviewScreen(makeQuestions(3, true), theme as any);
    const output = screen.render(80, 15).join("\n");
    expect(output).toContain("What is 1?");
    expect(output).toContain("What is 2?");
    expect(output).toContain("What is 3?");
  });

  it("shows answers with · connector", () => {
    const screen = new ReviewScreen(makeQuestions(3, true), theme as any);
    const rows = screen.render(80, 15).filter((l) => l.includes("Answer"));
    expect(rows.length).toBe(3);
    expect(rows[0]).toContain("Answer 1");
  });

  it("shows the submit hint", () => {
    const screen = new ReviewScreen(makeQuestions(3, true), theme as any);
    const output = screen.render(80, 15).join("\n");
    expect(output).toContain("Enter submit");
    expect(output).toContain("Tab/Shift+Tab edit");
    expect(output).toContain("Esc cancel");
  });

  it("does not show scrollbar when all questions fit", () => {
    const screen = new ReviewScreen(makeQuestions(3, true), theme as any);
    const output = screen.render(80, 15);
    const hasScrollbar = output.some((l) => l.includes("│") || l.includes("┃"));
    expect(hasScrollbar).toBe(false);
  });

  it("does not show scroll hint in footer when not scrollable", () => {
    const screen = new ReviewScreen(makeQuestions(3, true), theme as any);
    const output = screen.render(80, 15).join("\n");
    expect(output).not.toContain("↑/↓ scroll");
  });
});

// ── Warning line ──────────────────────────────────────────────────────────────

describe("ReviewScreen — warning line", () => {
  it("shows ✘ error when required questions are unanswered", () => {
    const screen = new ReviewScreen(makeQuestions(3, false), theme as any);
    const output = screen.render(80, 15).join("\n");
    expect(output).toContain("✘");
    expect(output).toContain("required");
  });

  it("shows ⚠ warning when only optional questions are unanswered", () => {
    const qs = makeQuestions(3, false);
    // Mark the required (first) question as answered.
    const answeredInput = {
      ...qs[0]!.input,
      isAnswered: () => true,
      getReviewValue: () => "Answer 1",
    } as any;
    qs[0] = { ...qs[0]!, input: answeredInput };
    const screen = new ReviewScreen(qs, theme as any);
    const output = screen.render(80, 15).join("\n");
    expect(output).toContain("⚠");
    expect(output).toContain("optional");
  });

  it("shows no warning when all questions are answered", () => {
    const screen = new ReviewScreen(makeQuestions(3, true), theme as any);
    const output = screen.render(80, 15).join("\n");
    expect(output).not.toContain("✘");
    expect(output).not.toContain("⚠");
  });
});

// ── Render — scrollbar ────────────────────────────────────────────────────────

describe("ReviewScreen — render (with scroll)", () => {
  it("shows scrollbar characters when questions exceed visible count", () => {
    // maxH=10 → visibleCount = 10-6 = 4; total=10 > 4 → scrollable
    const screen = new ReviewScreen(makeQuestions(10, true), theme as any);
    const output = screen.render(80, 10);
    const hasScrollbar = output.some((l) => l.includes("│") || l.includes("┃"));
    expect(hasScrollbar).toBe(true);
  });

  it("shows exactly visibleCount question rows when scrollable", () => {
    const screen = new ReviewScreen(makeQuestions(10, true), theme as any);
    const output = screen.render(80, 10); // visibleCount = 4
    const rows = output.filter((l) => l.includes("Answer"));
    expect(rows).toHaveLength(4);
  });

  it("includes ↑/↓ scroll hint in footer when scrollable", () => {
    const screen = new ReviewScreen(makeQuestions(10, true), theme as any);
    const output = screen.render(80, 10).join("\n");
    expect(output).toContain("↑/↓ scroll");
  });

  it("pads to visibleCount rows so frame height stays constant while scrolling", () => {
    const screen = new ReviewScreen(makeQuestions(5, true), theme as any);
    // maxH=10 → visibleCount=4; total=5 > 4 → scrollable
    const outputAtTop = screen.render(80, 10);
    screen.handleInput("\x1b[B"); // scroll to offset 1
    screen.handleInput("\x1b[B"); // scroll to offset 2 (bottom: 5-3=2)
    const outputAtBottom = screen.render(80, 10);
    expect(outputAtTop.length).toBe(outputAtBottom.length);
  });

  it("thumb (┃) moves toward bottom when scrolled to end", () => {
    const screen = new ReviewScreen(makeQuestions(10, true), theme as any);
    screen.render(80, 10); // visibleCount=4, maxOffset=6
    // Scroll to the very bottom.
    for (let i = 0; i < 6; i++) screen.handleInput("\x1b[B");
    const output = screen.render(80, 10);
    const rows = output.filter((l) => l.includes("Answer"));
    // The last visible row should have the thumb.
    const lastRow = rows[rows.length - 1]!;
    expect(lastRow).toContain("┃");
  });
});

// ── handleInput ───────────────────────────────────────────────────────────────

describe("ReviewScreen — handleInput", () => {
  it("Enter returns 'submit'", () => {
    const screen = new ReviewScreen(makeQuestions(3, true), theme as any);
    expect(screen.handleInput("\r")).toBe("submit");
  });

  it("↓ returns 'scrolled' and increments offset when not at bottom", () => {
    const screen = new ReviewScreen(makeQuestions(10, true), theme as any);
    screen.render(80, 10); // visibleCount=4
    const result = screen.handleInput("\x1b[B");
    expect(result).toBe("scrolled");
    expect(screen.offset).toBe(1);
  });

  it("↓ returns null at bottom boundary (no further scroll)", () => {
    const screen = new ReviewScreen(makeQuestions(10, true), theme as any);
    screen.render(80, 10); // visibleCount=4, maxOffset=6
    for (let i = 0; i < 6; i++) screen.handleInput("\x1b[B");
    const result = screen.handleInput("\x1b[B");
    expect(result).toBeNull();
    expect(screen.offset).toBe(6);
  });

  it("↑ returns 'scrolled' and decrements offset when not at top", () => {
    const screen = new ReviewScreen(makeQuestions(10, true), theme as any);
    screen.render(80, 10);
    screen.handleInput("\x1b[B"); // offset → 1
    const result = screen.handleInput("\x1b[A");
    expect(result).toBe("scrolled");
    expect(screen.offset).toBe(0);
  });

  it("↑ returns null at top boundary (no further scroll)", () => {
    const screen = new ReviewScreen(makeQuestions(10, true), theme as any);
    screen.render(80, 10);
    const result = screen.handleInput("\x1b[A");
    expect(result).toBeNull();
    expect(screen.offset).toBe(0);
  });

  it("Tab returns null (propagates to Tabs)", () => {
    const screen = new ReviewScreen(makeQuestions(3, true), theme as any);
    expect(screen.handleInput("\t")).toBeNull();
  });

  it("unrecognised key returns null", () => {
    const screen = new ReviewScreen(makeQuestions(3, true), theme as any);
    expect(screen.handleInput("a")).toBeNull();
    expect(screen.handleInput(" ")).toBeNull();
  });
});

// ── reset ─────────────────────────────────────────────────────────────────────

describe("ReviewScreen — reset", () => {
  it("reset() brings scroll offset back to 0", () => {
    const screen = new ReviewScreen(makeQuestions(10, true), theme as any);
    screen.render(80, 10);
    screen.handleInput("\x1b[B"); // offset → 1
    screen.handleInput("\x1b[B"); // offset → 2
    screen.reset();
    expect(screen.offset).toBe(0);
  });

  it("render() after reset() shows the first questions again", () => {
    const screen = new ReviewScreen(makeQuestions(10, true), theme as any);
    screen.render(80, 10);
    for (let i = 0; i < 6; i++) screen.handleInput("\x1b[B"); // scroll to bottom
    screen.reset();
    const output = screen.render(80, 10);
    const rows = output.filter((l) => l.includes("Answer"));
    expect(rows[0]).toContain("Answer 1");
  });
});

// ── different maxH values ─────────────────────────────────────────────────────

describe("ReviewScreen — different maxH values", () => {
  it("maxH=8 (min with 2 visible rows): shows at least 1 question row", () => {
    // visibleCount = max(1, 8-6) = 2
    const screen = new ReviewScreen(makeQuestions(5, true), theme as any);
    const output = screen.render(80, 8);
    const rows = output.filter((l) => l.includes("Answer"));
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it("maxH=15: shows 9 question rows for 10 questions", () => {
    // visibleCount = 15 - 6 = 9
    const screen = new ReviewScreen(makeQuestions(10, true), theme as any);
    const output = screen.render(80, 15);
    const rows = output.filter((l) => l.includes("Answer"));
    expect(rows).toHaveLength(9);
  });

  it("maxH=20: shows all 5 questions without scrollbar", () => {
    // visibleCount = 20 - 6 = 14 > 5 → no scroll
    const screen = new ReviewScreen(makeQuestions(5, true), theme as any);
    const output = screen.render(80, 20);
    const rows = output.filter((l) => l.includes("Answer"));
    expect(rows).toHaveLength(5);
    const hasScrollbar = output.some((l) => l.includes("│") || l.includes("┃"));
    expect(hasScrollbar).toBe(false);
  });

  it("maxH=10: shows 4 visible rows for 10 questions", () => {
    // visibleCount = 10 - 6 = 4
    const screen = new ReviewScreen(makeQuestions(10, true), theme as any);
    const output = screen.render(80, 10);
    const rows = output.filter((l) => l.includes("Answer"));
    expect(rows).toHaveLength(4);
  });
});
