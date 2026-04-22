---
name: open-pr
description: >
  Opens a well-formed pull request for this repository. Use when asked to
  create, open, or submit a pull request, or to push a branch and request a
  review. Enforces correct branch naming, conventional commit title, signed-off
  commits, the project PR template, and a green CI suite before submitting.
compatibility: Requires git and GitHub CLI (gh)
allowed-tools: Bash(git:*) Bash(gh:*) Bash(pnpm:*) Bash(mise:*)
---

# Open Pull Request Skill

## Pre-flight checks

Before pushing anything, read these files to understand conventions:

- `AGENTS.md` — architecture, key conventions, commit format
- `.commitlintrc.js` — enforced commit types and scopes

Run the full check suite and confirm it is green:

```sh
pnpm test
mise run lint
mise run build
```

Never open a PR with a failing check suite. Fix the issue first.

## Branch naming

Branch from `main`. Match the branch name to the conventional commit type:

| Type          | Branch pattern                 |
| ------------- | ------------------------------ |
| Bug fix       | `fix/<short-description>`      |
| New feature   | `feat/<short-description>`     |
| Documentation | `docs/<short-description>`     |
| Tooling/build | `chore/<short-description>`    |
| Refactor      | `refactor/<short-description>` |

## Commits

Every commit must follow the format enforced by `.commitlintrc.js`:

```text
<type>(<scope>): <Subject in sentence case>
```

**Allowed scopes:** `form` · `schema` · `validation` · `docs` · `deps` · `tooling`

Every commit must include both a DCO sign-off and a cryptographic signature:

```sh
git commit -s -S -m "feat(form): Add scrollbar to long option lists"
```

## Opening the PR

Push the branch, then create the PR using the project template:

```sh
git push -u origin <branch-name>
gh pr create \
  --title "<type>(<scope>): <Subject in sentence case>" \
  --body-file .github/PULL_REQUEST_TEMPLATE.md \
  --base main
```

## Filling the PR template

The template has six sections. Fill each one as follows.

### Summary

One sentence, present tense, mirroring the primary commit subject:

> Add `S.color()` builder for hex color settings.

### Why

Explain the motivation — what gap, pain point, or bug triggered this change.
Link the related issue: `Closes #<number>` (auto-closes on merge) or
`Refs #<number>` for informational links.

### What changed

3–7 bullet points covering key implementation decisions. Reviewers should
understand the approach without reading every diff line.

### How to validate

Provide copy-pasteable commands:

```sh
pnpm test
mise run lint
npx vitest run --reporter=verbose
```

If the change touches the TUI form, add manual steps:
invoke `ask_user_question` via pi → navigate the form → verify behaviour.

### Impact

- **No breaking changes** — for additions and internal fixes.
- **Breaking change** — for any change to a public API, a storage key, or an
  event name. Describe migration steps.

### Checklist — items AI agents often miss

| Item               | How to satisfy it                                         |
| ------------------ | --------------------------------------------------------- |
| Tests added        | Add a colocated `.test.ts` file or extend an existing one |
| `docs/` updated    | Update schema.md, ui.md, architecture.md if applicable    |
| Schema regenerated | Run `mise run docs:schema` if schema.ts changed           |
| Commits signed off | `git commit -s` on every commit                           |

## Responding to review feedback

For small fixes, amend the commit and force-push:

```sh
git add <files>
git commit --amend --signoff --no-edit
git push --force-with-lease
```

For larger review rounds, prefer a new commit (easier to diff):

```sh
git commit -s -m "fix(form): Address review: rename field to questionId"
```

## CI

The CI runs `pnpm typecheck`, `pnpm test`, `mise run lint`, and `mise run build`. If any check is
red, fix it in a new commit — do not skip hooks or force-merge.
