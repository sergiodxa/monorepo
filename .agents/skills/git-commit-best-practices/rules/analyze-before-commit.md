---
title: Analyze Before Commit
impact: HIGH
tags: [workflow, context, preparation]
---

# Analyze Before Commit

Always run git status and git diff before creating a commit. Understanding the current state is essential for creating appropriate commits.

## Why

- **Context**: See all staged and unstaged changes to ensure nothing is missed
- **Accuracy**: Verify you're committing what you intend to commit
- **Completeness**: Identify untracked files that might need to be included
- **Review**: Catch debugging code, secrets, or unintended changes

## Pattern

Run these two commands in parallel before every commit:

```bash
# Check current state
git status

# Review staged changes
git diff --staged
```

## Example Workflow

```bash
# Before committing
$ git status
On branch feature/auth
Changes to be committed:
  modified:   packages/auth/login.ts
  modified:   packages/auth/types.ts
Changes not staged for commit:
  modified:   README.md
Untracked files:
  packages/auth/logout.ts

# Review what's staged
$ git diff --staged
# Shows actual code changes for login.ts and types.ts

# Now you know:
# 1. What's staged (login.ts, types.ts)
# 2. What's not staged (README.md)
# 3. What's untracked (logout.ts)
# 4. The scope should be packages/auth
```

## What to Look For

**In git status:**
- Verify all intended files are staged
- Check for untracked files that should be included
- Identify files staged by mistake
- Determine the correct scope (apps/X or packages/Y)

**In git diff --staged:**
- Confirm changes match your intent
- Spot debugging code or secrets that shouldn't be committed
- Verify changes are cohesive and related
- Catch console.logs, debugger statements, or TODO comments

## Bad: Committing Blindly

```bash
# Immediately committing without context
git add .
git commit -m "feat(apps/books): updates"

# Problems:
# - Don't know what's being committed
# - Might commit unintended files
# - Might have wrong scope
# - Could include debugging code or secrets
```

## Good: Informed Commits

```bash
# Gather context first
git status           # See the landscape
git diff --staged    # Verify changes

# Determine correct scope from file paths
# Files in packages/auth → scope is packages/auth
# Files in apps/books → scope is apps/books

# Create informed commit
git add packages/auth/login.ts packages/auth/logout.ts
git commit -m "feat(packages/auth): add login and logout functionality"
```

## Rules

1. Always run git status and git diff before committing
2. Run these commands in parallel to save time
3. Review all staged changes to verify they're correct
4. Determine the correct scope from the file paths
5. Never commit without understanding what's being committed
