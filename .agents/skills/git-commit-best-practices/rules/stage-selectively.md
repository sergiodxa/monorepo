---
title: Stage Files Selectively
impact: HIGH
tags: [workflow, staging, organization]
---

# Stage Files Selectively

Only stage files that are directly related to the commit's purpose. Each commit should represent a single logical change.

## Why

- **Clarity**: Each commit has a clear, focused purpose
- **Reviewability**: Changes are easier to review when they're cohesive
- **Revertability**: Focused commits can be reverted without affecting unrelated changes
- **Bisectability**: Git bisect works better with atomic commits

## Pattern

Stage specific files that accomplish one goal:

```bash
# Good: Stage related files only
git add src/auth/login.ts src/auth/types.ts tests/auth/login.test.ts

# Bad: Stage everything including unrelated changes
git add .  # Only use when ALL changes are related
```

## Good: Focused Commits

```bash
# Scenario: You changed auth code and updated README

# Commit 1: Auth changes
git add src/auth/login.ts src/auth/logout.ts tests/auth/
git commit -m "feat: add login and logout functionality"

# Commit 2: Documentation
git add README.md
git commit -m "docs: update authentication setup instructions"
```

Each commit is self-contained and can be reviewed or reverted independently.

## Bad: Mixed Changes

```bash
# Bad: Everything in one commit
git add .
git commit -m "feat: add auth and update docs and fix typo"

# Problems:
# - Multiple unrelated changes
# - Can't revert auth without losing doc updates
# - Unclear what the main purpose is
# - Harder to review
```

## When to Use git add .

Only use `git add .` when all unstaged changes are related to a single commit:

```bash
# Good: All changes are related
# You just added a new feature across multiple files
git add .
git commit -m "feat: add user profile management"

# Bad: Unrelated changes mixed together
# You fixed a bug, updated docs, and added a feature
git add .  # Don't do this!
```

## Handling Large Changes

When you have many related files, you can still stage them all:

```bash
# Stage entire directories if all files are related
git add src/components/UserProfile/
git add tests/components/UserProfile/
git commit -m "feat: add user profile component"

# Or use patterns
git add src/**/*.test.ts
git commit -m "test: add unit tests for auth module"
```

## Checking What You're Staging

Before staging, review what changed:

```bash
# See all unstaged changes
git status

# Review specific file changes
git diff src/auth/login.ts

# Stage only the files you verified
git add src/auth/login.ts
```

## Rules

1. Stage only files related to a single logical change
2. Use `git add <specific-files>` instead of `git add .` when changes are mixed
3. Create separate commits for unrelated changes
4. Each commit should have a clear, single purpose
5. Review changes before staging with `git diff`
