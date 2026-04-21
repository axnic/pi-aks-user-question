# GraphQL Operations for GitHub PR Review

## Step 1 — Look up owner / repo / PR number / PR author

```bash
read OWNER REPO PR_NUMBER PR_AUTHOR \
  < <(gh pr view --json number,headRepository,author \
      | node scripts/get-pr-coords.mjs)
```

`scripts/get-pr-coords.mjs` reads the JSON from stdin and prints four
space-separated values on one line.

## Step 2 — Fetch and filter unresolved threads

```bash
gh api graphql \
  -f query='
    query($owner:String!, $repo:String!, $pr:Int!) {
      repository(owner:$owner, name:$repo) {
        pullRequest(number:$pr) {
          author { login }
          reviewThreads(first:100) {
            nodes {
              id
              isResolved
              isOutdated
              comments(first:1) {
                nodes {
                  databaseId
                  body
                  path
                  line
                  author { login }
                }
              }
            }
          }
        }
      }
    }' \
  -f owner="$OWNER" -f repo="$REPO" -F pr="$PR_NUMBER" \
  | node scripts/fetch-threads.mjs > /tmp/threads.json
```

`scripts/fetch-threads.mjs` filters for `isResolved:false`, `isOutdated:false`,
and excludes comments by the PR author. It writes a JSON array to stdout:

```json
[
  {
    "node_id": "PRRT_xxxx",
    "db_id": 123456,
    "author": "copilot-pull-request-reviewer",
    "path": "src/form/inputs/choice.ts",
    "line": 42,
    "body": "..."
  }
]
```

Read the array with `node -e` or `jq` for subsequent steps.

### Pagination

If the PR has more than 100 threads, add `after` cursor support:

```graphql
reviewThreads(first:100, after:"CURSOR") {
  pageInfo { endCursor hasNextPage }
  nodes { ... }
}
```

Loop until `hasNextPage` is `false` and concatenate the node arrays.

## Resolve a review thread

```bash
gh api graphql -f query='
mutation {
  resolveReviewThread(input:{threadId:"PRRT_xxxx"}) {
    thread { isResolved }
  }
}'
```

`threadId` is the `node_id` from `/tmp/threads.json` (starts with `PRRT_`).
Verify `isResolved:true` in the response before moving on.

## Reply to a review comment (REST)

```bash
gh api -X POST \
  /repos/$OWNER/$REPO/pulls/$PR_NUMBER/comments/$DB_ID/replies \
  -f body="Fixed in <sha>. <explanation>."
```

`$DB_ID` is the `db_id` field from `/tmp/threads.json`.
