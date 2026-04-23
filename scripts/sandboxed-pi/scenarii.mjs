import { readFileSync } from "node:fs";

/**
 * Parses the `scripts/sandboxed-pi/index.mjs` command-line arguments.
 *
 * Recognised flags:
 *   --help / -h               Print usage and exit (sets `help: true`).
 *   --scenarii <file>         Path to the scenarii JSON file (required).
 *   --scenarii=<file>         Inline form of the above.
 *   --                        Everything after this is forwarded to pi as-is.
 *
 * @param {string[]} argv - `process.argv.slice(2)` or equivalent.
 * @returns {{ help: true, piArgs: [], scenariiPath: null }
 *          | { help: false, piArgs: string[], scenariiPath: string }}
 * @throws {Error} If --scenarii is missing or has no value.
 */
export function parseSandboxArgs(argv) {
  const piArgs = [];
  let scenariiPath = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--") {
      piArgs.push(...argv.slice(index + 1));
      break;
    }

    if (arg === "--help" || arg === "-h") {
      return { help: true, piArgs: [], scenariiPath: null };
    }

    if (arg === "--scenarii") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("--scenarii requires a file path");
      }
      scenariiPath = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--scenarii=")) {
      scenariiPath = arg.slice("--scenarii=".length);
      if (!scenariiPath) {
        throw new Error("--scenarii requires a file path");
      }
      continue;
    }

    piArgs.push(arg);
  }

  if (!scenariiPath) {
    throw new Error("--scenarii is required");
  }

  return { help: false, piArgs, scenariiPath };
}

/** Prints usage information to stderr. */
export function printSandboxUsage() {
  console.error(
    [
      "Usage: node scripts/sandboxed-pi/index.mjs --scenarii <file> [pi args]",
      "",
      "Launch pi in an isolated demo home with a canned scenarii provider.",
      "",
      "Examples:",
      "  node scripts/sandboxed-pi/index.mjs --scenarii docs/demo/basic.scenarii.json",
      "  node scripts/sandboxed-pi/index.mjs --scenarii docs/demo/basic.scenarii.json -- --list-models",
    ].join("\n"),
  );
}

/**
 * Reads, parses and validates a scenarii file from disk.
 *
 * The file must be a JSON array of entries, each either:
 *   - `{ user: string, assistant: string }` — plain text response
 *   - `{ user: string, tool_call: { name, arguments }, tool_return_observation?: string }` — tool
 *     invocation; the optional `tool_return_observation` field is the assistant reply template sent
 *     after the tool result is returned. Supports `{{ tool.response }}`.
 *
 * Both `user` and the response field must be non-empty after whitespace normalisation.
 *
 * @param {string} filePath - Absolute path to the `.scenarii.json` file.
 * @returns {{ entries: ScenariiEntry[], source: string }}
 * @throws {Error} If the file is missing, not valid JSON, or fails validation.
 */
export function loadScenarii(filePath) {
  const parsed = JSON.parse(readFileSync(filePath, "utf8"));
  const entries = normalizeScenariiEntries(parsed, filePath);

  return {
    entries,
    source: filePath,
  };
}

/**
 * Reads the prepared scenarii state file written by index.mjs at sandbox setup.
 *
 * Unlike `loadScenarii`, this reads the pre-processed file that index.mjs
 * serialised into the sandbox HOME (`~/.pi/agent/sandboxed-pi/scenarii.json`).
 * The entries are re-validated and re-normalised for defensive consistency.
 *
 * @param {string} filePath - Absolute path to the prepared scenarii.json file.
 * @returns {{ entries: ScenariiEntry[], source: string }}
 * @throws {Error} If the file cannot be read or has an unexpected shape.
 */
export function readPreparedScenarii(filePath) {
  const parsed = JSON.parse(readFileSync(filePath, "utf8"));

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("entries" in parsed) ||
    !("source" in parsed)
  ) {
    throw new Error(`Invalid prepared sandbox scenarii: ${filePath}`);
  }

  return {
    entries: normalizeScenariiEntries(parsed.entries, filePath),
    source: String(parsed.source),
  };
}

/**
 * Returns the canned reply for `prompt`, or an allowlist message.
 *
 * Matching is performed after normalising both the stored entries and the
 * incoming prompt (trim + CRLF → LF). If no entry matches, the response lists
 * all allowed prompts so the demo can guide the user back on track.
 *
 * The return value is a discriminated union:
 *   - `{ type: "text", text: string }` — emit as a plain text response
 *   - `{ type: "tool_call", name: string, arguments: object }` — invoke a tool
 *
 * @param {ScenariiEntry[]} entries - Loaded scenarii entries.
 * @param {string} prompt - The user's latest message, as extracted from context.
 * @returns {{ type: "text", text: string } | { type: "tool_call", name: string, arguments: object }}
 */
export function buildScenariiReply(entries, prompt) {
  const normalizedPrompt = normalizePrompt(prompt);
  const match = entries.find((entry) => entry.user === normalizedPrompt);

  if (match) {
    return "tool_call" in match
      ? {
          type: "tool_call",
          name: match.tool_call.name,
          arguments: match.tool_call.arguments,
        }
      : { type: "text", text: match.assistant };
  }

  return {
    type: "text",
    text: [
      "Only the following prompts are allowed in this demo:",
      ...entries
        .filter((entry) => "user" in entry)
        .map((entry) => `- ${entry.user}`),
    ].join("\n"),
  };
}

/**
 * Returns a reply to a tool result, substituting `{{ tool.response }}`.
 *
 * Looks up the scenarii entry whose `user` prompt triggered the tool call
 * (passed as `triggerPrompt`), then uses its `tool_return_observation` template
 * as the reply. Every occurrence of `{{ tool.response }}` is replaced with
 * `toolResultText`.
 *
 * Matching by trigger prompt means multiple tool_call entries in the same
 * scenarii file each have their own independent `tool_return_observation` reply
 * — there is no ambiguity even when the same tool name appears more than once.
 *
 * Falls back to a generic confirmation message when the entry has no
 * `tool_return_observation` field or when no entry matches the trigger prompt.
 *
 * @param {ScenariiEntry[]} entries - Loaded scenarii entries.
 * @param {string} triggerPrompt - The user prompt that caused the tool call.
 * @param {string} toolResultText - Serialised content of the tool result.
 * @returns {{ type: "text", text: string }}
 */
export function buildToolResultReply(entries, triggerPrompt, toolResultText) {
  const normalizedPrompt = normalizePrompt(triggerPrompt);
  const match = entries.find(
    (entry) => "tool_call" in entry && entry.user === normalizedPrompt,
  );

  const template = match?.tool_return_observation;
  const text = template
    ? template.replaceAll("{{ tool.response }}", toolResultText)
    : "Tool completed.";

  return { type: "text", text };
}

/**
 * Normalises a prompt string for consistent matching.
 *
 * Converts CRLF to LF and strips leading/trailing whitespace. Applied to both
 * scenarii entries at load time and incoming prompts at match time, so
 * cross-platform line endings and surrounding whitespace never cause mismatches.
 *
 * @param {string} value - Raw prompt or scenarii entry text.
 * @returns {string} Normalised string.
 */
export function normalizePrompt(value) {
  return value.replaceAll("\r\n", "\n").trim();
}

/**
 * @typedef {{ user: string, assistant: string }
 *          | { user: string, tool_call: { name: string, arguments: object }, tool_return_observation?: string }} ScenariiEntry
 */

function normalizeScenariiEntries(value, filePath) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(
      `Scenarii file must be a non-empty JSON array: ${filePath}`,
    );
  }

  return value.map((entry, index) => normalizeScenariiEntry(entry, index));
}

function normalizeScenariiEntry(entry, index) {
  if (typeof entry !== "object" || entry === null) {
    throw new Error(`Scenarii entry #${index + 1} must be an object`);
  }

  const { user } = entry;
  if (typeof user !== "string" || normalizePrompt(user).length === 0) {
    throw new Error(`Scenarii entry #${index + 1} must define a user string`);
  }

  if ("tool_call" in entry) {
    const { tool_call, tool_return_observation } = entry;
    if (
      typeof tool_call !== "object" ||
      tool_call === null ||
      typeof tool_call.name !== "string" ||
      tool_call.name.length === 0 ||
      typeof tool_call.arguments !== "object" ||
      tool_call.arguments === null
    ) {
      throw new Error(
        `Scenarii entry #${index + 1} tool_call must have a name string and arguments object`,
      );
    }
    if (
      tool_return_observation !== undefined &&
      typeof tool_return_observation !== "string"
    ) {
      throw new Error(
        `Scenarii entry #${index + 1} tool_return_observation must be a string when present`,
      );
    }
    const normalized = { user: normalizePrompt(user), tool_call };
    if (tool_return_observation !== undefined)
      normalized.tool_return_observation = tool_return_observation;
    return normalized;
  }

  const { assistant } = entry;
  if (
    typeof assistant !== "string" ||
    normalizePrompt(assistant).length === 0
  ) {
    throw new Error(
      `Scenarii entry #${index + 1} must define an assistant string or a tool_call object`,
    );
  }

  return {
    assistant: normalizePrompt(assistant),
    user: normalizePrompt(user),
  };
}
