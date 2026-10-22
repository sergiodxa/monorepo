# ADR-172: Restore `@sdxc/iife` for Expression-Shaped Control Flow

## Status

**Implemented** - 2026-10-22

## Background

`@sdxc/iife` was removed in `chore(packages): drop the arrays and iife helpers` because
nothing in the repo imported it and rewrites preferred native syntax. ADR-171 then banned
nested ternaries (`eslint/no-nested-ternary`) and rewrote them to `if`/`else` that assign
an outer `let`. That shape loses expression form: the binding is declared empty, filled by
branches, and needs extra annotations when TypeScript no longer narrows through the old
ternary.

## Decision

**Restore `@sdxc/iife` and use it when a short block exists only to compute one value in an
expression position.** Prefer `let x = iife(() => { … })` (or `await iife(async () => …)`)
over a mutable `let` cascade. Keep nested ternaries banned; when a block grows past a short
callback, extract a named function instead of a large `iife`.

## Consequences

- Call sites keep control flow and the binding together; TypeScript infers from `return`
  arms the way it did from ternary branches.
- Packages and apps that use the helper declare `@sdxc/iife` as a `workspace:*` dependency.
- The package is public again: README row, `groups.ts` entry, and npm bootstrap before the
  next dated release.
