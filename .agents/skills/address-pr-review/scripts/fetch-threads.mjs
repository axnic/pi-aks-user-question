#!/usr/bin/env node
/**
 * fetch-threads.mjs — Fetch unresolved, non-outdated review threads for a PR.
 *
 * Usage:
 *   gh api graphql -f query="$(cat references/graphql-fetch.gql)" \
 *     -f owner=OWNER -f repo=REPO -F pr=NUMBER \
 *     | node scripts/fetch-threads.mjs
 *
 * Reads JSON from stdin (gh api graphql output), writes to stdout a JSON array
 * of unresolved threads, each with:
 *   { node_id, db_id, author, path, line, body }
 *
 * Exits 0 with an empty array if there are no unresolved threads.
 */

import { createInterface } from "node:readline";

const chunks = [];
for await (const chunk of createInterface({ input: process.stdin })) {
  chunks.push(chunk);
}

const data = JSON.parse(chunks.join("\n"));
const threads = data?.data?.repository?.pullRequest?.reviewThreads?.nodes ?? [];

const prAuthor = data?.data?.repository?.pullRequest?.author?.login ?? "";

const unresolved = threads
  .filter((t) => !t.isResolved && !t.isOutdated)
  .flatMap((t) => {
    const comments = t.comments?.nodes ?? [];
    if (comments.length === 0) return [];
    const c = comments[0];
    if (c.author?.login === prAuthor) return []; // skip self-comments
    return [
      {
        node_id: t.id,
        db_id: c.databaseId,
        author: c.author?.login ?? "unknown",
        path: c.path ?? null,
        line: c.line ?? null,
        body: c.body ?? "",
      },
    ];
  });

process.stdout.write(JSON.stringify(unresolved, null, 2) + "\n");
process.stderr.write(`${unresolved.length} unresolved thread(s)\n`);
