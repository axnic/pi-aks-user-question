/**
 * generate-schema.ts — Exports the TypeBox tool-parameter schema to docs/schema.json.
 *
 * Usage:
 *   npx tsx scripts/generate-schema.ts          # write to docs/schema.json
 *   npx tsx scripts/generate-schema.ts --stdout  # print to stdout
 *
 * The generated file is the canonical JSON Schema for the ask_user_question tool
 * parameters. It is derived from the TypeBox definitions in src/schema.ts so it
 * stays in sync with the runtime schema automatically.
 */

import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AskUserQuestionParams } from "../src/schema.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, "..", "docs", "schema.json");

const schema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "ask-user-question",
  title: "AskUserQuestionParams",
  description:
    "Parameters for the ask_user_question tool. Defines one or more questions to present to the user via an interactive TUI form. Supports text, number, choice, multichoice, and boolean question types.",
  ...AskUserQuestionParams,
};

const json = JSON.stringify(schema, null, 2) + "\n";

if (process.argv.includes("--stdout")) {
  process.stdout.write(json);
} else {
  writeFileSync(outPath, json, "utf-8");
  console.log(`✓ Schema written → ${outPath}`);
}
