---
title: Keep Messages Concise but Complete
impact: HIGH
tags: [message, length, clarity]
---

# Keep Messages Concise but Complete

Commit messages should be brief enough to scan quickly but complete enough to understand the change without reading code.

## Why

- **Scannability**: Short messages are easier to review in git log
- **Completeness**: Enough context to understand the change
- **Efficiency**: Don't waste time reading or writing unnecessary detail
- **Searchability**: Concise messages are easier to search and filter

## Pattern

Aim for one clear sentence in the description (after the type and scope):

```bash
# Good: Concise and complete
feat(apps/books): add search filters to improve book discovery
fix(packages/auth): resolve race condition in token refresh
refactor(apps/store): extract payment logic to support multiple providers

# Too verbose
feat(apps/books): add search filters including author, genre, and publication date to improve the book discovery experience for users who want to find specific types of books

# Too terse
feat(apps/books): filters
fix(packages/auth): fix
refactor(apps/store): changes
```

## Length Guidelines

**Description (after colon):**

- Target: 20-50 characters
- Maximum: 72 characters
- Should fit on one line in git log

```bash
# Good length (35 chars)
feat(apps/books): add pagination to search results

# Acceptable (60 chars)
fix(packages/auth): validate token expiry to prevent stale sessions

# Too long (95 chars)
feat(apps/books): add comprehensive search functionality with filters for author, genre, publication year, and rating
```

## Complete Without Being Verbose

Include just enough context:

```bash
# Good: Complete context in few words
fix(apps/books): prevent duplicate ISBNs to maintain data integrity
perf(apps/dashboard): cache chart data to reduce render time
feat(apps/store): add guest checkout to improve conversion

# Too verbose: Unnecessary details
fix(apps/books): add validation check to prevent duplicate ISBN entries from being saved to the database which was causing data integrity issues
perf(apps/dashboard): implement caching mechanism using Redis to store chart data and reduce the time required to render charts
feat(apps/store): add new guest checkout flow that allows users to purchase without creating an account to improve our conversion rate

# Too terse: Missing context
fix(apps/books): prevent duplicates
perf(apps/dashboard): add caching
feat(apps/store): guest checkout
```

## Use Strong Action Verbs

Choose precise verbs that convey meaning quickly:

```bash
# Good: Specific verbs
feat(apps/books): implement book recommendations
fix(packages/auth): resolve session timeout issue
refactor(apps/store): extract checkout validation
perf(apps/dashboard): optimize query performance

# Weak: Vague verbs
feat(apps/books): update recommendations
fix(packages/auth): change session handling
refactor(apps/store): improve checkout
perf(apps/dashboard): make queries better
```

## Common Patterns

**Features:**

```bash
feat(apps/books): add <what> to <benefit>
feat(apps/store): implement <what> for <purpose>
feat(packages/ui): enable <what> to <benefit>
```

**Fixes:**

```bash
fix(apps/books): resolve <problem> to <prevent>
fix(packages/auth): prevent <issue> by <solution>
fix(apps/store): correct <error> in <component>
```

**Refactoring:**

```bash
refactor(apps/books): extract <what> to <improve>
refactor(packages/ui): simplify <what> for <benefit>
refactor(apps/store): separate <what> to <enable>
```

## When to Use Commit Body

For complex changes, use the commit body (not available in single-line commits):

```bash
# Single-line: Most commits
git commit -m "feat(apps/books): add bulk import functionality"

# Multi-line: Complex changes needing more context
git commit -m "feat(apps/books): add bulk import functionality" -m "
Supports CSV and JSON formats up to 10,000 books.
Validates ISBN, title, and author before import.
Sends email notification on completion."

# But prefer keeping commits small enough for single-line messages
```

## Good: Concise Examples

```bash
feat(apps/books): add wishlist functionality
fix(packages/auth): resolve token refresh race condition
refactor(apps/store): extract payment processor interface
perf(apps/dashboard): add database query caching
docs(apps/books): update API authentication guide
test(packages/auth): add unit tests for token validation
chore(packages/ui): update storybook to v7.6
style(apps/books): apply prettier formatting
```

## Bad: Too Wordy

```bash
# Way too long
feat(apps/books): this commit adds the ability for users to create and manage wishlists where they can save books they're interested in purchasing later

# Better
feat(apps/books): add wishlist functionality

# Too long
fix(packages/auth): this fixes a race condition that was occurring when multiple requests tried to refresh the authentication token at the same time

# Better
fix(packages/auth): resolve token refresh race condition
```

## Rules

1. Keep description under 72 characters
2. Aim for 20-50 characters for most commits
3. Include enough context to understand the change
4. Use strong, specific action verbs
5. Save detailed explanations for code comments, not commit messages
