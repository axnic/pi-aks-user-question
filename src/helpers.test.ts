/**
 * helpers.test.ts
 *
 * Unit tests for pure helper functions:
 *   stripAnsi()   — removes ANSI escape codes
 *   isBorderLine() — detects Editor border separator lines
 */

import { describe, expect, it } from "vitest";
import { isBorderLine, stripAnsi } from "./helpers";

// ── stripAnsi ─────────────────────────────────────────────────────────────────

describe("stripAnsi", () => {
  it("removes a simple SGR escape", () => {
    expect(stripAnsi("\x1b[31mred\x1b[0m")).toBe("red");
  });

  it("removes bold escape", () => {
    expect(stripAnsi("\x1b[1mbolded\x1b[0m")).toBe("bolded");
  });

  it("leaves a plain string unchanged", () => {
    expect(stripAnsi("hello world")).toBe("hello world");
  });

  it("removes multiple codes in one string", () => {
    expect(stripAnsi("\x1b[32mgreen\x1b[0m and \x1b[33myellow\x1b[0m")).toBe(
      "green and yellow",
    );
  });

  it("handles an empty string", () => {
    expect(stripAnsi("")).toBe("");
  });
});

// ── isBorderLine ──────────────────────────────────────────────────────────────

describe("isBorderLine", () => {
  it("detects a plain ─ border line", () => {
    expect(isBorderLine("─────────────")).toBe(true);
  });

  it("detects a border line wrapped in ANSI codes", () => {
    expect(isBorderLine("\x1b[34m─────\x1b[0m")).toBe(true);
  });

  it("returns false for a regular text line", () => {
    expect(isBorderLine("hello")).toBe(false);
  });

  it("returns false for a line with mixed characters", () => {
    expect(isBorderLine("─── hello ───")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isBorderLine("")).toBe(false);
  });
});
