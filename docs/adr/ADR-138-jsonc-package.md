# ADR-138: `@sdxc/jsonc` Package

## Status

**Proposed** - 2026-10-14

## Background

`@sdxc/spec` reads `spec/config.jsonc` through a private `parseJsonc` in
`packages/spec/src/project-config.ts`, which strips comments and trailing commas and hands the
rest to `JSON.parse`. The `sdxc` CLI (ADR-136) reads its project configuration from
`.config/sdxc.jsonc` as well, so a second reader would otherwise be written.

## Context

- JSONC is JSON plus `//` and `/* */` comments and trailing commas in objects and arrays; VS Code,
  TypeScript's `tsconfig.json` and Wrangler's `wrangler.jsonc` read it that way.
- Stripping comments by deleting them shifts every later offset, so a `JSON.parse` error points
  at the wrong place in the file the user is editing.
- A comment marker inside a string (`"https://example.com"`) is string content, not a comment.

## Decision

Add `@sdxc/jsonc`:

```ts
import * as JSONC from "@sdxc/jsonc";

let parsed = JSONC.parse(text);
if (isFailure(parsed)) parsed.error.line; // 1-based line and column in `text`
```

- **`parse(text)`** answers `Result<unknown, JSONCParseError>`. Comments and trailing commas are
  replaced by spaces of the same length, outside strings only, before `JSON.parse`, so every
  offset in the result still points into the original text. `JSONCParseError` carries the
  message, `offset`, `line` and `column`.
- **`strip(text)`** returns that same-length JSON text for callers that parse it themselves.
- Writing is out of scope: `JSON.stringify` writes valid JSONC, and a writer that preserves
  comments is a separate problem.

`@sdxc/spec` replaces its private `parseJsonc` with `JSONC.parse`; its error messages keep their
wording and gain a line and column.

## Consequences

### Positive

- **One reader** for every JSONC file the packages and the CLI read.
- **Errors point at the user's text**, line and column included.

### Negative

- **Another package to publish** for a small amount of code.

### Neutral

- Values follow `JSON.parse` exactly; JSON5 extensions (unquoted keys, single quotes, hexadecimal
  numbers) are not accepted.

## Alternatives Considered

### 1. A private copy in `sdxc`

**Rejected because**: two readers of the same format drift, and `@sdxc/spec`'s copy already
reports positions after the stripped comments.

### 2. A third-party JSONC parser

**Rejected because**: the format needs a string-aware stripping pass and `JSON.parse`, which is
less code than evaluating a dependency's edge cases.

## References

- [ADR-136: `sdxc` Umbrella Package and CLI](./ADR-136-sdxc-umbrella-package-and-cli.md)
- [JSON with Comments in VS Code](https://code.visualstudio.com/docs/languages/json#_json-with-comments)

## Current Progress

- [ ] `@sdxc/jsonc` with `parse` and `strip`
- [ ] `@sdxc/spec` moved to `JSONC.parse`
