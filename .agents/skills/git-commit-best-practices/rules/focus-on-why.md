---
title: Focus on Why, Not Just What
impact: HIGH
tags: [message, content, clarity]
---

# Focus on Why, Not Just What

Commit messages should explain why the change was made, not just what changed. The code diff shows what; the message should provide context and reasoning.

## Why

- **Understanding**: Future developers understand the reasoning behind changes
- **Context**: Provides business or technical context that isn't in the code
- **Decisions**: Documents why one approach was chosen over alternatives
- **Debugging**: Helps identify when and why behavior changed

## Pattern

Structure your description to answer "why this change matters":

```bash
# Good: Explains the why
feat(apps/books): add pagination to prevent API timeouts
fix(packages/auth): validate tokens before use to prevent unauthorized access
refactor(apps/store): extract checkout logic to improve testability

# Bad: Only describes the what
feat(apps/books): add pagination
fix(packages/auth): add token validation
refactor(apps/store): move code to new file
```

## Good: Why-Focused Messages

```bash
# Explains the problem being solved
fix(apps/books): add ISBN validation to prevent invalid book entries

# Explains the benefit
perf(apps/dashboard): cache user preferences to reduce database load

# Explains the motivation
refactor(packages/ui): extract theme tokens to enable dark mode support

# Explains the requirement
feat(apps/store): add shipping address validation per compliance requirements

# Explains the impact
fix(packages/db): add connection retry logic to handle network failures
```

## Bad: What-Only Messages

```bash
# Doesn't explain why
feat(apps/books): update search
fix(packages/auth): change validation
refactor(apps/store): move functions

# Too vague
feat(apps/books): improvements
fix(packages/auth): updates
chore(packages/ui): changes

# Just states the obvious
feat(apps/books): add new feature
fix(packages/auth): fix bug
```

## Good Examples with Context

```bash
# Technical context
fix(apps/books): debounce search input to reduce API calls
# Why: API calls were excessive, causing rate limiting

perf(packages/db): add index on user_id to speed up queries
# Why: Queries were slow without the index

refactor(apps/store): separate sync and async payment processing
# Why: Improves testability and flexibility

# Business context
feat(apps/books): add content filtering per regional requirements
# Why: Legal compliance in certain regions

fix(apps/store): validate credit card expiry before processing
# Why: Prevent failed transactions and improve UX

# User impact
feat(apps/dashboard): add keyboard shortcuts to improve navigation
# Why: Power users requested faster navigation

fix(apps/books): preserve search filters across page navigation
# Why: Users were frustrated by losing their filters
```

## When the Why is Obvious

Sometimes the why is self-evident, especially for small fixes:

```bash
# These are acceptable
fix(apps/books): correct typo in error message
style(packages/ui): apply prettier formatting
docs(apps/store): fix broken link in README
```

But even here, you can add light context if helpful:

```bash
# Better
fix(apps/books): correct typo in error message to match documentation
docs(apps/store): fix broken link to prevent 404 errors
```

## Combining What and Why

The best messages include both:

```bash
# Format: <what> to <why>
feat(apps/books): add book recommendations to increase engagement
fix(packages/auth): validate token expiry to prevent stale sessions
refactor(apps/store): extract payment logic to support multiple providers

# Format: <action> per <requirement/reason>
feat(apps/books): add export functionality per user feedback
fix(packages/db): increase pool size to handle traffic spikes
```

## Bad: Too Much Detail

Don't put implementation details in the message:

```bash
# Too detailed
feat(apps/books): add search by modifying the SearchService class to include a new searchByTitle method that calls the database with a WHERE clause

# Better
feat(apps/books): add title-based search to improve discoverability
```

The code shows the implementation; the message explains the purpose.

## Rules

1. Explain why the change matters, not just what changed
2. Include business or technical context when relevant
3. Focus on the problem solved or benefit gained
4. Keep it concise (1-2 sentences worth in the description)
5. Implementation details belong in code comments, not commit messages
