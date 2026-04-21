/**
 * form/tabs.test.ts
 *
 * All tests for the Tabs class: internal navigation state and tab bar rendering.
 *
 * Navigation state covers: handleInput (Tab/Shift+Tab), advance(), retreat(),
 * jumpTo(), activeIndex, isOnReview, and totalTabs.
 *
 * Rendering covers: no-overflow (all chips fit), overflow with ≺ … ≻ ellipsis,
 * and tab status symbols (✔ answered, ✦ required pending, · optional pending, ≡ review).
 *
 * The identity theme (no ANSI codes) lets us assert on plain text directly.
 */

import { describe, expect, it, vi } from "vitest";
import { ChoiceInput } from "./inputs/choice";
import type { InputCallbacks, Theme } from "./inputs/types";
import type { FormQuestion } from "./question";
import { Tabs } from "./tabs";

// ── Identity theme ────────────────────────────────────────────────────────────

const theme: Theme = {
  fg: (_color: string, s: string) => s,
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

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeFormQuestion(
  header: string,
  opts?: { required?: boolean },
): FormQuestion {
  const q = {
    id: header.toLowerCase(),
    question: `Question about ${header}`,
    header,
    type: "choice" as const,
    required: opts?.required ?? false,
    allowOther: false,
    options: [{ label: "A" }, { label: "B" }],
  };
  return {
    question: q.question,
    header: q.header,
    required: q.required,
    input: new ChoiceInput(q, mockEditor(), noopCallbacks()),
  };
}

// ── Navigation state ──────────────────────────────────────────────────────────

describe("Tabs — navigation state", () => {
  it("activeIndex starts at 0", () => {
    const fqs = [makeFormQuestion("A"), makeFormQuestion("B")];
    const tabs = new Tabs(fqs, true, vi.fn(), vi.fn());
    expect(tabs.activeIndex).toBe(0);
    expect(tabs.isOnReview).toBe(false);
  });

  it("totalTabs equals questions + 1 for the review tab", () => {
    const fqs = [makeFormQuestion("A"), makeFormQuestion("B")];
    const tabs = new Tabs(fqs, true, vi.fn(), vi.fn());
    expect(tabs.totalTabs).toBe(3); // 2 questions + review
  });

  it("totalTabs equals questions when hasReviewTab=false", () => {
    const fqs = [makeFormQuestion("A"), makeFormQuestion("B")];
    const tabs = new Tabs(fqs, false, vi.fn(), vi.fn());
    expect(tabs.totalTabs).toBe(2);
  });

  it("Tab key advances activeIndex", () => {
    const fqs = [makeFormQuestion("A"), makeFormQuestion("B")];
    const tabs = new Tabs(fqs, true, vi.fn(), vi.fn());
    const consumed = tabs.handleInput("\t"); // Tab
    expect(consumed).toBe(true);
    expect(tabs.activeIndex).toBe(1);
  });

  it("Shift+Tab retreats activeIndex", () => {
    const fqs = [makeFormQuestion("A"), makeFormQuestion("B")];
    const tabs = new Tabs(fqs, true, vi.fn(), vi.fn());
    tabs.handleInput("\t"); // go to B
    tabs.handleInput("\x1b[Z"); // Shift+Tab — back to A
    expect(tabs.activeIndex).toBe(0);
  });

  it("Tab past last question activates review tab", () => {
    const fqs = [makeFormQuestion("A"), makeFormQuestion("B")];
    const tabs = new Tabs(fqs, true, vi.fn(), vi.fn());
    tabs.handleInput("\t"); // A → B
    tabs.handleInput("\t"); // B → Review
    expect(tabs.isOnReview).toBe(true);
  });

  it("Tab from review wraps back to first question tab", () => {
    const fqs = [makeFormQuestion("A"), makeFormQuestion("B")];
    const tabs = new Tabs(fqs, true, vi.fn(), vi.fn());
    tabs.handleInput("\t"); // A → B
    tabs.handleInput("\t"); // B → Review
    tabs.handleInput("\t"); // Review → A (wrap)
    expect(tabs.isOnReview).toBe(false);
    expect(tabs.activeIndex).toBe(0);
  });

  it("advance() moves forward one step", () => {
    const fqs = [
      makeFormQuestion("A"),
      makeFormQuestion("B"),
      makeFormQuestion("C"),
    ];
    const tabs = new Tabs(fqs, true, vi.fn(), vi.fn());
    tabs.advance();
    expect(tabs.activeIndex).toBe(1);
  });

  it("retreat() moves backward one step", () => {
    const fqs = [makeFormQuestion("A"), makeFormQuestion("B")];
    const tabs = new Tabs(fqs, true, vi.fn(), vi.fn());
    tabs.advance(); // → B
    tabs.retreat(); // → A
    expect(tabs.activeIndex).toBe(0);
  });

  it("jumpTo() navigates directly to a given index", () => {
    const fqs = [
      makeFormQuestion("A"),
      makeFormQuestion("B"),
      makeFormQuestion("C"),
    ];
    const tabs = new Tabs(fqs, true, vi.fn(), vi.fn());
    tabs.jumpTo(2); // jump to C
    expect(tabs.activeIndex).toBe(2);
    expect(tabs.isOnReview).toBe(false);
  });

  it("jumpTo() with review index activates review", () => {
    const fqs = [makeFormQuestion("A"), makeFormQuestion("B")];
    const tabs = new Tabs(fqs, true, vi.fn(), vi.fn());
    tabs.jumpTo(2); // review tab index = fqs.length = 2
    expect(tabs.isOnReview).toBe(true);
  });

  it("handleInput returns false for non-tab keys", () => {
    const fqs = [makeFormQuestion("A"), makeFormQuestion("B")];
    const tabs = new Tabs(fqs, true, vi.fn(), vi.fn());
    expect(tabs.handleInput("\r")).toBe(false);
    expect(tabs.handleInput("x")).toBe(false);
  });

  it("_onTabChange is called with correct arguments on navigation", () => {
    const fqs = [makeFormQuestion("A"), makeFormQuestion("B")];
    const onTabChange = vi.fn();
    const tabs = new Tabs(fqs, true, onTabChange, vi.fn());
    tabs.handleInput("\t"); // 0 → 1
    expect(onTabChange).toHaveBeenCalledWith(0, 1, false);
  });

  it("_onRefresh is called after each navigation", () => {
    const fqs = [makeFormQuestion("A"), makeFormQuestion("B")];
    const onRefresh = vi.fn();
    const tabs = new Tabs(fqs, true, vi.fn(), onRefresh);
    tabs.handleInput("\t");
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});

// ── Rendering — no overflow ───────────────────────────────────────────────────

describe("Tabs.render — no overflow (all chips fit)", () => {
  it("renders all tabs when they fit within width", () => {
    const fqs = [makeFormQuestion("Lang"), makeFormQuestion("Editor")];
    const tabs = new Tabs(fqs, true, vi.fn(), vi.fn());
    const bar = tabs.render(theme, 200);
    expect(bar).toContain("Lang");
    expect(bar).toContain("Editor");
    expect(bar).toContain("Review");
  });

  it("does not show ellipsis when all chips fit", () => {
    const fqs = [makeFormQuestion("A"), makeFormQuestion("B")];
    const tabs = new Tabs(fqs, true, vi.fn(), vi.fn());
    const bar = tabs.render(theme, 200);
    expect(bar).not.toContain("…");
  });
});

// ── Rendering — overflow ──────────────────────────────────────────────────────

describe("Tabs.render — overflow with ≺ … ≻", () => {
  const headers = [
    "Language",
    "Editor",
    "OS",
    "Team Size",
    "CI/CD",
    "Cloud",
    "Framework",
    "Feedback",
  ];

  it("shows ellipsis when chips overflow a narrow width", () => {
    const fqs = headers.map((h) => makeFormQuestion(h));
    const tabs = new Tabs(fqs, true, vi.fn(), vi.fn());
    const bar = tabs.render(theme, 60);
    expect(bar).toContain("…");
  });

  it("active tab (first) is always visible", () => {
    const fqs = headers.map((h) => makeFormQuestion(h));
    const tabs = new Tabs(fqs, true, vi.fn(), vi.fn());
    const bar = tabs.render(theme, 60);
    expect(bar).toContain("Language");
  });

  it("active tab in middle is always visible", () => {
    const fqs = headers.map((h) => makeFormQuestion(h));
    const tabs = new Tabs(fqs, true, vi.fn(), vi.fn());
    tabs.jumpTo(4); // CI/CD
    const bar = tabs.render(theme, 60);
    expect(bar).toContain("CI/CD");
  });

  it("active tab at end is always visible", () => {
    const fqs = headers.map((h) => makeFormQuestion(h));
    const tabs = new Tabs(fqs, true, vi.fn(), vi.fn());
    tabs.jumpTo(7); // Feedback
    const bar = tabs.render(theme, 60);
    expect(bar).toContain("Feedback");
  });

  it("review tab is always visible when active", () => {
    const fqs = headers.map((h) => makeFormQuestion(h));
    const tabs = new Tabs(fqs, true, vi.fn(), vi.fn());
    tabs.jumpTo(fqs.length); // review tab
    const bar = tabs.render(theme, 60);
    expect(bar).toContain("Review");
  });

  it("left ellipsis appears before the active tab when not the first visible", () => {
    const fqs = headers.map((h) => makeFormQuestion(h));
    const tabs = new Tabs(fqs, true, vi.fn(), vi.fn());
    tabs.jumpTo(5); // Cloud
    const bar = tabs.render(theme, 60);
    const cloudIdx = bar.indexOf("Cloud");
    const ellipsisIdx = bar.indexOf("…");
    expect(ellipsisIdx).toBeLessThan(cloudIdx);
  });

  it("wraps in ≺ … ≻ frame", () => {
    const fqs = headers.map((h) => makeFormQuestion(h));
    const tabs = new Tabs(fqs, true, vi.fn(), vi.fn());
    const bar = tabs.render(theme, 60);
    expect(bar).toContain("≺");
    expect(bar).toContain("≻");
  });
});

// ── Rendering — status symbols ────────────────────────────────────────────────

describe("Tabs.render — status symbols", () => {
  it("shows · for unanswered optional question", () => {
    const fqs = [
      makeFormQuestion("Step1"),
      makeFormQuestion("Step2", { required: true }),
      makeFormQuestion("Step3"),
    ];
    const tabs = new Tabs(fqs, true, vi.fn(), vi.fn());
    const bar = tabs.render(theme, 200);
    expect(bar).toContain("·");
  });

  it("shows ✦ for unanswered required question", () => {
    const fqs = [
      makeFormQuestion("Step1"),
      makeFormQuestion("Step2", { required: true }),
      makeFormQuestion("Step3"),
    ];
    const tabs = new Tabs(fqs, true, vi.fn(), vi.fn());
    const bar = tabs.render(theme, 200);
    expect(bar).toMatch(/✦\s+Step2/);
  });

  it("shows ✔ for answered question", () => {
    const fqs = [makeFormQuestion("Step1"), makeFormQuestion("Step2")];
    const input = fqs[0]!.input as ChoiceInput;
    input.handleInput("\r"); // Enter → select first option
    const tabs = new Tabs(fqs, true, vi.fn(), vi.fn());
    const bar = tabs.render(theme, 200);
    expect(bar).toMatch(/✔\s+\[?Step1/);
  });

  it("review tab uses ≡ symbol", () => {
    const fqs = [makeFormQuestion("Step1"), makeFormQuestion("Step2")];
    const tabs = new Tabs(fqs, true, vi.fn(), vi.fn());
    const bar = tabs.render(theme, 200);
    expect(bar).toContain("≡");
  });
});
