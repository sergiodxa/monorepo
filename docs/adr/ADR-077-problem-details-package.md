# ADR-077: Problem Details Package

## Status

**Proposed** - 2026-09-23

## Background

[RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) defines `application/problem+json`, the
standard body for an HTTP API's error response: a `type` URI a client can branch on, a
`title` and `detail` written for people, the `status`, an `instance` naming the occurrence,
and any extension members the API adds. Clients get one error shape to decode, whichever API
sent it.

The repo already speaks this format in two places that each wrote their own copy.
`apps/auth-saas/app/http/lib/problem.ts` builds the responses for the management API, and
`packages/auth/src/management-client.ts` decodes them into `ManagementProblem`. The two are
held in step by a comment, and the media type constant, the `errors` entry shape and the
field list are all written twice. Every other JSON API in the repo reports failures through
`@sdxc/response`'s `{ ok: false, error }` shape, so a client decoding errors from two APIs
needs a separate decoder for each.

## Context

### Current state

| Location                                 | Role                                      | Duplicated                                    |
| ---------------------------------------- | ----------------------------------------- | --------------------------------------------- |
| `apps/auth-saas/app/http/lib/problem.ts` | Builds `Response`, mints `instance`       | media type, `ProblemDetail`, field list       |
| `packages/auth/src/management-client.ts` | Parses body with a data-schema, `Result`  | media type, `ManagementProblemDetail`, schema |
| `packages/response`, `packages/http`     | Status-named JSON helpers, `ok` flag body | nothing problem-specific                      |

### What the RFC asks of an implementation

| Rule                                                                 | Consequence for the package                                                                 |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `type` defaults to `about:blank`, whose `title` is the status phrase | a status alone produces a valid document                                                    |
| `status` in the body is advisory; the status line wins               | the builder sets both from one value; the parser reports both                               |
| Clients ignore unknown extension members                             | parsing keeps extensions, typed through a caller-given schema                               |
| Extension names: a letter first, then letters, digits, `_`, ≥3 chars | the builder rejects names outside that grammar at the type level where it can, and in tests |
| Media type may carry parameters (`; charset=utf-8`)                  | detection compares the essence, case-insensitively                                          |
| Several problems: one `type` with an array extension                 | a first-class `errors` extension with JSON Pointer entries                                  |

### Why a package, not a helper in `@sdxc/response`

`@sdxc/response` fixes a body shape (`ok` merged in) that a problem document must not
carry, and its helpers are one-per-status. A problem document is a format with both a
writer and a reader, and the reader belongs on the client side, where `@sdxc/response` has
no role. A format with parse and stringify gets its own package.

## Decision

Add `@sdxc/problem`: build, detect and parse RFC 9457 problem documents, on standard
`Response` objects, with no framework dependency.

### Types

```typescript
export interface Problem<Extensions extends object = {}> {
	type: string; // "about:blank" when absent on the wire
	title: string; // the status phrase when absent and type is about:blank
	status: number;
	detail: string | null;
	instance: string | null;
	extensions: Extensions;
}

/** One field-level issue, the entry shape of the `errors` extension. */
export interface ProblemIssue {
	pointer: string; // RFC 6901 JSON Pointer into the request body
	code: string;
	message: string;
}
```

Extensions sit under `extensions` in the API and are spread to the top level on the wire,
so a caller cannot shadow a standard member by accident. Fields are camelCase; the only
wire names are the RFC's own, which are already lowercase single words.

### Writing

```typescript
import { problem } from "@sdxc/problem";

return problem({
	status: 403,
	type: "https://example.com/probs/out-of-credit",
	title: "You do not have enough credit.",
	detail: "Your current balance is 30, but that costs 50.",
	extensions: { balance: 30 },
});

return problem({ status: 404 }); // type about:blank, title "Not Found"
```

- `problem(options, init?)` returns a `Response` with `Content-Type: application/problem+json`
  and the status line set from `options.status`. `init` merges extra headers (for example
  `Retry-After` on a 429).
- `instance` is written only when the caller passes one. Minting a request id is the
  caller's policy; auth-saas keeps its `crypto.randomUUID()` default in a two-line wrapper.
- `validationProblem(issues, options?)` builds the 422 whose `errors` extension lists each
  `ProblemIssue`, and `issuesFrom(error)` converts a `@sdxc/validate` `ValidationError`'s
  Standard Schema issues into `ProblemIssue`s by turning each issue path into a JSON Pointer
  (escaping `~` and `/` per RFC 6901).
- `stringify(problem)` returns the JSON text, for callers writing to something other than a
  `Response`.

### Reading

```typescript
import { isProblem, parseProblem } from "@sdxc/problem";

if (isProblem(response)) {
	let result = await parseProblem(response, { extensions: s.object({ balance: s.number() }) });
	if (isSuccess(result)) log.warn(result.data.type, { status: result.data.status });
}
```

- `isProblem(response)` checks the media type essence only, leaving the body unread.
- `parseProblem(response, options?)` and `parse(text, options?)` return
  `Result<Problem<Extensions>, ProblemParseError>` through `@sdxc/result`. A wrong media
  type, invalid JSON, a non-object body, or a standard member of the wrong type is a
  failure. Missing members take their RFC defaults. When the body's `status` disagrees with
  the response's status line, `status` reports the status line.
- Extensions are validated with a `remix/data-schema` schema when the caller passes one, and
  kept as `Record<string, unknown>` otherwise. `errors` has a ready-made schema,
  `ISSUES_SCHEMA`, since it is the one extension this package defines.

### Catalogs

An API's problem types are part of its contract, so an app declares them once, in a
catalog, and every response and every client check goes through it:

```typescript
import { defineProblems } from "@sdxc/problem";
import * as s from "remix/data-schema";

export const problems = defineProblems("https://docs.example.com/errors/", {
	notFound: { slug: "not-found", status: 404, title: "The resource does not exist" },
	outOfCredit: {
		slug: "out-of-credit",
		status: 403,
		title: "You do not have enough credit",
		extensions: s.object({ balance: s.number() }),
	},
	validationFailed: {
		slug: "validation-failed",
		status: 422,
		title: "The request body is invalid",
		extensions: s.object({ errors: ISSUES_SCHEMA }),
	},
});

return problems.outOfCredit({ detail: "That costs 50.", extensions: { balance: 30 } });

let result = await problems.parse(response);
if (isSuccess(result) && problems.is(result.data, "outOfCredit")) result.data.extensions.balance;
```

- **Each entry is a builder.** `type`, `status` and `title` come from the entry, the call
  site supplies only `detail`, `instance` and the extensions, and the extension schema types
  that argument. A misspelled type or a wrong status can no longer happen. Entry names
  `parse`, `is` and `entries` are rejected at the type level, since they name the catalog's
  own methods.
- **The base URL is the first argument, set once.** Moving from the placeholder domain to
  the real docs site is a one-line change, and each `type` is `new URL(slug, base)`, a
  documentation page as RFC 9457 recommends. The base must end in `/`: without it URL
  resolution drops the last segment (`/errors` + `not-found` is `/not-found`), so
  a string base is typed `` `${string}/` `` and the compiler rejects one without the slash.
  A `URL` base is checked when the catalog is defined, so a bad base fails the first test
  that imports the catalog.
- **Slugs stay explicit.** The key names the builder in code and the slug is the wire
  contract, so renaming an identifier never changes a `type` a client compares against.
- **The catalog is named in camelCase** (`problems`, not `PROBLEMS`). It's an object of
  builders called like functions, so it follows the function naming rule, and apps copy the
  name the docs use.
- **Catalog-wide settings go in an optional third argument**,
  `defineProblems(base, entries, options?)`, leaving the two-argument form stable.
- **`problems.parse` recognizes the catalog.** It returns a union typed by entry, and `is`
  narrows it, validating the extensions with that entry's schema. A `type` outside the
  catalog still parses, as a plain `Problem`, because the RFC requires clients to tolerate
  types they don't know.
- **`problems.entries()` lists the catalog**, so an app can render its error-reference docs
  page, or an OpenAPI `components.responses` section, from the same source.
- **A catalog can live in a package.** Server and client share one catalog when both import
  it: the management API's catalog lives in `@sdxc/auth`, next to the client that decodes it,
  and auth-saas builds its responses from it. `packages/*` never imports `apps/*`.

`problem()` stays as the primitive the catalog is built on, for a one-off response with no
contract behind it.

### Adoption

`@sdxc/auth` exports a `managementProblems` catalog covering the roughly 20 types the
management API answers with today. `apps/auth-saas` replaces `app/http/lib/problem.ts` with
those builders, keeping its `instance` default in the one place it wraps them. The template-string
`type` in auth-saas becomes one catalog entry per reason. `ManagementProblem` is built from
`managementProblems.parse`, and its
`ManagementProblemDetail` becomes an alias of `ProblemIssue` so the public type keeps its
name. Existing `{ ok: false }` APIs stay as they are; moving any of them to problem documents
is a per-API decision, not part of this ADR.

## Consequences

### Positive

- **One definition of the wire shape** - the writer and the reader share types and tests, so
  they cannot drift apart
- **Problem types are declared, not repeated** - a catalog makes an API's error contract
  one reviewable list, typed from the server's builders to the client's narrowing
- **Spec-accurate defaults** - `about:blank`, status phrases and media type parameters are
  handled once
- **Validation errors in a standard shape** - any route using `@sdxc/validate` can answer
  with a 422 problem in one call
- **Framework-neutral** - it works with any `Response`-based runtime, and clients outside the
  repo can decode these errors with it

### Negative

- **Another package to publish and document** - a small surface that still goes through the
  release pipeline and needs a README
- **Two error shapes in the repo** - `@sdxc/response`'s `ok: false` bodies and problem
  documents coexist until individual APIs choose to move

### Neutral

- **`@sdxc/validate` dependency** - only `issuesFrom` needs it; it stays a regular dependency
  because the package is already public
- **`packages/auth` gains a dependency** - its public types keep their names

## Implementation Plan

### Phase 1: Specify and build the package

**Priority:** High
**Estimated Effort:** 4 hours

1. Write the tests first from the RFC's examples: defaults, extension round-trips, status
   disagreement, media type parameters, JSON Pointer escaping, malformed bodies, and a type
   outside a catalog parsing as a plain `Problem`
2. Implement `problem`, `validationProblem`, `issuesFrom`, `stringify`, `isProblem`,
   `parse`, `parseProblem`, then `defineProblems` on top of them
3. Write the README per the package documentation guide, and add the row to the root README
   package table

### Phase 2: Declare the management catalog in `@sdxc/auth`

**Priority:** Medium
**Estimated Effort:** 1.5 hours

1. Export `managementProblems`, with one entry per type auth-saas answers with today
2. Build `ManagementProblem` from `managementProblems.parse`, and alias
   `ManagementProblemDetail` to `ProblemIssue`
3. Delete the local media type constant and `PROBLEM_SCHEMA`

### Phase 3: Adopt in auth-saas

**Priority:** Medium
**Estimated Effort:** 2 hours

1. Replace every `problem({ type: ... })` call with its catalog builder, and
   `app/http/lib/problem.ts` with the wrapper that defaults `instance`
2. Keep the existing tests passing, unchanged, as the check that the wire shape didn't change

### Phase 4: Publish

**Priority:** Low
**Estimated Effort:** 30 minutes

1. Remove `private: true`, then add `description` and `LICENSE.md`
2. `bun run release:bootstrap @sdxc/problem`, then configure the trusted publisher

## Alternatives Considered

### 1. Add `problem()` to `@sdxc/response`

**Rejected because**: that package merges `ok` into every body and has no reader side. A
problem helper there would be the only one breaking the package's contract.

### 2. Use an existing npm package

`http-problem-details` and similar libraries model the document as a class hierarchy, build
their own response types, and throw on invalid input.

**Rejected because**: the repo needs `Result`-returning parsing, `remix/data-schema`
validation of extensions, and plain `Response` objects. Wrapping a library to get those
costs about as much as the package itself.

### 3. Keep the two copies

**Rejected because**: they are already tied together only by a comment, and a third API
using the format would add a third copy.

## References

- [RFC 9457 - Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457)
- [RFC 6901 - JSON Pointer](https://www.rfc-editor.org/rfc/rfc6901)
- [IANA HTTP Problem Types registry](https://www.iana.org/assignments/http-problem-types)
- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)

## Current Progress

- [ ] Phase 1: Specify and build the package
- [ ] Phase 2: Declare the management catalog in `@sdxc/auth`
- [ ] Phase 3: Adopt in auth-saas
- [ ] Phase 4: Publish
