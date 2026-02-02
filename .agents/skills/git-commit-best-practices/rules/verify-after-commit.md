---
title: Verify After Commit
impact: HIGH
tags: [workflow, verification, hooks]
---

# Verify After Commit

Always run git status after committing to verify the commit succeeded and check if pre-commit hooks modified files.

## Why

- **Confirmation**: Verify the commit actually succeeded
- **Hook awareness**: Detect if hooks auto-modified files
- **Completeness**: Ensure no unintended files remain staged
- **Next steps**: Know whether you need to amend or create a new commit

## Pattern

Run git status immediately after every commit:

```bash
git commit -m "feat: add user authentication"
git status  # Always verify
```

## Good: Normal Success

```bash
$ git commit -m "feat: add login functionality"
[main a1b2c3d] feat: add login functionality
 2 files changed, 45 insertions(+)

$ git status
On branch main
nothing to commit, working tree clean

# Perfect: Commit succeeded, no issues
```

## Scenario: Pre-commit Hook Modified Files

Some repositories have hooks that auto-format code or fix linting issues:

```bash
$ git commit -m "feat: add user profile"
[main e4f5g6h] feat: add user profile
 3 files changed, 67 insertions(+)

$ git status
On branch main
Changes not staged for commit:
  modified:   src/profile.ts
  modified:   src/types.ts

# Hook auto-formatted files!
# Now you need to include these changes
```

**What to do:** Create a new commit with the hook changes:

```bash
git add src/profile.ts src/types.ts
git commit -m "style: apply auto-formatting from pre-commit hook"
```

**NEVER amend** unless:

1. User explicitly requested amend, OR
2. Commit succeeded but hook auto-modified files that logically belong in the same commit

## Scenario: Commit Failed

```bash
$ git commit -m "feat add profile"
husky > pre-commit hook failed (code 1)

$ git status
On branch main
Changes to be committed:
  modified:   src/profile.ts

# Commit FAILED
# Files are still staged
```

**What to do:** Fix the issue and create a NEW commit (never amend a failed commit):

```bash
# Fix the linting errors
npm run lint:fix

# Create new commit
git commit -m "feat: add user profile"
```

## Scenario: Untracked Files Remain

```bash
$ git commit -m "feat: add authentication"
[main i7j8k9l] feat: add authentication
 2 files changed, 45 insertions(+)

$ git status
On branch main
Untracked files:
  src/auth/types.ts
  tests/auth/login.test.ts

# Commit succeeded but related files weren't included
```

**What to do:** Decide if these files should be in a new commit:

```bash
# If they belong to the same feature
git add src/auth/types.ts tests/auth/login.test.ts
git commit -m "feat: add authentication types and tests"

# Or just note them for later
```

## Bad: Not Verifying

```bash
# Commit and move on without checking
git commit -m "feat: add profile"
# No status check
# Don't know if hooks modified files
# Don't know if commit actually succeeded
```

## Verification Checklist

After running `git status`, check for:

- [ ] "nothing to commit, working tree clean" ← Perfect
- [ ] Modified files ← Hook may have changed files
- [ ] Untracked files ← Related files might need committing
- [ ] Staged files ← Commit might have failed

## Rules

1. Always run `git status` after committing
2. Verify commit succeeded before proceeding
3. Check if hooks modified any files
4. If hooks auto-fixed files, create a NEW commit (don't amend unless explicitly requested)
5. If commit failed, fix the issue and create a NEW commit (never amend)
