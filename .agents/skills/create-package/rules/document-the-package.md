---
title: Document the Package in the First Commit
impact: HIGH
tags: [packages, documentation, jsdoc]
---

# Document the Package in the First Commit

Every package has a README written to the repo's package documentation guidelines, a
module JSDoc header on every file, and JSDoc on every export. All three are MUST rules in
the root `AGENTS.md`, and all 49 packages satisfy the README one — a new package that does
not is the only one.

## Why

- **The README is the only view of the package a consumer gets.** `exports` says what can
  be imported; nothing else in the package says what any of it is for.
- **Written after the fact, it never happens.** The old package template's README was a
  fill-in-the-blank sheet, which is the version of "write it later" that gets committed.
- **JSDoc is what `vp check` reads.** The `jsdoc` lint plugin is enabled repo-wide with
  `denyWarnings`, so a missing or malformed block fails the same run a type error does.

## Pattern

### The README

Follow [the package documentation guidelines](../../../../docs/guides/package-documentation.md).
It specifies the section order — Title, Overview, Usage, API, Patterns, Related Packages,
Tips — and what each one has to contain. Read it rather than working from the shape of
another README, which may predate the guide.

```markdown
# @pkg/slugify

Converts arbitrary text into URL-safe slugs.

## Overview

<!-- what problem it solves, the approach, 2-3 paragraphs max -->

## Usage

<!-- one complete runnable example, with imports -->

## API

<!-- every public export: name, type, params, returns, example -->
```

### Module headers

Every file under `packages/` starts with the header block, before any import (or
immediately after a `#!` shebang):

```ts
/**
 * <what the module is, what it does, and why it exists — ~3 lines>
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
```

`oxfmt` sorts imports and will place a type-only import above the header in some files;
that layout is correct and stable — copy a formatted sibling rather than fighting it.

### Export JSDoc

Every exported class, function, method, variable, type, interface, and constant gets a
block, and so does every non-private member of an exported class.

```ts
// Bad: restates the signature and the name
/** Slugifies a string. Takes a string and returns a string. */
export function slugify(input: string): string {}

// Good: states the contract and the edge case
/**
 * Builds a URL-safe slug from `input`.
 *
 * Accents are stripped rather than transliterated, so `"Café"` becomes `"cafe"`. An
 * input with no alphanumerics returns the empty string; callers that need a non-empty
 * path segment supply their own fallback.
 *
 * @param input - The text to slugify.
 * @returns The slug, lowercase and hyphen-separated.
 * @example slugify("Hello, World!") // "hello-world"
 */
export function slugify(input: string): string {}
```

Explain intent, contract, and the non-obvious invariants — fallbacks, ordering
assumptions, nullability. A field whose name already says what it is gets no comment at
all; comments state the positive, never the why-not.

## Rules

1. Write the README from the package documentation guidelines in the same commit as the code
2. Put the module header on every file, `@author` and `@copyright` included
3. Give every export and every non-private class member a JSDoc block
4. Describe the contract and the edge cases, not the signature
5. Do not use placeholder wording — "Defines …", "Represents …", "Handles …" with no contract detail
