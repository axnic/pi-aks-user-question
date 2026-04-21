---
name: address-pr-review
description: >
  Use this skill to fix, respond to, and close GitHub PR review threads left by
  Copilot, human reviewers, or automated checks. Fetches all unresolved threads,
  triages them (inline fix vs. large refactor), applies fixes, groups related
  fixes into meaningful commits, posts a reply to each thread citing the fix or
  the tracking issue, and resolves the thread. Use when asked to "address review
  comments", "fix review feedback", "respond to PR review", "handle reviewer
  comments", "resolve review threads", or "close PR comments". Also handles
  threads that would require a significant refactor: asks the user whether to
  open a tracking issue instead of fixing inline.
compatibility: Requires git and gh CLI authenticated to GitHub
allowed-tools: Bash(git:*) Bash(gh:*) Bash(python3:*) Read Write Glob Grep
---

# Address PR Review

Full workflow: fetch unresolved threads → triage → fix or escalate to issue →
commit by scope → reply → resolve.

## Step 1 — Identify the PR

```bash
git branch --show-current
gh pr list --head <branch> --json number,title,url
```

If no open PR exists on the current branch, tell the user and stop.

## Step 2 — Fetch unresolved review threads

Use the GraphQL query in `references/graphql-ops.md` to fetch all review
threads. Keep only threads where **all** of the following are true:

- `isResolved: false`
- `isOutdated: false`
- Author is not the PR author (skip self-comments)

Extract for each thread:

- `node_id` — the `id` field, needed to resolve later
- `databaseId` of the first comment — needed to reply via REST
- Comment body, file path, line number, author login

> For the full GraphQL query and inline Python parser, see
> `references/graphql-ops.md`.

## Step 3 — Triage threads

Before touching any code, read all threads and classify each one:

| Class              | Criteria                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------- |
| **Fix inline**     | Self-contained change — corrects a bug, typo, missing validation, or misleading comment  |
| **Large refactor** | Would require changing the architecture, touching many files, or breaking the public API |
| **Not actionable** | Subjective style preference, design disagreement, or question needing a human decision   |

For each **large refactor** thread, pause and ask the user (one question per thread):

> "The comment on `<file>:<line>` by @<author> would require a significant
> refactor (`<one-line summary of what would change>`). Should I open a
> tracking issue for this instead of fixing it in this PR?"

- **Yes** → go to Step 4 (open issue).
- **No, fix it here** → treat as inline fix.
- **No, skip it** → note it in the final report; do not resolve the thread.

For **not actionable** threads: do not fix, do not resolve, note them in the
final report.

## Step 4 — Open a tracking issue (large refactor)

For each large-refactor thread the user approved escalating:

1. Create a GitHub issue that captures the full context:

   ```bash
   gh issue create \
     --title "<concise description of the refactor needed>" \
     --label "enhancement" \
     --body-file /tmp/refactor-issue-body.md
   ```

   The body should include: what the reviewer asked for, why it was deferred,
   and a link back to the PR thread (`Refs <pr-url> (comment by @<author>)`).

2. Note the issue number — you will cite it when replying to the thread.

3. Delete `/tmp/refactor-issue-body.md` after creation.

## Step 5 — Fix inline threads

For each thread classified as **fix inline**:

1. Read the file at the path and line mentioned in the comment.
2. Make the minimal correct fix — do not touch unrelated code.
3. Track which threads each file change addresses (you will group them in Step 6).

## Step 6 — Commit fixes by logical scope

**Group related fixes into a single commit — do not make one commit per thread.**

A logical scope is a coherent unit: the same feature area, the same file, or
the same type of fix. Fixes that touch unrelated concerns must not be bundled.

For each commit group, follow the project's commit convention:

```text
fix(<scope>): <Subject in sentence case>

<WHY-focused body — what was wrong and why this fixes it>

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

```bash
git add <files-for-this-group>
git commit -s -S -m "<message>"
```

Push after all commits are ready:

```bash
git push
```

Note the short SHA of each commit — you need it in Step 7.

## Step 7 — Reply to each thread

Post a reply to every thread you acted on (fixed or escalated):

**Fixed thread:**

```bash
gh api -X POST \
  /repos/{owner}/{repo}/pulls/{pr_number}/comments/{databaseId}/replies \
  -f body="Fixed in <sha>. <one sentence: what changed and why.>"
```

**Escalated to issue:**

```bash
gh api -X POST \
  /repos/{owner}/{repo}/pulls/{pr_number}/comments/{databaseId}/replies \
  -f body="This requires a larger refactor. Opened #<issue_number> to track it."
```

Keep replies concise. Do not paraphrase the original comment.

## Step 8 — Resolve threads

Resolve every thread you replied to in Step 7:

```bash
gh api graphql -f query='mutation {
  resolveReviewThread(input:{threadId:"<node_id>"}) {
    thread { isResolved }
  }
}'
```

Verify `isResolved: true` before moving on. Never resolve a thread without
first posting a reply.

> Full query and mutation syntax in `references/graphql-ops.md`.

## Step 9 — Report to the user

Summarise the run:

- Threads found / fixed inline / escalated to issues / skipped
- Commits pushed (short SHA + scope)
- Issues opened (number + title)
- Threads left open and why (not actionable, user said skip)

## Rules

- Never resolve a thread without first posting a reply that references a fix or issue.
- Never fabricate a commit SHA — only cite SHAs that exist on the remote.
- Never fix pre-existing issues unrelated to the review comments.
- Always ask the user before opening a tracking issue — one question per thread, do not batch.
- If a label does not exist on `gh issue create`, retry without it and tell the user.
- Skip threads that are already resolved or outdated — silently.
