# GraphQL Operations for GitHub PR Review

## Fetch all review threads on a PR

```bash
gh api graphql -f query='
{
  repository(owner:"OWNER", name:"REPO") {
    pullRequest(number:PR_NUMBER) {
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
}'
```

Parse the result with inline Python to extract unresolved threads:

```bash
gh api graphql -f query='...' | python3 -c "
import json, sys
d = json.load(sys.stdin)
threads = d['data']['repository']['pullRequest']['reviewThreads']['nodes']
for t in threads:
    if t['isResolved'] or t['isOutdated']:
        continue
    c = t['comments']['nodes'][0]
    print(t['id'], c['databaseId'], c['path'], c['author']['login'])
"
```

Replace `OWNER`, `REPO`, and `PR_NUMBER` with real values obtained from
`gh pr view --json number,headRepository`.

## Resolve a review thread

```bash
gh api graphql -f query='
mutation {
  resolveReviewThread(input:{threadId:"PRRT_xxxx"}) {
    thread { isResolved }
  }
}'
```

`threadId` is the `id` field from the `reviewThreads` query above (starts
with `PRRT_`).

## Reply to a review comment (REST)

```bash
gh api -X POST \
  /repos/{owner}/{repo}/pulls/{pr_number}/comments/{databaseId}/replies \
  -f body="Fixed in <sha>. <explanation>."
```

`databaseId` is the integer ID from the `comments.nodes[0].databaseId` field.

## Look up owner/repo/PR number

```bash
gh pr view --json number,headRepository \
  | python3 -c "
import json, sys
d = json.load(sys.stdin)
r = d['headRepository']
print(r['owner']['login'], r['name'], d['number'])
"
```

## Pagination

If the PR has more than 100 threads, use cursor-based pagination:

```graphql
reviewThreads(first:100, after:"CURSOR") {
  pageInfo { endCursor hasNextPage }
  nodes { ... }
}
```

Loop until `hasNextPage` is `false`, collecting all nodes.
