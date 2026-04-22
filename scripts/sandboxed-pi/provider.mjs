import path from "node:path";
import { createAssistantMessageEventStream } from "@mariozechner/pi-ai";
import {
  MODEL_ID,
  PROVIDER_API,
  PROVIDER_API_KEY,
  PROVIDER_BASE_URL,
  PROVIDER_NAME,
} from "./constants.mjs";
import {
  buildScenariiReply,
  buildToolResultReply,
  readPreparedScenarii,
} from "./scenarii.mjs";

/** Model descriptor registered with pi's ModelRegistry. */
const demoModel = {
  id: MODEL_ID,
  name: "Scenario-driven demo response",
  reasoning: false,
  input: ["text"],
  contextWindow: 128000,
  maxTokens: 4096,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
};

/** Zero-cost usage object — the provider never makes real API calls. */
const emptyUsage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

/**
 * pi extension entry point — registers the scenario-driven provider.
 *
 * Called by pi when the extension is loaded via `--extension`. Reads the
 * prepared scenarii state file (written by index.mjs before spawn) and
 * registers a `streamSimple` handler that serves deterministic replies from
 * that scenarii instead of calling a real AI API.
 *
 * @param {import("@mariozechner/pi-ai").Pi} pi - The pi extension API.
 */
export default function registerDemoProvider(pi) {
  const scenarii = readPreparedScenarii(getPreparedScenariiPath());

  pi.registerProvider(PROVIDER_NAME, {
    api: PROVIDER_API,
    apiKey: PROVIDER_API_KEY,
    baseUrl: PROVIDER_BASE_URL,
    models: [demoModel],
    streamSimple: (model, context, options) => {
      const toolResult = getLatestToolResult(context);
      if (toolResult) {
        const reply = buildToolResultReply(
          scenarii.entries,
          toolResult.triggerPrompt,
          toolResult.text,
        );
        return streamTextReply(model, reply.text, options);
      }

      const reply = buildScenariiReply(
        scenarii.entries,
        getLatestUserPrompt(context),
      );
      return reply.type === "tool_call"
        ? streamToolCallReply(model, reply, options)
        : streamTextReply(model, reply.text, options);
    },
  });
}

/**
 * Returns the path to the prepared scenarii state file.
 *
 * index.mjs serialises the loaded scenarii to this location before spawning
 * pi, so the provider can read it at activation time without needing CLI args.
 * The path is derived from HOME (the sandbox home dir set by index.mjs).
 */
function getPreparedScenariiPath() {
  const home = process.env.HOME;
  if (!home) {
    throw new Error("HOME must be set for the sandboxed demo provider");
  }

  return path.join(home, ".pi", "agent", "sandboxed-pi", "scenarii.json");
}

/**
 * Returns the tool name, text content, and triggering user prompt for the
 * latest tool result message, or `null` if the most recent message is not
 * a tool result.
 *
 * pi appends a `ToolResultMessage` to the context after executing a tool call
 * and then re-invokes the provider to get the next assistant turn. This
 * function detects that case so the provider can route to the `tool_return_observation` field of
 * the matching tool_call scenarii entry.
 *
 * It walks back through the context to find the user message that preceded
 * the assistant tool_call, so the provider can match against the correct
 * scenarii entry even when the same tool is called multiple times.
 *
 * @param {object} context - The pi conversation context object.
 * @returns {{ toolName: string, text: string, triggerPrompt: string } | null}
 */
function getLatestToolResult(context) {
  const messages = context.messages;
  const lastIndex = messages.length - 1;
  const last = messages[lastIndex];
  if (last?.role !== "toolResult") return null;

  const text = last.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");

  // Walk back past the toolResult to find the user prompt that triggered it.
  // Typical sequence: [..., user_msg, assistant(tool_call), toolResult]
  let triggerPrompt = "";
  for (let index = lastIndex - 1; index >= 0; index -= 1) {
    const msg = messages[index];
    if (msg.role === "user") {
      triggerPrompt =
        typeof msg.content === "string"
          ? msg.content
          : msg.content
              .filter((block) => block.type === "text")
              .map((block) => block.text)
              .join("\n");
      break;
    }
  }

  return { toolName: last.toolName, text, triggerPrompt };
}

/**
 * Extracts the text of the latest user message from the conversation context.
 *
 * Iterates in reverse so multi-turn sessions always match against the most
 * recent user turn. Handles both string content and structured content blocks.
 *
 * @param {object} context - The pi conversation context object.
 * @returns {string} The most recent user prompt, or an empty string.
 */
function getLatestUserPrompt(context) {
  for (let index = context.messages.length - 1; index >= 0; index -= 1) {
    const message = context.messages[index];
    if (message.role !== "user") continue;
    if (typeof message.content === "string") return message.content;

    return message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
  }

  return "";
}

/**
 * Builds a synthetic stream that emits `text` as a plain assistant response.
 *
 * @param {object} model - The model descriptor from pi's registry.
 * @param {string} text - The canned response text to stream.
 * @param {{ signal?: AbortSignal } | undefined} options - pi stream options.
 * @returns {import("@mariozechner/pi-ai").AssistantMessageEventStream}
 */
function streamTextReply(model, text, options) {
  const stream = createAssistantMessageEventStream();

  queueMicrotask(() => {
    const partial = {
      role: "assistant",
      content: [],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: emptyUsage,
      stopReason: "stop",
      timestamp: Date.now(),
    };

    if (options?.signal?.aborted) {
      const aborted = {
        ...partial,
        errorMessage: "Request was aborted",
        stopReason: "aborted",
      };
      stream.push({ type: "error", reason: "aborted", error: aborted });
      stream.end(aborted);
      return;
    }

    const message = {
      ...partial,
      content: [{ type: "text", text }],
    };

    stream.push({ type: "start", partial });
    stream.push({
      type: "text_start",
      contentIndex: 0,
      partial: { ...partial, content: [{ type: "text", text: "" }] },
    });
    stream.push({
      type: "text_delta",
      contentIndex: 0,
      delta: text,
      partial: message,
    });
    stream.push({
      type: "text_end",
      contentIndex: 0,
      content: text,
      partial: message,
    });
    stream.push({ type: "done", reason: "stop", message });
    stream.end(message);
  });

  return stream;
}

/**
 * Builds a synthetic stream that emits a single tool call as the assistant response.
 *
 * Emits the required event sequence for a tool use turn:
 *   start → toolcall_start → toolcall_end → done → end
 *
 * @param {object} model - The model descriptor from pi's registry.
 * @param {{ type: "tool_call", name: string, arguments: object }} reply - Tool call reply.
 * @param {{ signal?: AbortSignal } | undefined} options - pi stream options.
 * @returns {import("@mariozechner/pi-ai").AssistantMessageEventStream}
 */
function streamToolCallReply(model, reply, options) {
  const stream = createAssistantMessageEventStream();

  queueMicrotask(() => {
    const partial = {
      role: "assistant",
      content: [],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: emptyUsage,
      stopReason: "toolUse",
      timestamp: Date.now(),
    };

    if (options?.signal?.aborted) {
      const aborted = {
        ...partial,
        errorMessage: "Request was aborted",
        stopReason: "aborted",
      };
      stream.push({ type: "error", reason: "aborted", error: aborted });
      stream.end(aborted);
      return;
    }

    const toolCall = {
      type: "toolCall",
      id: `call_${Date.now()}`,
      name: reply.name,
      arguments: reply.arguments,
    };
    const message = { ...partial, content: [toolCall] };

    stream.push({ type: "start", partial });
    stream.push({
      type: "toolcall_start",
      contentIndex: 0,
      partial: { ...partial, content: [{ ...toolCall, arguments: {} }] },
    });
    stream.push({
      type: "toolcall_end",
      contentIndex: 0,
      toolCall,
      partial: message,
    });
    stream.push({ type: "done", reason: "toolUse", message });
    stream.end(message);
  });

  return stream;
}
