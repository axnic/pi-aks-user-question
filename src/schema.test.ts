/**
 * schema.test.ts — Runtime validation tests for AskUserQuestionParams.
 *
 * Covers the two pattern-based constraints added to the schema:
 *   1. `question` must end with '?' and contain nothing after it.
 *   2. `placeholder` (text question) must be a single line (no \n / \r).
 */

import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "vitest";
import { AskUserQuestionParams, TextQuestionSchema } from "./schema";

// Minimal valid question objects for composing test inputs.
const baseText = {
  id: "q1",
  question: "What is the endpoint?",
  header: "Endpoint",
  type: "text" as const,
  placeholder: "e.g. https://example.com",
};

const baseChoice = {
  id: "q1",
  question: "Which runtime?",
  header: "Runtime",
  type: "choice" as const,
  options: [{ label: "Node.js" }, { label: "Deno" }],
};

// ── question pattern ──────────────────────────────────────────────────────────

describe("schema — question field pattern", () => {
  it("accepts a question ending with '?'", () => {
    expect(
      Value.Check(AskUserQuestionParams, { questions: [baseChoice] }),
    ).toBe(true);
  });

  it("rejects a question with text after '?'", () => {
    const q = {
      ...baseChoice,
      question: "Which runtime? (choose carefully)",
    };
    expect(Value.Check(AskUserQuestionParams, { questions: [q] })).toBe(false);
  });

  it("rejects a question with a note after '?' separated by space", () => {
    const q = {
      ...baseChoice,
      question: "What are the auth details? (do not send unencrypted secrets)",
    };
    expect(Value.Check(AskUserQuestionParams, { questions: [q] })).toBe(false);
  });

  it("rejects a question with multiple '?' marks", () => {
    const q = { ...baseChoice, question: "Do you want A? Or B?" };
    expect(Value.Check(AskUserQuestionParams, { questions: [q] })).toBe(false);
  });
});

// ── placeholder single-line constraint ───────────────────────────────────────

describe("schema — text placeholder single-line constraint", () => {
  it("accepts a plain single-line placeholder", () => {
    expect(Value.Check(TextQuestionSchema, baseText)).toBe(true);
  });

  it("rejects a placeholder containing \\n", () => {
    const q = { ...baseText, placeholder: "line one\nline two" };
    expect(Value.Check(TextQuestionSchema, q)).toBe(false);
  });

  it("rejects a placeholder containing \\r\\n", () => {
    const q = { ...baseText, placeholder: "line one\r\nline two" };
    expect(Value.Check(TextQuestionSchema, q)).toBe(false);
  });

  it("accepts a placeholder with special characters but no newlines", () => {
    const q = { ...baseText, placeholder: "e.g. user@example.com (required)" };
    expect(Value.Check(TextQuestionSchema, q)).toBe(true);
  });
});
