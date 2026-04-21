/**
 * form/form.test.ts
 *
 * All tests for the Form class: full-frame rendering (single and multi-question)
 * and handleInput integration (all test scenarios, mixed question types).
 *
 * Key sequences used (legacy terminal):
 *   enter     = "\r"
 *   escape    = "\x1b"
 *   tab       = "\t"
 *   shift+tab = "\x1b[Z"
 *   up        = "\x1b[A"
 *   down      = "\x1b[B"
 *   left      = "\x1b[D"
 *   right     = "\x1b[C"
 *   space     = " "
 */

import { describe, expect, it, vi } from "vitest";
import type { FormResult, Question } from "../types";
import { Form } from "./form";
import { BooleanInput } from "./inputs/boolean";
import { ChoiceInput } from "./inputs/choice";
import { NumberInput } from "./inputs/number";
import { TextInput } from "./inputs/text";
import type { Input, InputCallbacks } from "./inputs/types";
import type { FormQuestion } from "./question";

// ── Keys ──────────────────────────────────────────────────────────────────────

const K = {
  enter: "\r",
  escape: "\x1b",
  tab: "\t",
  shiftTab: "\x1b[Z",
  up: "\x1b[A",
  down: "\x1b[B",
  left: "\x1b[D",
  right: "\x1b[C",
  space: " ",
} as const;

// ── Identity theme (no ANSI) ──────────────────────────────────────────────────

const theme = {
  fg: (_: string, s: string) => s,
  bold: (s: string) => s,
  dim: (s: string) => s,
  italic: (s: string) => s,
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

// ── Setup helpers ─────────────────────────────────────────────────────────────

function setup(questions: Question[]) {
  const editor = new MockEditor();
  const done = vi.fn<(result: FormResult) => void>();

  const deferredCallbacks: InputCallbacks = {
    onAdvance: () => {},
    onRetreat: () => {},
    onSubmit: () => {},
    onRefresh: () => {},
  };

  function createInput(q: Question): Input {
    const ed = editor as unknown as import("@mariozechner/pi-tui").Editor;
    switch (q.type) {
      case "text":
        return new TextInput(q, ed, deferredCallbacks);
      case "number":
        return new NumberInput(q, ed, deferredCallbacks);
      case "choice":
        return new ChoiceInput(q, ed, deferredCallbacks);
      case "multichoice":
        return new ChoiceInput(q, ed, deferredCallbacks, true);
      case "boolean":
        return new BooleanInput(q, ed, deferredCallbacks);
      default:
        throw new Error(`Unhandled question type: ${(q as Question).type}`);
    }
  }

  const formQuestions: FormQuestion[] = questions.map((q) => ({
    question: q.question,
    header: q.header,
    description: q.description,
    required: q.required ?? false,
    input: createInput(q),
  }));

  const form = new Form(
    formQuestions,
    editor as unknown as import("@mariozechner/pi-tui").Editor,
    theme as any, // trunk-ignore(biome/lint/suspicious/noExplicitAny): allowed for test theme
    vi.fn(),
    done,
  );

  const realCallbacks = form.createCallbacks();
  deferredCallbacks.onAdvance = realCallbacks.onAdvance;
  deferredCallbacks.onRetreat = realCallbacks.onRetreat;
  deferredCallbacks.onSubmit = realCallbacks.onSubmit;
  deferredCallbacks.onRefresh = realCallbacks.onRefresh;

  return { form, formQuestions, editor, done };
}

// ── Shared fixtures ───────────────────────────────────────────────────────────

const langQ: Question = {
  id: "language",
  question: "Which programming language do you prefer?",
  header: "Language",
  type: "choice",
  required: false,
  allowOther: true,
  options: [
    { label: "TypeScript", description: "Static typing" },
    { label: "Rust", description: "Memory safety" },
    { label: "Python", description: "Simplicity" },
    { label: "Go", description: "Efficiency" },
  ],
};

const interestsQ: Question = {
  id: "interests",
  question: "Which aspects do you enjoy most?",
  header: "Interests",
  type: "multichoice",
  required: false,
  allowOther: true,
  options: [
    { label: "Code Investigation" },
    { label: "Development" },
    { label: "DevOps/Config" },
    { label: "Architecture & Design" },
    { label: "Testing" },
    { label: "Documentation" },
  ],
};

const feedbackQ: Question = {
  id: "feedback",
  question: "Any feedback?",
  header: "Feedback",
  type: "text",
  required: true,
  placeholder: "Type your feedback here...",
};

// ── Form.render — single-question frame ──────────────────────────────────────

describe("Form.render — single-question frame", () => {
  it("renders HR at top and bottom", () => {
    const { form } = setup([
      {
        id: "q",
        question: "Pick one",
        header: "Q",
        type: "choice",
        options: [{ label: "A" }, { label: "B" }],
        allowOther: false,
      },
    ]);
    const lines = form.render(80);
    expect(lines[0]).toMatch(/─{10,}/);
    expect(lines[lines.length - 1]).toMatch(/─{10,}/);
  });

  it("contains the question text", () => {
    const { form } = setup([
      {
        id: "lang",
        question: "Which language do you prefer?",
        header: "Lang",
        type: "choice",
        options: [{ label: "TS" }, { label: "Rust" }],
        allowOther: false,
      },
    ]);
    const full = form.render(80).join("\n");
    expect(full).toContain("Which language do you prefer?");
  });

  it("contains the description when provided", () => {
    const { form } = setup([
      {
        id: "q",
        question: "Choose",
        header: "Q",
        type: "choice",
        description: "This is important context",
        options: [{ label: "A" }, { label: "B" }],
        allowOther: false,
      },
    ]);
    const full = form.render(80).join("\n");
    expect(full).toContain("This is important context");
  });

  it("contains footer hints", () => {
    const { form } = setup([
      {
        id: "q",
        question: "Pick",
        header: "Q",
        type: "choice",
        options: [{ label: "A" }, { label: "B" }],
        allowOther: false,
      },
    ]);
    const full = form.render(80).join("\n");
    expect(full).toContain("navigate");
    expect(full).toContain("select");
    expect(full).toContain("Esc quit");
  });

  it("single-question: no tab bar (no ≺ / ≻)", () => {
    const { form } = setup([
      {
        id: "q",
        question: "Pick",
        header: "Q",
        type: "choice",
        options: [{ label: "A" }, { label: "B" }],
        allowOther: false,
      },
    ]);
    const full = form.render(80).join("\n");
    expect(full).not.toContain("≺");
    expect(full).not.toContain("≻");
  });

  it("isMulti is false for a single question", () => {
    const { form } = setup([langQ]);
    expect(form.isMulti).toBe(false);
  });
});

// ── Form.render — multi-question ──────────────────────────────────────────────

describe("Form.render — multi-question", () => {
  function setupMulti() {
    const ed = new MockEditor();
    const done = vi.fn<(result: FormResult) => void>();
    const deferredCallbacks: InputCallbacks = {
      onAdvance: () => {},
      onRetreat: () => {},
      onSubmit: () => {},
      onRefresh: () => {},
    };
    const edRef = ed as unknown as import("@mariozechner/pi-tui").Editor;

    const questions: Question[] = [
      {
        id: "lang",
        question: "Language?",
        header: "Lang",
        type: "choice",
        options: [{ label: "TS" }, { label: "Rust" }],
        allowOther: false,
      },
      {
        id: "ok",
        question: "Confirm?",
        header: "OK",
        type: "boolean",
      },
    ];

    const formQuestions: FormQuestion[] = questions.map((q) => ({
      question: q.question,
      header: q.header,
      required: false,
      input:
        q.type === "choice"
          ? new ChoiceInput(q, edRef, deferredCallbacks)
          : new BooleanInput(q as any, edRef, deferredCallbacks),
    }));

    const form = new Form(formQuestions, edRef, theme as any, vi.fn(), done);
    const real = form.createCallbacks();
    deferredCallbacks.onAdvance = real.onAdvance;
    deferredCallbacks.onRetreat = real.onRetreat;
    deferredCallbacks.onSubmit = real.onSubmit;
    deferredCallbacks.onRefresh = real.onRefresh;

    return { form, editor: ed, done };
  }

  it("isMulti is true for multiple questions", () => {
    const { form } = setupMulti();
    expect(form.isMulti).toBe(true);
  });

  it("renders tab bar with ≺ and ≻", () => {
    const { form } = setupMulti();
    const full = form.render(80).join("\n");
    expect(full).toContain("≺");
    expect(full).toContain("≻");
  });

  it("tab bar contains question headers", () => {
    const { form } = setupMulti();
    const full = form.render(80).join("\n");
    expect(full).toContain("Lang");
    expect(full).toContain("OK");
    expect(full).toContain("Review");
  });

  it("contains Tab/Shift+Tab switch question hint", () => {
    const { form } = setupMulti();
    const full = form.render(80).join("\n");
    expect(full).toContain("Tab/Shift+Tab switch question");
  });

  it("shows exit confirm dialog after Escape", () => {
    const { form } = setupMulti();
    form.handleInput(K.escape);
    form.invalidate();
    const full = form.render(80).join("\n");
    expect(full).toContain("Are you sure you want to quit?");
    expect(full).toContain("[Y]");
    expect(full).toContain("[N]");
  });

  it("shows review screen when on review tab", () => {
    const { form } = setupMulti();
    form.handleInput(K.tab); // → OK
    form.handleInput(K.tab); // → Review
    form.invalidate();
    const full = form.render(80).join("\n");
    expect(full).toContain("Review your answers");
    expect(full).toContain("Enter submit");
  });

  it("shows validation error in rendered frame", () => {
    const ed = new MockEditor();
    const done = vi.fn();
    const deferredCallbacks: InputCallbacks = {
      onAdvance: () => {},
      onRetreat: () => {},
      onSubmit: () => {},
      onRefresh: () => {},
    };
    const edRef = ed as unknown as import("@mariozechner/pi-tui").Editor;
    const q: Question = {
      id: "ip",
      question: "IP?",
      header: "IP",
      type: "text",
      placeholder: "1.2.3.4",
      validation: { format: "ipv4", errorMessage: "Bad IP" },
    };
    const fqs: FormQuestion[] = [
      {
        question: q.question,
        header: q.header,
        required: true,
        input: new TextInput(q, edRef, deferredCallbacks),
      },
    ];
    const form = new Form(fqs, edRef, theme as any, vi.fn(), done);
    const real = form.createCallbacks();
    deferredCallbacks.onAdvance = real.onAdvance;
    deferredCallbacks.onRetreat = real.onRetreat;
    deferredCallbacks.onSubmit = real.onSubmit;
    deferredCallbacks.onRefresh = real.onRefresh;

    ed.setText("bad");
    form.handleInput(K.enter);
    form.invalidate();
    const full = form.render(80).join("\n");
    expect(full).toContain("✘");
    expect(full).toContain("Bad IP");
  });
});

// ── test 01: Single-choice ────────────────────────────────────────────────────

describe("Form — test 01: single-choice (single-select, allowOther)", () => {
  it("Space selects first option; Enter submits", () => {
    const { form, done } = setup([langQ]);
    form.handleInput(K.space);
    form.handleInput(K.enter);
    expect(done).toHaveBeenCalledOnce();
    expect(done.mock.calls[0]![0].cancelled).toBe(false);
    expect(done.mock.calls[0]![0].answers[0]!.value).toBe("TypeScript");
  });

  it("↓ moves cursor without selecting", () => {
    const { form, formQuestions } = setup([langQ]);
    form.handleInput(K.down);
    expect(formQuestions[0]!.input.isAnswered()).toBe(false);
  });

  it("↓↓ Space selects third option; Enter submits", () => {
    const { form, done } = setup([langQ]);
    form.handleInput(K.down);
    form.handleInput(K.down);
    form.handleInput(K.space);
    form.handleInput(K.enter);
    expect(done.mock.calls[0]![0].answers[0]!.value).toBe("Python");
  });

  it("Escape → Y confirms cancel", () => {
    const { form, done } = setup([langQ]);
    form.handleInput(K.escape);
    form.handleInput("Y");
    expect(done).toHaveBeenCalledWith(
      expect.objectContaining({ cancelled: true }),
    );
  });

  it("Escape → N dismisses dialog, form continues", () => {
    const { form, done } = setup([langQ]);
    form.handleInput(K.escape);
    form.handleInput("N");
    expect(done).not.toHaveBeenCalled();
    form.handleInput(K.enter);
    expect(done).toHaveBeenCalledOnce();
  });
});

// ── test 02: Multi-select ─────────────────────────────────────────────────────

describe("Form — test 02: multi-select (checkboxes)", () => {
  it("Space toggles a checkbox on", () => {
    const { form, formQuestions } = setup([interestsQ]);
    form.handleInput(K.space);
    expect(formQuestions[0]!.input.getTypedValue() as string[]).toContain(
      "Code Investigation",
    );
  });

  it("Space again toggles a checkbox off", () => {
    const { form, formQuestions } = setup([interestsQ]);
    form.handleInput(K.space);
    form.handleInput(K.space);
    expect(formQuestions[0]!.input.getTypedValue() as string[]).not.toContain(
      "Code Investigation",
    );
  });

  it("Space also toggles a checkbox (alias test)", () => {
    const { form, formQuestions } = setup([interestsQ]);
    form.handleInput(K.space);
    expect(formQuestions[0]!.input.getTypedValue() as string[]).toContain(
      "Code Investigation",
    );
  });

  it("multiple options can be selected", () => {
    const { form, formQuestions } = setup([interestsQ]);
    form.handleInput(K.space);
    form.handleInput(K.down);
    form.handleInput(K.space);
    const val = formQuestions[0]!.input.getTypedValue() as string[];
    expect(val).toContain("Code Investigation");
    expect(val).toContain("Development");
  });
});

// ── test 03: Multi-question form ──────────────────────────────────────────────

describe("Form — test 03: multi-question (tab bar, navigation, review)", () => {
  const vibeQ: Question = {
    id: "vibe-check",
    question: "Are you having a productive day?",
    header: "Vibe Check",
    type: "choice",
    required: false,
    allowOther: false,
    options: [{ label: "Yes" }, { label: "No" }],
  };
  const questions: Question[] = [
    { ...interestsQ, allowOther: false } as Question,
    vibeQ,
    feedbackQ,
  ];

  it("Tab advances to next tab", () => {
    const { form, formQuestions } = setup(questions);
    form.handleInput(K.tab); // multichoice doesn't consume Tab → Tabs handles it
    form.handleInput(K.enter); // selects "Yes" on vibeQ
    form.handleInput("H");
    form.handleInput("i");
    expect(formQuestions[2]!.input.isAnswered()).toBe(false);
  });

  it("Shift+Tab goes back", () => {
    const { form } = setup(questions);
    form.handleInput(K.tab);
    form.handleInput(K.shiftTab);
    // No crash — we're back on multichoice
    expect(() => form.handleInput(K.enter)).not.toThrow();
  });

  it("Enter on review tab submits the form", () => {
    const { form, done } = setup(questions);
    form.handleInput(K.tab);
    form.handleInput(K.tab);
    form.handleInput(K.tab);
    form.handleInput(K.enter);
    expect(done).toHaveBeenCalledOnce();
    expect(done.mock.calls[0]![0]!.cancelled).toBe(false);
  });

  it("answers collected from all tabs on submit", () => {
    const { form, editor, done } = setup(questions);
    form.handleInput(K.space); // toggle Code Investigation
    form.handleInput(K.tab); // → vibeQ
    form.handleInput(K.space); // select Yes
    form.handleInput(K.tab); // → feedbackQ
    editor.setText("All good");
    form.handleInput(K.tab); // → review (deactivate saves editor text)
    form.handleInput(K.enter); // submit
    const result = done.mock.calls[0]![0]!;
    expect(result.answers[0]!.value).toContain("Code Investigation");
    expect(result.answers[1]!.value).toBe("Yes");
  });
});

// ── test 04: Text with validation ─────────────────────────────────────────────

describe("Form — test 04: text validation (ipv4)", () => {
  const ipQ: Question = {
    id: "server-ip",
    question: "What is the IP address?",
    header: "Server IP",
    type: "text",
    required: true,
    placeholder: "e.g. 192.168.1.1",
    validation: {
      format: "ipv4" as const,
      errorMessage: "Must be a valid IPv4 address",
    },
  };

  it("invalid IP: Enter shows validation error", () => {
    const { form, editor, formQuestions } = setup([ipQ]);
    editor.setText("not-an-ip");
    form.handleInput(K.enter);
    expect(formQuestions[0]!.input.getValidationError()).toBe(
      "Must be a valid IPv4 address",
    );
  });

  it("valid IP: Enter clears error and submits", () => {
    const { form, editor, formQuestions, done } = setup([ipQ]);
    editor.setText("192.168.1.1");
    form.handleInput(K.enter);
    expect(formQuestions[0]!.input.getValidationError()).toBeUndefined();
    expect(done).toHaveBeenCalledOnce();
  });

  it("typing after error clears the error immediately", () => {
    const { form, editor, formQuestions } = setup([ipQ]);
    editor.setText("bad");
    form.handleInput(K.enter);
    expect(formQuestions[0]!.input.getValidationError()).toBeTruthy();
    form.handleInput("a");
    expect(formQuestions[0]!.input.getValidationError()).toBeUndefined();
  });
});

// ── test 06: Review screen state ──────────────────────────────────────────────

describe("Form — test 06: review screen (required / optional state)", () => {
  const optQ: Question = {
    ...interestsQ,
    required: false,
    allowOther: false,
  } as Question;
  const reqChoiceQ: Question = {
    id: "deployment",
    question: "Preferred deployment approach?",
    header: "Deployment",
    type: "choice",
    required: true,
    allowOther: false,
    options: [{ label: "Containers" }, { label: "Serverless" }],
  };
  const reqStringQ: Question = {
    ...feedbackQ,
    id: "workflow",
    question: "Describe your ideal development workflow.",
    header: "Workflow",
  };

  it("scenario A: 0 required answered → unansweredRequired = 2", () => {
    const { formQuestions } = setup([optQ, reqChoiceQ, reqStringQ]);
    const count = formQuestions.filter(
      (fq) => fq.required && !fq.input.isAnswered(),
    ).length;
    expect(count).toBe(2);
  });

  it("scenario B: required answered, optional skipped → unansweredOptional = 1", () => {
    const { form, editor, formQuestions } = setup([
      optQ,
      reqChoiceQ,
      reqStringQ,
    ]);
    form.handleInput(K.tab); // → reqChoiceQ
    form.handleInput(K.space); // select Containers
    form.handleInput(K.tab); // → reqStringQ (activate)
    editor.setText("Agile workflow");
    form.handleInput(K.tab); // → review (deactivate saves text)
    const unansweredRequired = formQuestions.filter(
      (fq) => fq.required && !fq.input.isAnswered(),
    ).length;
    const unansweredOptional = formQuestions.filter(
      (fq) => !fq.required && !fq.input.isAnswered(),
    ).length;
    expect(unansweredRequired).toBe(0);
    expect(unansweredOptional).toBe(1);
  });

  it("Enter on review always submits even if required unanswered", () => {
    const { form, done } = setup([optQ, reqChoiceQ, reqStringQ]);
    form.handleInput(K.tab);
    form.handleInput(K.tab);
    form.handleInput(K.tab);
    form.handleInput(K.enter);
    expect(done).toHaveBeenCalledOnce();
  });
});

// ── test 07: Binary choice ────────────────────────────────────────────────────

describe("Form — test 07: binary choice (allowOther: false)", () => {
  const binaryQ: Question = {
    id: "agreement",
    question: "Do you agree?",
    header: "Agreement",
    type: "choice",
    required: true,
    allowOther: false,
    options: [{ label: "Agree" }, { label: "Disagree" }],
  };

  it("Space selects Agree; Enter submits", () => {
    const { form, done } = setup([binaryQ]);
    form.handleInput(K.space);
    form.handleInput(K.enter);
    expect(done).toHaveBeenCalledOnce();
    expect(done.mock.calls[0]![0]!.answers[0]!.value).toBe("Agree");
  });

  it("↓ Space selects Disagree; Enter submits", () => {
    const { form, done } = setup([binaryQ]);
    form.handleInput(K.down);
    form.handleInput(K.space);
    form.handleInput(K.enter);
    expect(done.mock.calls[0]![0]!.answers[0]!.value).toBe("Disagree");
  });
});

// ── test 08: Complex full flow ────────────────────────────────────────────────

describe("Form — test 08: complex full flow (5 questions, mixed types)", () => {
  const roleQ: Question = {
    id: "role",
    question: "What is your primary role?",
    header: "Role",
    type: "choice",
    required: true,
    allowOther: true,
    options: [
      { label: "Frontend Engineer" },
      { label: "Backend Engineer" },
      { label: "Full-stack Engineer" },
      { label: "DevOps/SRE" },
      { label: "Engineering Manager" },
    ],
  };
  const stackQ: Question = {
    id: "stack",
    question: "Which technologies are part of your current stack?",
    header: "Stack",
    type: "multichoice",
    required: true,
    allowOther: false,
    description: "This helps tailor the suggestions to your environment.",
    options: [
      { label: "TypeScript / JavaScript" },
      { label: "React / Next.js" },
      { label: "Node.js" },
      { label: "PostgreSQL" },
      { label: "Redis" },
      { label: "Docker / Kubernetes" },
      { label: "AWS / GCP / Azure" },
    ],
  };
  const painQ: Question = {
    id: "pain-points",
    question: "What are your biggest pain points?",
    header: "Pain Points",
    type: "multichoice",
    required: false,
    allowOther: false,
    options: [
      { label: "Slow build times" },
      { label: "Flaky tests" },
      { label: "Poor documentation" },
      { label: "Technical debt" },
    ],
  };
  const goalQ: Question = {
    id: "goal",
    question: "What is the main thing you want to accomplish?",
    header: "Goal",
    type: "text",
    required: true,
    placeholder: "Describe your goal...",
  };
  const timelineQ: Question = {
    id: "timeline",
    question: "What is your target timeline?",
    header: "Timeline",
    type: "choice",
    required: false,
    allowOther: false,
    options: [
      { label: "Today" },
      { label: "This week" },
      { label: "This sprint" },
      { label: "Next month" },
    ],
  };
  const questions: Question[] = [roleQ, stackQ, painQ, goalQ, timelineQ];

  it("creates a multi-question form", () => {
    const { form } = setup(questions);
    expect(form.isMulti).toBe(true);
  });

  it("3 required questions unanswered initially (Role, Stack, Goal)", () => {
    const { formQuestions } = setup(questions);
    const count = formQuestions.filter(
      (fq) => fq.required && !fq.input.isAnswered(),
    ).length;
    expect(count).toBe(3);
  });

  it("full form: answer all questions and submit", () => {
    const { form, editor, done } = setup(questions);

    form.handleInput(K.space); // Role: select Frontend Engineer
    form.handleInput(K.tab); // → Stack

    form.handleInput(K.space); // toggle TypeScript
    form.handleInput(K.down);
    form.handleInput(K.space); // toggle React
    form.handleInput(K.tab); // → Pain Points

    form.handleInput(K.tab); // skip Pain Points → Goal

    editor.setText("Improve build pipeline");
    form.handleInput(K.tab); // → Timeline (deactivate saves text)

    form.handleInput(K.space); // select Today
    form.handleInput(K.tab); // → Review

    form.handleInput(K.enter); // submit

    expect(done).toHaveBeenCalledOnce();
    const result = done.mock.calls[0]![0]!;
    expect(result.cancelled).toBe(false);
    expect(result.answers[0]!.value).toBe("Frontend Engineer");
    expect(result.answers[1]!.value).toContain("TypeScript / JavaScript");
    expect(result.answers[4]!.value).toBe("Today");
  });

  it("Escape from any tab cancels the form", () => {
    const { form, done } = setup(questions);
    form.handleInput(K.tab);
    form.handleInput(K.tab);
    form.handleInput(K.escape);
    form.handleInput("Y");
    expect(done).toHaveBeenCalledWith(
      expect.objectContaining({ cancelled: true }),
    );
  });
});

// ── Review screen — scroll (Bug: tab bar height glitch) ───────────────────────

describe("Form — review screen scroll (fixed height, Bug fix)", () => {
  /** Creates N simple boolean questions (one line each in review). */
  function makeQuestions(n: number): Question[] {
    return Array.from({ length: n }, (_, i) => ({
      id: `q${i}`,
      question: `Question ${i}?`,
      header: `Q${i}`,
      type: "boolean" as const,
      required: false,
    }));
  }

  /** Navigate to the review tab (press Tab n times from start). */
  function goToReview(form: Form, n: number) {
    for (let i = 0; i < n; i++) form.handleInput(K.tab);
  }

  it("with ≤8 questions: no scroll indicators in review render", () => {
    const { form } = setup(makeQuestions(4));
    goToReview(form, 4);
    const lines = form.render(80);
    const joined = lines.join("\n");
    expect(joined).not.toContain("more above");
    expect(joined).not.toContain("more below");
  });

  it("with >8 questions: scrollbar appears when questions exceed visible count", () => {
    const { form } = setup(makeQuestions(10));
    goToReview(form, 10);
    const lines = form.render(80);
    // New design: left-side scrollbar chars (│/┃) replace the old text indicators.
    const hasScrollbar = lines.some((l) => l.includes("│") || l.includes("┃"));
    expect(hasScrollbar).toBe(true);
  });

  it("scrolling down hides first rows and shows later rows", () => {
    const { form } = setup(makeQuestions(10));
    goToReview(form, 10);
    form.handleInput(K.down); // scroll down
    const lines = form.render(80);
    const joined = lines.join("\n");
    expect(joined).not.toContain("Question 0?"); // first row scrolled out of view
    expect(joined).toContain("Question 1?"); // second row now visible at top
  });

  it("with few questions: no padding — review is shorter than with many questions", () => {
    const { form: form2 } = setup(makeQuestions(2));
    goToReview(form2, 2);

    const { form: form8 } = setup(makeQuestions(8));
    goToReview(form8, 8);

    // 2 questions should render fewer lines than 8 (no padding to 8)
    expect(form2.render(80).length).toBeLessThan(form8.render(80).length);
  });

  it("with >8 questions: height is fixed at REVIEW_MAX_VISIBLE rows", () => {
    const { form: form10 } = setup(makeQuestions(10));
    goToReview(form10, 10);

    const { form: form15 } = setup(makeQuestions(15));
    goToReview(form15, 15);

    // Both should pad to exactly REVIEW_MAX_VISIBLE, so same height
    expect(form10.render(80).length).toBe(form15.render(80).length);
  });

  it("review height is constant whether questions are answered or not (warning block reserved)", () => {
    const { form: formEmpty } = setup(makeQuestions(4)); // all unanswered → warning shown
    goToReview(formEmpty, 4);
    const heightEmpty = formEmpty.render(80).length;

    // Answer all questions then check review height.
    const { form: formAnswered, formQuestions } = setup(makeQuestions(4));
    // BooleanInput: pressing Enter selects Yes and advances — just mark them answered directly.
    formQuestions.forEach((fq) => fq.input.handleInput("\r")); // Enter on boolean = select Yes
    goToReview(formAnswered, 4);
    const heightAnswered = formAnswered.render(80).length;

    expect(heightAnswered).toBe(heightEmpty);
  });

  it("↑ does nothing when already at the top", () => {
    const { form } = setup(makeQuestions(10));
    goToReview(form, 10);
    form.handleInput(K.up); // no-op — already at 0
    const lines = form.render(80);
    expect(lines.join("\n")).not.toContain("more above");
  });

  it("↓ does nothing when already at the bottom", () => {
    const { form } = setup(makeQuestions(10));
    goToReview(form, 10);
    // Scroll to the very bottom (10 - 9 = 1 scroll needed; REVIEW_MAX_H=15 → visibleCount=9).
    form.handleInput(K.down);
    form.handleInput(K.down); // no-op at bottom
    form.handleInput(K.down); // no-op at bottom
    const lines = form.render(80);
    expect(lines.join("\n")).not.toContain("more below");
  });

  it("scroll offset resets when leaving and returning to review", () => {
    const { form } = setup(makeQuestions(10));
    goToReview(form, 10);
    form.handleInput(K.down);
    form.handleInput(K.shiftTab); // leave review → go back to last input
    form.handleInput(K.tab); // return to review
    const lines = form.render(80);
    // Scroll reset → ↑ indicator should be absent again.
    expect(lines.join("\n")).not.toContain("↑ ");
  });

  it("with >8 questions: footer shows scroll hint", () => {
    const { form } = setup(makeQuestions(10));
    goToReview(form, 10);
    const lines = form.render(80);
    const joined = lines.join("\n");
    expect(joined).toContain("↑/↓ scroll");
  });

  it("with ≤8 questions: footer does not show scroll hint", () => {
    const { form } = setup(makeQuestions(5));
    goToReview(form, 5);
    const lines = form.render(80);
    const joined = lines.join("\n");
    expect(joined).not.toContain("↑/↓ scroll");
  });
});

describe("Form — Other... mode integration", () => {
  it("Escape in otherMode exits otherMode without cancelling form", () => {
    const { form, editor, done } = setup([langQ]);
    for (let i = 0; i < 4; i++) form.handleInput(K.down); // reach Other row
    form.handleInput(K.space); // enter otherMode
    editor.setText("partial text");
    form.handleInput(K.escape); // exit otherMode, NOT cancel form
    expect(done).not.toHaveBeenCalled();
    // Cursor is back on Other... row — navigate up to a regular option and submit
    form.handleInput(K.up); // → Go
    form.handleInput(K.space); // select Go
    form.handleInput(K.enter); // advance/submit
    expect(done).toHaveBeenCalledOnce();
    expect(done.mock.calls[0]![0]!.answers[0]!.value).toBe("Go");
  });

  it("typing text in otherMode and confirming gives that value", () => {
    const { form, editor, done } = setup([langQ]);
    for (let i = 0; i < 4; i++) form.handleInput(K.down);
    form.handleInput(K.space); // enter otherMode
    editor.setText("Haskell");
    form.handleInput(K.enter); // confirm
    expect(done).toHaveBeenCalledOnce();
    expect(done.mock.calls[0]![0]!.answers[0]!.value).toBe("Haskell");
  });
});
