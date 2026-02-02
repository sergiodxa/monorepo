---
name: git-commit-best-practices
description: Git commit workflow and message conventions. Use when creating commits, reviewing commit messages, or working with version control. Triggers when running git commands or preparing to commit changes.
---

# Git Commit Best Practices

Patterns for creating effective commits with clear messages that follow repository conventions. Contains 8 rules covering workflow, message structure, and content quality.

## When to Apply

Reference these guidelines when:

- Creating a new commit
- Reviewing commit history to understand conventions
- Amending commits
- Preparing to commit staged changes
- Writing commit messages

## Rules Summary

### Workflow (HIGH)

#### analyze-before-commit - @rules/analyze-before-commit.md

Always check git status and diff before creating a commit to verify what's being committed.

```bash
# Run these in parallel to understand changes
git status           # See staged/unstaged changes
git diff --staged    # Review what will be committed
```

#### stage-selectively - @rules/stage-selectively.md

Only stage files relevant to the commit's purpose. Don't commit unrelated changes together.

```bash
# Good: Stage specific files
git add src/auth/login.ts src/auth/logout.ts

# Bad: Stage everything indiscriminately
git add .  # Only use when all changes are related
```

#### verify-after-commit - @rules/verify-after-commit.md

Run git status after committing to verify success and check for hooks.

```bash
git commit -m "add user authentication"
git status  # Verify commit succeeded
```

### Message Structure (HIGH)

#### conventional-commits - @rules/conventional-commits.md

Use type prefixes that match repository conventions: feat, fix, docs, refactor, test, chore.

```bash
# Good: Clear type prefix
git commit -m "feat: add password reset flow"
git commit -m "fix: resolve login redirect loop"
git commit -m "docs: update API authentication guide"

# Bad: No type prefix
git commit -m "added password reset"
git commit -m "fixed bug"
```

#### focus-on-why - @rules/focus-on-why.md

Commit messages should explain why the change was made, not just what changed.

```bash
# Bad: Only describes what
git commit -m "update user model"
git commit -m "change button color"

# Good: Explains why
git commit -m "fix: add email validation to prevent invalid registrations"
git commit -m "refactor: extract auth logic to improve testability"
```

#### concise-but-complete - @rules/concise-but-complete.md

Keep messages 1-2 sentences. Include enough context to understand the change without reading code.

```bash
# Good: Concise with context
git commit -m "feat: add rate limiting to prevent API abuse"
git commit -m "fix: resolve race condition in payment processing"

# Too verbose
git commit -m "This commit adds rate limiting functionality to the API endpoints because we were seeing abuse patterns in production and need to protect against DDoS attacks and excessive usage"

# Too terse
git commit -m "fix bug"
git commit -m "updates"
```

### Content Rules (MEDIUM)

#### accurate-type-prefix - @rules/accurate-type-prefix.md

Use the correct type prefix that accurately reflects the nature of changes.

```bash
# Good: Accurate prefixes
feat: add    # Wholly new feature/capability
feat: update # Enhancement to existing feature
fix:         # Bug fix
refactor:    # Code restructuring, no behavior change
docs:        # Documentation only
test:        # Test code only
chore:       # Build, dependencies, tooling

# Bad: Inaccurate prefixes
feat: update login  # Should be "feat: add" if new, "feat: update" if enhancement
fix: add validation # Should be "feat: add" - it's a feature, not a bug fix
```

#### never-skip-hooks - @rules/never-skip-hooks.md

Never use --no-verify or skip commit hooks unless explicitly requested by user.

```bash
# Bad: Skipping hooks
git commit -m "fix: update types" --no-verify
git commit -m "feat: add feature" --no-gpg-sign

# Good: Let hooks run
git commit -m "fix: update types"
# If hooks fail, fix the issue, don't skip
```

## Philosophy

Good commits are:

1. **Contextual** - Based on repository's existing commit style
2. **Purposeful** - Each commit has a single, clear purpose
3. **Informative** - Messages explain why, not just what
4. **Verified** - Status checked before and after committing
5. **Honest** - Accurate type prefixes that reflect actual changes
