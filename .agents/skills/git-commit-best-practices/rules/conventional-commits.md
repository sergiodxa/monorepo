---
title: Use Conventional Commits
impact: HIGH
tags: [message, structure, convention]
---

# Use Conventional Commits

All commits MUST follow the Conventional Commits specification with type, optional scope, and description.

## Why

- **Automation**: Enables automatic changelog generation and versioning
- **Clarity**: Immediately shows what changed and where
- **Filtering**: Easy to filter commits by type or scope
- **Standards**: Universal convention understood across projects

## Format

```
<type>(<scope>): <description>
<type>: <description>

# Parts:
# - type (required): feat, fix, docs, refactor, test, chore, style, perf
# - scope (optional): identifies what was changed
# - description (required): brief summary of the change
```

## Determining the Scope

The scope identifies what part of the codebase was changed. To find the correct scope:

1. **Single app/package**: Use the directory name from `package.json` `name` field (e.g., if `name` is `@apps/my-app`, use `my-app`)
2. **Root-level changes**: Use `root` for changes to root configuration files (package.json, tsconfig.json, pre-commit hooks, etc.)
3. **Multiple packages**: Omit the scope entirely when changes span multiple apps/packages
4. **Tooling configs**: Use the tool name when adding/configuring tooling (e.g., `oxfmt`, `eslint`)

```bash
# Check package.json to find the scope name
cat apps/*/package.json | grep '"name"'
cat packages/*/package.json | grep '"name"'
```

## Good: Proper Conventional Commits

```bash
# Single package change - scope from package name
git commit -m "feat(<app-name>): Add search functionality"
git commit -m "fix(<package-name>): Resolve timeout issue"

# Root-level changes
git commit -m "chore(root): Add pre-commit hook"
git commit -m "chore(root): Update workspace dependencies"

# Tooling configuration
git commit -m "feat(<tool-name>): Enable import sorting"

# Global changes across multiple packages - no scope
git commit -m "refactor: Sort imports across codebase"
git commit -m "chore: Update dependencies in all packages"
git commit -m "style: Apply new formatting rules"
```

## Bad: Missing or Incorrect Format

```bash
# Bad: No type
git commit -m "add search"

# Bad: No colon after scope
git commit -m "feat(<scope>) add search"

# Bad: Lowercase description
git commit -m "feat(<scope>): add search functionality"

# Bad: Period at end
git commit -m "feat(<scope>): Add search functionality."

# Bad: Missing scope for single-package change
git commit -m "feat: Add search"  # Should include scope if only one package changed

# Bad: Using wildcards or invented scopes for global changes
git commit -m "refactor(*): Sort imports"    # Should omit scope
git commit -m "chore(all): Update deps"      # Should omit scope
git commit -m "chore(global): Apply format"  # Should omit scope
```

## Commit Types

**feat**: A new feature or enhancement

**fix**: A bug fix

**docs**: Documentation changes only

**refactor**: Code restructuring without behavior change

**test**: Adding or updating tests

**chore**: Build, dependencies, tooling

**style**: Code formatting, whitespace, etc.

**perf**: Performance improvements

## When to Omit Scope

Omit the scope when changes affect multiple apps/packages across the monorepo:

```bash
# Good: No scope for cross-cutting changes
refactor: Apply new code style across codebase
chore: Update TypeScript version in all packages
style: Sort imports with new configuration

# Bad: Don't invent scopes for global changes
refactor(*): Apply new code style
chore(all): Update TypeScript
chore(global): Sort imports
chore(monorepo): Update dependencies
```

## Description Guidelines

The description should:

- Start with a capital letter (release notes print it without the `type(scope):` prefix)
- Use imperative mood ("add" not "added" or "adds")
- Be concise (under 72 characters)
- No period at the end

```bash
# Good
feat(<scope>): Add search functionality
fix(<scope>): Resolve session timeout issue

# Bad
feat(<scope>): added search functionality  # Not imperative, lowercase
fix(<scope>): Fixes session timeout.       # Not imperative, has period
```

## Breaking Changes

Use `!` after the scope for breaking changes:

```bash
feat(<scope>)!: Remove deprecated login method
refactor(<scope>)!: Change API response format
```

Or add `BREAKING CHANGE:` in the commit body:

```bash
git commit -m "feat(<scope>): Update authentication flow

BREAKING CHANGE: removed support for API key authentication"
```

## Rules

1. Every commit MUST follow format: `<type>(<scope>): <description>` or `<type>: <description>`
2. Scope is derived from the package name or use `root` for root-level changes
3. Omit scope when changes affect multiple packages across the monorepo
4. Description MUST start with a capital letter, use imperative mood
5. No period at end of description
6. Use `!` for breaking changes
