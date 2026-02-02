---
title: Use Accurate Type Prefixes
impact: MEDIUM
tags: [message, types, accuracy]
---

# Use Accurate Type Prefixes

The type prefix must accurately reflect the nature of the changes. Using the wrong type defeats the purpose of conventional commits.

## Why

- **Automation**: Changelog generators rely on accurate types
- **Filtering**: Teams filter by type to review specific changes
- **Versioning**: Semantic versioning tools use types to determine version bumps
- **Communication**: Types quickly convey the nature of changes

## Commit Types Explained

### feat: New Features or Enhancements

Use `feat:` when adding new capabilities or enhancing existing ones:

```bash
# New feature (wholly new capability)
feat(apps/books): add book recommendation engine
feat(packages/auth): add OAuth2 support
feat(apps/store): add wishlist functionality

# Enhancement to existing feature
feat(apps/books): add genre filters to search
feat(packages/ui): add new button variants
feat(apps/store): add shipping address autocomplete
```

**Use feat when:**

- Adding completely new functionality
- Adding new options, fields, or capabilities to existing features
- Implementing new user-facing behavior

### fix: Bug Fixes

Use `fix:` when correcting unintended behavior:

```bash
# Correcting bugs
fix(apps/books): resolve search pagination issue
fix(packages/auth): prevent token expiry race condition
fix(apps/store): correct tax calculation for international orders

# Resolving errors
fix(apps/books): handle empty search results gracefully
fix(packages/db): prevent connection pool exhaustion
```

**Use fix when:**

- Correcting incorrect behavior
- Resolving errors or exceptions
- Fixing broken functionality

### refactor: Code Restructuring

Use `refactor:` when changing code structure without changing behavior:

```bash
# Extract or reorganize code
refactor(apps/books): extract search logic to separate service
refactor(packages/ui): simplify button component props
refactor(apps/store): separate sync and async payment processing

# Improve code quality
refactor(packages/auth): remove duplicate validation logic
refactor(apps/books): convert class components to hooks
```

**Use refactor when:**

- Restructuring code without changing behavior
- Extracting functions or components
- Improving code quality or readability
- No user-facing changes

### docs: Documentation Only

Use `docs:` when only documentation changes:

```bash
# Update documentation
docs(apps/books): update API integration guide
docs(packages/auth): add OAuth setup instructions
docs(apps/store): document payment webhook handling

# Fix documentation errors
docs(apps/books): correct outdated API examples
docs(packages/ui): fix broken links in component docs
```

**Use docs when:**

- Only README, documentation, or comments change
- No code changes

### test: Test Code Only

Use `test:` when only adding or modifying tests:

```bash
# Add tests
test(apps/books): add integration tests for search
test(packages/auth): add unit tests for token validation
test(apps/store): add E2E tests for checkout flow

# Update tests
test(apps/books): update tests for new search filters
test(packages/ui): fix flaky button component tests
```

**Use test when:**

- Only test files change
- No production code changes

### chore: Maintenance Tasks

Use `chore:` for build, tooling, dependencies, and maintenance:

```bash
# Dependencies
chore(packages/ui): update react to v18.3
chore(apps/books): update all dependencies
chore(root): add typescript to workspace

# Build and tooling
chore(apps/books): configure eslint rules
chore(packages/db): update tsconfig settings
chore(root): add pre-commit hooks

# Configuration
chore(apps/store): update environment variables
chore(packages/auth): configure CORS settings
```

**Use chore when:**

- Updating dependencies
- Changing build configuration
- Modifying tooling or scripts
- No production code logic changes

### style: Formatting and Style

Use `style:` for code formatting without logic changes:

```bash
# Formatting
style(apps/books): apply prettier formatting
style(packages/ui): fix eslint warnings
style(apps/store): organize imports

# Whitespace and formatting
style(packages/auth): remove trailing whitespace
style(apps/books): fix indentation
```

**Use style when:**

- Only formatting changes (prettier, eslint --fix)
- No logic or behavior changes
- Whitespace, indentation, etc.

### perf: Performance Improvements

Use `perf:` for changes that improve performance:

```bash
# Optimize performance
perf(apps/books): add caching to search queries
perf(packages/db): optimize database indexes
perf(apps/dashboard): lazy load chart components

# Reduce resource usage
perf(apps/books): debounce search input
perf(packages/ui): memoize expensive calculations
```

**Use perf when:**

- Improving speed or efficiency
- Reducing resource usage
- Optimizing algorithms or queries

## Common Mistakes

### Mistake: feat for bug fixes

```bash
# Bad: It's fixing a bug, not adding a feature
feat(apps/books): add validation to prevent duplicates

# Good: It's a fix
fix(apps/books): prevent duplicate book entries
```

### Mistake: fix for new features

```bash
# Bad: Adding validation is a feature, not fixing a bug
fix(apps/books): add ISBN validation

# Good: It's a new feature
feat(apps/books): add ISBN validation to prevent invalid entries
```

### Mistake: refactor when behavior changes

```bash
# Bad: Improving performance is behavior change
refactor(apps/books): add caching to search

# Good: It's a performance improvement
perf(apps/books): add caching to reduce search latency
```

### Mistake: chore for code changes

```bash
# Bad: Logic changes aren't chores
chore(apps/books): update search algorithm

# Good: It's a performance or feature change
perf(apps/books): optimize search algorithm for faster results
```

## When in Doubt

Ask yourself:

- **Does it add new functionality?** → `feat:`
- **Does it fix broken behavior?** → `fix:`
- **Does it improve performance?** → `perf:`
- **Does it only restructure code?** → `refactor:`
- **Does it only update docs?** → `docs:`
- **Does it only add/update tests?** → `test:`
- **Is it formatting only?** → `style:`
- **Is it dependencies/tooling/config?** → `chore:`

## Rules

1. Choose the type that accurately describes the primary change
2. Don't use `feat:` for bug fixes or vice versa
3. Don't use `refactor:` when behavior changes
4. Use `chore:` only for dependencies, tooling, and config
5. When changes span multiple types, split into multiple commits
