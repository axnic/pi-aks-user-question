import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildScenariiReply,
  buildToolResultReply,
  loadScenarii,
  parseSandboxArgs,
} from "./scenarii.mjs";

describe("parseSandboxArgs", () => {
  it("requires a scenarii file", () => {
    expect(() => parseSandboxArgs([])).toThrow("--scenarii is required");
  });

  it("extracts the scenarii and forwards pi args", () => {
    expect(
      parseSandboxArgs([
        "--scenarii",
        "docs/demo/basic.scenarii.json",
        "--",
        "--list-models",
      ]),
    ).toEqual({
      help: false,
      piArgs: ["--list-models"],
      scenariiPath: "docs/demo/basic.scenarii.json",
    });
  });

  it("supports --scenarii=<file>", () => {
    expect(parseSandboxArgs(["--scenarii=demo.json"])).toEqual({
      help: false,
      piArgs: [],
      scenariiPath: "demo.json",
    });
  });

  it("returns help without requiring a scenarii", () => {
    expect(parseSandboxArgs(["--help"])).toEqual({
      help: true,
      piArgs: [],
      scenariiPath: null,
    });
  });
});

describe("loadScenarii", () => {
  it("loads and normalizes a valid text scenarii file", () => {
    const filePath = writeScenariiFile([
      {
        assistant: "  Sure.  ",
        user: "  Ask me for my deployment target.  ",
      },
    ]);

    expect(loadScenarii(filePath)).toEqual({
      entries: [
        {
          assistant: "Sure.",
          user: "Ask me for my deployment target.",
        },
      ],
      source: filePath,
    });
  });

  it("loads a tool_call entry", () => {
    const filePath = writeScenariiFile([
      {
        user: "Configure the server",
        tool_call: { name: "ask_user_question", arguments: { questions: [] } },
      },
    ]);

    expect(loadScenarii(filePath)).toEqual({
      entries: [
        {
          user: "Configure the server",
          tool_call: {
            name: "ask_user_question",
            arguments: { questions: [] },
          },
        },
      ],
      source: filePath,
    });
  });

  it("loads a tool_call entry with a tool_return_observation field", () => {
    const filePath = writeScenariiFile([
      {
        user: "Configure the server",
        tool_call: { name: "ask_user_question", arguments: { questions: [] } },
        tool_return_observation: "Done! {{ tool.response }}",
      },
    ]);

    expect(loadScenarii(filePath)).toEqual({
      entries: [
        {
          user: "Configure the server",
          tool_call: {
            name: "ask_user_question",
            arguments: { questions: [] },
          },
          tool_return_observation: "Done! {{ tool.response }}",
        },
      ],
      source: filePath,
    });
  });

  it("rejects empty scenarii lists", () => {
    const filePath = writeScenariiFile([]);
    expect(() => loadScenarii(filePath)).toThrow(
      "Scenarii file must be a non-empty JSON array",
    );
  });
});

describe("buildScenariiReply", () => {
  const scenarii = [
    {
      assistant: "Opening the form now.",
      user: "Ask me for my preferred deployment environment.",
    },
    {
      user: "Configure the server",
      tool_call: { name: "ask_user_question", arguments: { questions: [] } },
      tool_return_observation: "All done! Results: {{ tool.response }}",
    },
    {
      assistant:
        "This extension renders a terminal form for structured answers.",
      user: "Summarize this project in one sentence.",
    },
  ];

  it("returns a text reply for a matching text entry", () => {
    expect(
      buildScenariiReply(
        scenarii,
        "  Ask me for my preferred deployment environment. ",
      ),
    ).toEqual({ type: "text", text: "Opening the form now." });
  });

  it("returns a tool_call reply for a matching tool_call entry", () => {
    expect(buildScenariiReply(scenarii, "Configure the server")).toEqual({
      type: "tool_call",
      name: "ask_user_question",
      arguments: { questions: [] },
    });
  });

  it("returns a text allowlist message when no entry matches", () => {
    const reply = buildScenariiReply(scenarii, "Do something else");
    expect(reply.type).toBe("text");
    expect(reply.text).toContain("Only the following prompts are allowed");
    expect(reply.text).toContain(
      "- Ask me for my preferred deployment environment.",
    );
  });

  it("excludes tool_return_observation from the allowlist (all entries have user)", () => {
    const reply = buildScenariiReply(scenarii, "Do something else");
    expect(reply.text).not.toContain("undefined");
  });
});

describe("buildToolResultReply", () => {
  const scenarii = [
    {
      user: "Configure the server",
      tool_call: { name: "ask_user_question", arguments: {} },
      tool_return_observation:
        "Server configured. Details:\n\n{{ tool.response }}",
    },
    {
      user: "Configure the database",
      tool_call: { name: "ask_user_question", arguments: {} },
      tool_return_observation: "DB configured. Details:\n\n{{ tool.response }}",
    },
  ];

  it("substitutes {{ tool.response }} using the trigger prompt", () => {
    const reply = buildToolResultReply(
      scenarii,
      "Configure the server",
      "port=8080",
    );
    expect(reply).toEqual({
      type: "text",
      text: "Server configured. Details:\n\nport=8080",
    });
  });

  it("picks the correct entry when multiple tool_calls share the same tool name", () => {
    const reply = buildToolResultReply(
      scenarii,
      "Configure the database",
      "db=postgres",
    );
    expect(reply.text).toBe("DB configured. Details:\n\ndb=postgres");
  });

  it("returns a generic fallback when no matching entry has tool_return_observation", () => {
    const reply = buildToolResultReply(scenarii, "Unknown prompt", "data");
    expect(reply.type).toBe("text");
    expect(reply.text).toBe("Tool completed.");
  });
});

function writeScenariiFile(value) {
  const directory = mkdtempSync(path.join(tmpdir(), "sandboxed-pi-"));
  const filePath = path.join(directory, "scenarii.json");
  writeFileSync(filePath, JSON.stringify(value, null, 2));
  return filePath;
}
