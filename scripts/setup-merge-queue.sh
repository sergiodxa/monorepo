#!/usr/bin/env bash
# Enable GitHub merge queue on main: auto-merge + a ruleset that requires the
# CI workflow and routes PR merges through the queue. Needs repo admin via `gh`.
#
# Usage: bunx --bun bash scripts/setup-merge-queue.sh
#    or: bash scripts/setup-merge-queue.sh

set -euo pipefail

REPO="${REPO:-sergiodxa/monorepo}"
RULESET_NAME="${RULESET_NAME:-main merge queue}"
WORKFLOW_PATH=".github/workflows/ci.yml"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh is required (https://cli.github.com/)" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 1
fi

echo "→ Resolving repository id for ${REPO}"
REPO_ID="$(gh api "repos/${REPO}" --jq .id)"

echo "→ Enabling auto-merge (Merge when ready)"
gh api --method PATCH "repos/${REPO}" \
  --input - <<EOF
{
  "allow_auto_merge": true,
  "allow_squash_merge": true,
  "allow_merge_commit": false,
  "allow_rebase_merge": false,
  "delete_branch_on_merge": true
}
EOF

PAYLOAD="$(jq -n \
  --arg name "${RULESET_NAME}" \
  --arg path "${WORKFLOW_PATH}" \
  --argjson repository_id "${REPO_ID}" \
  '{
    name: $name,
    target: "branch",
    enforcement: "active",
    bypass_actors: [
      {
        actor_id: 5,
        actor_type: "RepositoryRole",
        bypass_mode: "always"
      }
    ],
    conditions: {
      ref_name: {
        include: ["refs/heads/main"],
        exclude: []
      }
    },
    rules: [
      {
        type: "merge_queue",
        parameters: {
          check_response_timeout_minutes: 60,
          grouping_strategy: "ALLGREEN",
          max_entries_to_build: 2,
          max_entries_to_merge: 5,
          merge_method: "SQUASH",
          min_entries_to_merge: 1,
          min_entries_to_merge_wait_minutes: 5
        }
      },
      {
        type: "workflows",
        parameters: {
          do_not_enforce_on_create: true,
          workflows: [
            {
              path: $path,
              ref: "refs/heads/main",
              repository_id: $repository_id
            }
          ]
        }
      }
    ]
  }')"

EXISTING_ID="$(
  gh api "repos/${REPO}/rulesets" \
    | jq -r --arg name "${RULESET_NAME}" '.[] | select(.name == $name) | .id' \
    2>/dev/null || true
)"

if [[ -n "${EXISTING_ID}" ]]; then
  echo "→ Updating ruleset ${EXISTING_ID} (${RULESET_NAME})"
  echo "${PAYLOAD}" | gh api --method PUT "repos/${REPO}/rulesets/${EXISTING_ID}" --input -
else
  echo "→ Creating ruleset (${RULESET_NAME})"
  echo "${PAYLOAD}" | gh api --method POST "repos/${REPO}/rulesets" --input -
fi

echo "✓ Merge queue configured for main"
echo
echo "On a PR: click Merge when ready (or: gh pr merge --auto --squash)."
echo "GitHub enqueues when requirements are met; the queue re-runs CI on the"
echo "merge group and squash-merges. Admins can still push to main (bypass)."
