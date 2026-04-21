#!/usr/bin/env node
/**
 * get-pr-coords.mjs — Print owner, repo, and PR number for the current PR.
 *
 * Usage:
 *   gh pr view --json number,headRepository,author | node scripts/get-pr-coords.mjs
 *
 * Output (one line, space-separated):
 *   OWNER REPO PR_NUMBER PR_AUTHOR
 *
 * Use in shell:
 *   read OWNER REPO PR_NUMBER PR_AUTHOR \
 *     < <(gh pr view --json number,headRepository,author | node scripts/get-pr-coords.mjs)
 */

import { createInterface } from "node:readline";

const chunks = [];
for await (const chunk of createInterface({ input: process.stdin })) {
  chunks.push(chunk);
}

const data = JSON.parse(chunks.join("\n"));
const repo = data.headRepository;
const nameWithOwner = repo.nameWithOwner; // "owner/repo"
const [owner, name] = nameWithOwner.split("/");
const number = data.number;
const author = data.author?.login ?? "";

process.stdout.write(`${owner} ${name} ${number} ${author}\n`);
