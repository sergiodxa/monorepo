---
title: Use Conventional Commits
impact: HIGH
tags: [message, structure, convention]
---

# Use Conventional Commits

All commits MUST follow the Conventional Commits specification with type, scope, and description.

## Why

- **Automation**: Enables automatic changelog generation and versioning
- **Clarity**: Immediately shows what changed and where
- **Filtering**: Easy to filter commits by type or scope
- **Standards**: Universal convention understood across projects

## Format

```
<type>(<scope>): <description>

# Required parts:
# - type: feat, fix, docs, refactor, test, chore, style, perf
# - scope: app or package name (apps/books, packages/auth, etc.)
# - description: brief summary of the change
```

## Good: Proper Conventional Commits

```bash
# Feature in an app
git commit -m "feat(apps/books): add book search functionality"

# Bug fix in a package
git commit -m "fix(packages/auth): resolve token expiration issue"

# Documentation update
git commit -m "docs(apps/store): update API integration guide"

# Refactoring
git commit -m "refactor(packages/ui): extract button variants to constants"

# Tests
git commit -m "test(apps/books): add integration tests for search"

# Chore (deps, build, etc.)
git commit -m "chore(packages/db): update prisma to v5.8.0"

# Performance improvement
git commit -m "perf(apps/dashboard): optimize chart rendering"

# Code style/formatting
git commit -m "style(packages/ui): apply prettier formatting"
```

## Bad: Missing or Incorrect Format

```bash
# Bad: No scope
git commit -m "feat: add search"

# Bad: No type
git commit -m "add book search"

# Bad: Wrong scope format (should be apps/ or packages/)
git commit -m "feat(books): add search"

# Bad: No colon after scope
git commit -m "feat(apps/books) add search"

# Bad: Capitalized description
git commit -m "feat(apps/books): Add search functionality"

# Bad: Period at end
git commit -m "feat(apps/books): add search functionality."
```

## Commit Types

**feat**: A new feature or enhancement
```bash
feat(apps/books): add book recommendation engine
feat(packages/auth): add OAuth2 support
```

**fix**: A bug fix
```bash
fix(apps/books): resolve search pagination issue
fix(packages/db): prevent connection pool exhaustion
```

**docs**: Documentation changes only
```bash
docs(apps/books): update search API documentation
docs(packages/auth): add OAuth setup instructions
```

**refactor**: Code restructuring without behavior change
```bash
refactor(apps/books): extract search logic to service
refactor(packages/ui): simplify button component props
```

**test**: Adding or updating tests
```bash
test(apps/books): add unit tests for search service
test(packages/auth): add E2E tests for login flow
```

**chore**: Build, dependencies, tooling
```bash
chore(apps/books): update dependencies
chore(packages/db): configure connection pooling
```

**style**: Code formatting, whitespace, etc.
```bash
style(apps/books): apply ESLint fixes
style(packages/ui): format with prettier
```

**perf**: Performance improvements
```bash
perf(apps/books): add caching to search queries
perf(packages/db): optimize database indexes
```

## Scope Format

Scope MUST indicate the app or package:

```bash
# Apps
feat(apps/books):
feat(apps/store):
feat(apps/dashboard):

# Packages
fix(packages/auth):
fix(packages/ui):
fix(packages/db):

# Monorepo root (rarely used)
chore(root): update workspace dependencies
```

## Description Guidelines

The description should:
- Start with lowercase
- Use imperative mood ("add" not "added" or "adds")
- Be concise (under 72 characters)
- No period at the end

```bash
# Good
feat(apps/books): add search functionality
fix(packages/auth): resolve session timeout issue

# Bad
feat(apps/books): Added search functionality  # Not imperative, capitalized
fix(packages/auth): Fixes session timeout.    # Not imperative, has period
```

## Breaking Changes

Use `!` after the scope for breaking changes:

```bash
feat(packages/auth)!: remove deprecated login method
refactor(apps/books)!: change search API response format
```

Or add `BREAKING CHANGE:` in the commit body:

```bash
git commit -m "feat(packages/auth): update authentication flow

BREAKING CHANGE: removed support for API key authentication"
```

## Rules

1. Every commit MUST follow format: `<type>(<scope>): <description>`
2. Scope MUST be `apps/<name>` or `packages/<name>`
3. Description MUST start lowercase, use imperative mood
4. No period at end of description
5. Use `!` for breaking changes
