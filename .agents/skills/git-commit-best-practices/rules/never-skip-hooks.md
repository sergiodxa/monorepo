---
title: Never Skip Commit Hooks
impact: HIGH
tags: [workflow, hooks, safety]
---

# Never Skip Commit Hooks

Never use `--no-verify`, `--no-gpg-sign`, or other flags to skip commit hooks unless explicitly requested by the user.

## Why

- **Quality**: Hooks enforce code quality, linting, and testing
- **Safety**: Hooks prevent committing secrets or broken code
- **Standards**: Hooks ensure commits meet project standards
- **Trust**: Skipping hooks bypasses important safeguards

## Pattern

Let hooks run normally:

```bash
# Good: Let hooks run
git commit -m "feat(apps/books): add search functionality"

# If hooks fail, fix the issue
npm run lint:fix
git add .
git commit -m "feat(apps/books): add search functionality"

# Bad: Never skip hooks
git commit -m "feat(apps/books): add search" --no-verify
git commit -m "fix(packages/auth): update types" --no-gpg-sign
```

## Good: Respect Hook Failures

When a hook fails, fix the issue and try again:

```bash
$ git commit -m "feat(apps/books): add search"
✗ eslint found errors:
  src/search.ts:15:3 - 'result' is never used

# Fix the linting error
$ npm run lint:fix
$ git add src/search.ts

# Try again
$ git commit -m "feat(apps/books): add search functionality"
✓ All checks passed
[main a1b2c3d] feat(apps/books): add search functionality
```

## Bad: Skipping Hooks

```bash
# Bad: Bypassing quality checks
git commit -m "feat(apps/books): add search" --no-verify

# Bad: Skipping GPG signing
git commit -m "fix(packages/auth): update auth" --no-gpg-sign

# Bad: Combining skip flags
git commit -m "chore(root): update deps" --no-verify --no-gpg-sign
```

This defeats the purpose of having hooks in the first place.

## Common Hook Types

**Pre-commit hooks:**
- Linting (ESLint, Prettier)
- Type checking (TypeScript)
- Unit tests
- Secret detection
- File size limits

**Commit-msg hooks:**
- Conventional commit validation
- Message length checks
- Issue reference requirements

**Pre-push hooks:**
- Integration tests
- Build verification

## When Hooks Auto-Fix Code

Some hooks automatically fix issues (prettier, eslint --fix):

```bash
$ git commit -m "feat(apps/books): add search functionality"
✓ Prettier fixed 2 files
[main e4f5g6h] feat(apps/books): add search functionality
 3 files changed, 67 insertions(+)

$ git status
On branch main
Changes not staged for commit:
  modified:   src/search.ts
  modified:   src/types.ts

# Hook auto-formatted files!
```

**What to do:** Create a NEW commit with the fixed files:

```bash
git add src/search.ts src/types.ts
git commit -m "style(apps/books): apply auto-formatting from pre-commit hook"
```

**NEVER amend** unless the user explicitly requests it or the auto-fixes logically belong in the same commit.

## When Hooks Reject the Commit

If a hook rejects the commit entirely:

```bash
$ git commit -m "feat(apps/books): add search"
✗ Commit message does not follow conventional commits
✗ pre-commit hook failed (code 1)

$ git status
On branch main
Changes to be committed:
  modified:   src/search.ts

# Commit FAILED - files still staged
```

**What to do:** Fix the issue and create a NEW commit (never amend a failed commit):

```bash
# Fix the commit message format
git commit -m "feat(apps/books): add search functionality"
```

## Only Skip When User Requests

The ONLY time to skip hooks is when the user explicitly asks:

```bash
# User says: "commit without running hooks"
git commit -m "feat(apps/books): add search" --no-verify

# User says: "skip GPG signing for this commit"
git commit -m "fix(packages/auth): update types" --no-gpg-sign
```

Even then, warn the user about the risks:

> "I'll skip the hooks as requested, but note that this bypasses linting and quality checks."

## Bad Excuses for Skipping

Don't skip hooks because:
- "The linting error is minor" → Fix it
- "The tests are flaky" → Fix the tests
- "It's just a quick fix" → Hooks are for all commits
- "I'll fix it in the next commit" → Fix it now
- "The hook is slow" → Make the hook faster, don't skip it

## Handling Slow Hooks

If hooks are genuinely slow:

```bash
# Don't skip hooks
# Instead, optimize or configure them

# Example: Skip expensive tests in pre-commit, run in pre-push
# (requires hook configuration, not --no-verify)
```

Talk to the team about optimizing hooks, don't bypass them.

## Force Push Protection

Related to hooks: never force push to main/master unless explicitly requested:

```bash
# Bad: Force pushing to main
git push origin main --force

# If user requests it, warn them:
# "Force pushing to main can overwrite other's work. Are you sure?"
```

## Rules

1. NEVER use `--no-verify` unless user explicitly requests it
2. NEVER use `--no-gpg-sign` unless user explicitly requests it
3. When hooks fail, fix the issue and create a NEW commit
4. When hooks auto-fix, create a NEW commit with the fixes
5. Warn users if they request skipping hooks
6. Never force push to main/master without explicit user request
