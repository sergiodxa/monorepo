#!/usr/bin/env bash
# Enable GitHub auto-merge on this user-owned repo (squash only).
# Merge queues need an organization-owned repository; this helper does not
# create a merge_queue ruleset.
#
# Usage: bash scripts/setup-auto-merge.sh

set -euo pipefail

REPO="${REPO:-sergiodxa/monorepo}"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh is required (https://cli.github.com/)" >&2
  exit 1
fi

echo "→ Enabling auto-merge on ${REPO} (squash only)"
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

echo "✓ Auto-merge enabled"
echo
echo "On a PR: Enable auto-merge, or: gh pr merge --auto --squash."
echo "GitHub merges when checks pass. A merge queue needs an org-owned repo."
