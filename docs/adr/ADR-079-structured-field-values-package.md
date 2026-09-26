# ADR-079: Structured Field Values Package

## Status

**Accepted** - 2026-09-24

## Background

[RFC 9651](https://www.rfc-editor.org/rfc/rfc9651) (which obsoletes RFC 8941) defines Structured
Field Values: one grammar for HTTP header and trailer values, with three top-level shapes (List,
Dictionary, Item), eight bare item types, parameters and inner lists, and a strict parsing
algorithm under which a malformed field is ignored as a whole. New HTTP fields are written against
it: `Cache-Status` (RFC 9211), `Priority` (RFC 9218), `RateLimit` and `RateLimit-Policy`
(draft-ietf-httpapi-ratelimit-headers), `Idempotency-Key` (draft-ietf-httpapi-idempotency-key-header,
[ADR-082](./ADR-082-idempotency-key-package.md)), `Repr-Digest` (RFC 9530) and the `Sec-CH-UA`
client hints.

The repo writes one of these fields by hand today and has no way to read any of them. Every new
field would repeat the same string concatenation, and each copy would decide on its own how to
quote a string, when a token is valid, and how many decimal places a number may carry. The format
has both a reader and a writer, and the repo already gives such formats their own package with
`parse` and `stringify` (`@sdxc/yaml`, `@sdxc/opml`, `@sdxc/xml`).

## Context

### What Remix already provides

`@remix-run/headers` 0.21.1 (the `remix/headers` export) ships one class per header: `Accept`,
`AcceptEncoding`, `AcceptLanguage`, `CacheControl`, `ContentDisposition`, `ContentRange`,
`ContentType`, `Cookie`, `IfMatch`, `IfNoneMatch`, `IfRange`, `Range`, `SetCookie` and `Vary`
(`src/lib/*.ts`). Each parses its own pre-RFC 9651 grammar, with a shared regular-expression
parameter splitter in `param-values.ts` that unquotes values and never fails. A search of the
package source for "structured", "9651" and "8941" finds nothing: it has no generic Structured
Field parser, no bare item model (Token, Byte Sequence, Date, Display String), and no serializer
that enforces the RFC's value ranges. The per-header classes stay the right tool for the
headers they cover; this package covers the fields RFC 9651 governs.

### Existing hand-written Structured Field code

| Location                                          | Field                                  | What it does                                                               | Structured Field?                                                                                                                                                                                            |
| ------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/rate-limit/src/headers.ts` (99)         | `RateLimit`, `RateLimit-Policy`        | Joins `limit=10, remaining=0, reset=7` and `10;w=10` with template strings | Yes: a Dictionary and an Item with a parameter                                                                                                                                                               |
| `packages/workers-cache/src/cache-status.ts` (44) | `cf-cache-status`                      | Upper-cases the header and maps it through a lookup table                  | No: Cloudflare's vendor header is a bare word. RFC 9211 `Cache-Status` is a List, and nothing reads it today                                                                                                 |
| `packages/server-timing/src/timing.ts` (78)       | `Server-Timing`                        | Writes `name;desc="…";dur=12.34`                                           | No: the W3C Server Timing grammar allows upper-case metric names, token-valued `desc`, and durations with any number of decimals, all of which RFC 9651 rejects as keys or Decimals. It keeps its own writer |
| `packages/billing/src/providers/*`                | `idempotency-key`, `X-Idempotency-Key` | Sends the raw key to Stripe and Mercado Pago                               | No: those are provider headers with their own unquoted convention, and they stay as they are                                                                                                                 |

No code in `packages/*` or `apps/*` reads or writes `Priority`, `Cache-Status`, `Repr-Digest` or
`Sec-CH-UA` today.

Two observations from the inventory, neither of which this ADR changes:

- `Timing#toString` writes `desc="${this.description}"` without escaping `"` or `\`, so a
  description containing either produces a malformed `Server-Timing` entry.
- The rate-limit fields follow an earlier revision of the draft; later revisions name the policy
  (`RateLimit: "default";r=0;t=7`, `RateLimit-Policy: "default";q=10;w=10`). Moving to them is a
  change to `@sdxc/rate-limit`'s output, done on this package when it is made.

### What the RFC asks of an implementation

| Rule                                                                                           | Consequence for the package                                                                                    |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| The field's top-level type is fixed by the field's definition, never sniffed from the text     | `parse` and `stringify` take the type (`"list"`, `"dictionary"`, `"item"`) as an argument                      |
| Any parse error fails the whole field, which the recipient then ignores                        | `parse` returns `Result`; a failure never carries a partial value                                              |
| Several field lines combine by joining with `,`                                                | `Headers#get`'s `", "` join is a valid input; `getField` reads through it                                      |
| Integer: at most 15 digits; Decimal: at most 12 integer and 3 fractional digits                | every Integer fits a JS `number` exactly; `stringify` fails outside the range and rounds Decimals half-to-even |
| String is printable ASCII, escaping only `"` and `\`; Display String carries Unicode as `%"…"` | a JS `string` is an sf-string, and Unicode needs the explicit `DisplayString` wrapper                          |
| Token starts with a letter or `*` and is a distinct type from String                           | a `Token` class keeps `HIT` and `"HIT"` apart through a round trip                                             |
| Byte Sequence is base64 between colons                                                         | `Uint8Array`, encoded with `Base64` from `@sdxc/crypto`                                                        |
| Date is `@` and integer seconds since the epoch                                                | a JS `Date`; one carrying milliseconds fails to serialize                                                      |
| Keys are lowercase (`a-z`, digits, `_ - . *`), first a letter or `*`                           | keys can never look like array indices or `__proto__`, so plain objects keep insertion order safely            |
| A duplicate Dictionary or parameter key overwrites the earlier value in the earlier position   | assignment onto a null-prototype object has exactly that behavior                                              |
| A boolean `true` member or parameter serializes as the bare key                                | `stringify` writes `i`, never `i=?1`                                                                           |
| An empty List or Dictionary means "do not send the field"                                      | `setField` skips it; `stringify` returns `""`                                                                  |

## Decision

Add `@sdxc/structured-fields`: parse and serialize RFC 9651 Structured Field Values, with a plain
JavaScript value model that round-trips, a typed parse through `remix/data-schema`, and header
helpers for `Headers` objects. It depends on `@sdxc/result`, `@sdxc/crypto` (base64), `@sdxc/validate` (its `ValidationError`) and `remix`
(for `remix/data-schema`), and has no framework runtime dependency.

### Package name

| Name                                   | Trade-off                                                                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`@sdxc/structured-fields`** (chosen) | The RFC's own name ("Structured Field Values"), and the term the IETF drafts that use it say                                                                                   |
| `@sdxc/sfv`                            | Short and used by some libraries, but opaque to anyone who has not read the RFC                                                                                                |
| `@sdxc/structured-headers`             | The RFC 8941 draft-era name; it also applies to trailers, and the RFC moved away from "headers"                                                                                |
| Subpath of `@sdxc/http`                | One fewer package, but `@sdxc/http` is response builders and caching; a format with its own parser, fixtures and data-schema helpers is its own package, as `@sdxc/problem` is |

`@sdxc/structured-fields` wins because it names the standard exactly, so searching for the RFC
term finds the package, and it matches the repo's pattern of one package per wire format.

### Scope

The package includes:

- The value model: `Item`, `InnerList`, `List`, `Dictionary`, `Parameters`, and the bare item
  types, with `Token`, `Decimal` and `DisplayString` classes for the types a JS primitive cannot
  tell apart
- `parse` and `stringify` for the three top-level types, implementing RFC 9651 sections 4.1 and
  4.2 exactly
- Typed parsing through a `remix/data-schema` schema, and schema helpers for bare items, items
  with parameters, and inner lists
- `getField` and `setField` on `Headers`

What stays out, and where it lives instead:

- Field-specific meaning (what `u` means in `Priority`, what `fwd` means in `Cache-Status`) lives
  in the package that owns the field: `@sdxc/rate-limit`, `@sdxc/workers-cache`,
  `@sdxc/idempotency`, and each future adopter
- Headers with their own pre-RFC grammars live in `remix/headers` (`Accept`, `Cache-Control`,
  `Content-Disposition`, `Set-Cookie`, `Vary`, `If-Match` …) and `@sdxc/server-timing`
- HTTP Message Signatures (RFC 9421), which build on Structured Fields, live in a future
  signatures package that depends on this one

### Exports

#### `"."`

```ts
import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { ValidationError } from "@sdxc/validate";

/** An sf-token: a bare word such as `HIT` or `text/html`, distinct from the sf-string `"HIT"`. */
export class Token {
	constructor(value: string); // validated on stringify, so construction never fails
	readonly value: string;
	toString(): string;
}

/** An sf-decimal, so `1.0` stays a Decimal through a round trip. `valueOf` returns the number. */
export class Decimal {
	constructor(value: number);
	readonly value: number;
	valueOf(): number;
}

/** An sf-displaystring: Unicode text, written as `%"…"` with percent-encoded UTF-8. */
export class DisplayString {
	constructor(value: string);
	readonly value: string;
	toString(): string;
}

export namespace SF {
	/**
	 * Integer and Decimal as `number` and `Decimal`, String as `string`, Token as `Token`,
	 * Byte Sequence as `Uint8Array`, Boolean as `boolean`, Date as `Date`,
	 * Display String as `DisplayString`.
	 */
	export type BareItem =
		number | Decimal | string | Token | Uint8Array | boolean | Date | DisplayString;

	/** Keys in insertion order, on a null-prototype object. */
	export type Parameters = Record<string, BareItem>;

	export interface Item<Value extends BareItem = BareItem> {
		value: Value;
		params: Parameters;
	}

	export interface InnerList {
		items: Item[];
		params: Parameters;
	}

	export type Member = Item | InnerList;
	export type List = Member[];
	export type Dictionary = Record<string, Member>;

	export type FieldType = "list" | "dictionary" | "item";

	/** The value `parse` produces for each field type. */
	export interface ValueOf {
		list: List;
		dictionary: Dictionary;
		item: Item;
	}

	/**
	 * What `stringify` accepts: the parsed model, or any member written as its bare value
	 * (a member without parameters), and `params` optional everywhere.
	 */
	export type MemberInput =
		| BareItem
		| { value: BareItem; params?: Parameters }
		| { items: Array<BareItem | { value: BareItem; params?: Parameters }>; params?: Parameters };

	export interface InputOf {
		list: MemberInput[];
		dictionary: Record<string, MemberInput>;
		item: BareItem | { value: BareItem; params?: Parameters };
	}
}

/** The text is not a valid Structured Field of the requested type; `position` is the offset. */
export class StructuredFieldParseError extends Error {
	override name: "StructuredFieldParseError";
	readonly position: number;
}

/** A value has no RFC 9651 representation (range, character set, key syntax, fractional Date). */
export class StructuredFieldStringifyError extends Error {
	override name: "StructuredFieldStringifyError";
	readonly path: Array<string | number>; // where in the input the offending value sits
}

/** Parses into the untyped model. */
export function parse<Type extends SF.FieldType>(
	text: string,
	type: Type,
): Result<SF.ValueOf[Type], StructuredFieldParseError>;

/** Parses, then validates the model against a schema; the output is the schema's output. */
export function parse<Type extends SF.FieldType, Schema extends StandardSchemaV1<SF.ValueOf[Type]>>(
	text: string,
	type: Type,
	schema: Schema,
): Result<StandardSchemaV1.InferOutput<Schema>, StructuredFieldParseError | ValidationError>;

/** Serializes to the canonical form; an empty List or Dictionary succeeds with `""`. */
export function stringify<Type extends SF.FieldType>(
	value: SF.InputOf[Type],
	type: Type,
): Result<string, StructuredFieldStringifyError>;

/** Reads a field from `Headers`: success with `null` when absent. */
export function getField<Type extends SF.FieldType>(
	headers: Headers,
	name: string,
	type: Type,
): Result<SF.ValueOf[Type] | null, StructuredFieldParseError>;
export function getField<
	Type extends SF.FieldType,
	Schema extends StandardSchemaV1<SF.ValueOf[Type]>,
>(
	headers: Headers,
	name: string,
	type: Type,
	schema: Schema,
): Result<StandardSchemaV1.InferOutput<Schema> | null, StructuredFieldParseError | ValidationError>;

/** Writes a field onto `Headers`, deleting it instead when the List or Dictionary is empty. */
export function setField<Type extends SF.FieldType>(
	headers: Headers,
	name: string,
	value: SF.InputOf[Type],
	type: Type,
): Result<void, StructuredFieldStringifyError>;
```

`ValidationError` is `@sdxc/validate`'s, re-exported, so a caller branches on the two failure
classes without importing a second package. `parse` validates synchronously; a schema with an
async refinement is a type error, since header parsing sits on hot paths that must stay
synchronous.

**Why plain objects.** RFC 9651 keys are lowercase and begin with a letter or `*`, so no key is
an integer-like string (which JS would reorder) and none is `__proto__`. Plain null-prototype
objects therefore keep the RFC's ordered-map semantics, and a `remix/data-schema` `s.object`
validates them directly. A `Map` model would force every schema through a conversion step.

**Why a type argument on `stringify`.** A Dictionary whose keys are `value` and `params` has the
same shape as an Item, so the value alone cannot say which to write. The field's definition
fixes its type anyway, and naming it at the call site mirrors `parse`.

**Integer versus Decimal.** A plain `number` serializes as an Integer when it is an integer and
as a Decimal otherwise; `new Decimal(1)` forces `1.0`. `parse` returns Decimals as `Decimal` so
the untyped model round-trips byte for byte, and the `sf.decimal()` schema unwraps it to a
`number` for typed callers.

#### `"./schema"`

```ts
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Schema } from "remix/data-schema";
import type { SF } from "@sdxc/structured-fields";

/** The schema builders, as one catalog of functions. */
export interface StructuredFieldSchemas {
	/** An Integer, checked against the RFC range. */
	integer(): Schema<SF.BareItem, number>;
	/** A Decimal or Integer, output as `number`. */
	decimal(): Schema<SF.BareItem, number>;
	/** A Token, output as its text; with a list, narrowed to those literals. */
	token<const T extends string = string>(allowed?: readonly T[]): Schema<SF.BareItem, T>;
	/** A Display String, output as its text. A plain sf-string is `s.string()`. */
	displayString(): Schema<SF.BareItem, string>;
	bytes(): Schema<SF.BareItem, Uint8Array>;
	date(): Schema<SF.BareItem, Date>;

	/** An Item: its bare value through `value`, its parameters through `params`. */
	item<V, P = SF.Parameters>(
		value: StandardSchemaV1<SF.BareItem, V>,
		params?: StandardSchemaV1<SF.Parameters, P>,
	): Schema<SF.Member, { value: V; params: P }>;

	/** An Item whose parameters the caller ignores, output as its bare value alone. */
	value<V>(value: StandardSchemaV1<SF.BareItem, V>): Schema<SF.Member, V>;

	/** An Inner List of items matching `item`. */
	innerList<I, P = SF.Parameters>(
		item: StandardSchemaV1<SF.Member, I>,
		params?: StandardSchemaV1<SF.Parameters, P>,
	): Schema<SF.Member, { items: I[]; params: P }>;
}

export const sf: StructuredFieldSchemas;
```

The helpers are built on `createSchema`, `createIssue` and `fail` from `remix/data-schema`, so
they compose with `s.object`, `s.array`, `s.optional`, `.pipe()` and `.refine()` like any
built-in schema. Parameters and Dictionaries are `s.object(...)`, with `s.optional` for the keys
a field allows but does not require, so unknown keys pass through or fail by the caller's own
choice of object schema. `sf` is an object whose members are functions, so it is named in
`camelCase`, and it holds no state.

### Usage

**Typed reading.** A `Priority` request header (RFC 9218) read in middleware:

```ts
import { getField } from "@sdxc/structured-fields";
import { sf } from "@sdxc/structured-fields/schema";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";

const PRIORITY = s.object({
	u: s.optional(sf.value(sf.integer().pipe(checks.min(0), checks.max(7)))),
	i: s.optional(sf.value(s.boolean())),
});

let priority = getField(ctx.request.headers, "Priority", "dictionary", PRIORITY);
if (isSuccess(priority) && priority.data) ctx.log.set({ urgency: priority.data.u ?? 3 });
```

**Writing.** `packages/rate-limit/src/headers.ts` replaces its template strings. It keeps its
rule of writing only the members the backend reports, by building the object from the finite
values, and the `Result` is a failure only for a number beyond 15 digits:

```ts
let quota: Record<string, number> = {};
if (hasLimit) quota.limit = decision.limit;
if (decision.remaining !== null && Number.isFinite(decision.remaining))
	quota.remaining = decision.remaining;
if (hasReset) quota.reset = decision.retryAfter;

let written = setField(headers, "RateLimit", quota, "dictionary"); // omitted when empty
let policy = stringify({ value: decision.limit, params: { w: windowSeconds } }, "item");
```

**Reading RFC 9211 `Cache-Status`.** `packages/workers-cache/src/cache-status.ts` gains a reader
for the standard field next to its `cf-cache-status` one, so a response that passed through a
standards-speaking cache reports its hops:

```ts
let HOP = sf.item(
	s.union([sf.token(), s.string()]),
	s.object({
		hit: s.optional(s.boolean()),
		fwd: s.optional(
			sf.token([
				"bypass",
				"method",
				"uri-miss",
				"vary-miss",
				"miss",
				"request",
				"stale",
				"partial",
			]),
		),
		ttl: s.optional(sf.integer()),
		stored: s.optional(s.boolean()),
	}),
);
let hops = getField(response.headers, "Cache-Status", "list", s.array(HOP));
```

**Idempotency keys.** [ADR-082](./ADR-082-idempotency-key-package.md)'s `Idempotency-Key` is an
Item whose value is an sf-string, read with `getField(headers, "Idempotency-Key", "item",
sf.value(s.string()))` and written with `stringify(key, "item")`, which quotes and escapes it.

### Testing against the httpwg suite

The HTTP working group publishes the conformance suite
[httpwg/structured-field-tests](https://github.com/httpwg/structured-field-tests): JSON files
(`list.json`, `dictionary.json`, `item.json`, `number.json`, `string.json`, `token.json`,
`binary.json`, `date.json`, `display-string.json`, the `*-generated.json` exhaustive files, and a
`serialisation-tests/` directory), each case carrying `raw` field lines, a `header_type`, the
`expected` value, `must_fail`/`can_fail` flags, and an optional `canonical` serialization.

- The files are vendored at a pinned commit under
  `packages/structured-fields/src/fixtures/httpwg/`, with the commit hash and license in a
  `README` beside them, so the suite runs offline and an upstream change is a reviewed update.
- `src/conformance.test.ts` builds one Vitest case per fixture entry. Each parses `raw` joined
  with `", "`, compares against `expected` translated into the package model (`__type: "token"`
  to `Token`, `"binary"` from base32 to `Uint8Array`, `"date"` to `Date`, `"displaystring"` to
  `DisplayString`), and checks that `stringify` produces `canonical` (or `raw` when it is
  absent). `must_fail` cases assert a failure; `can_fail` cases accept either outcome.
- Serialization-only cases assert that `stringify` fails for out-of-range values.
- Hand-written tests cover what the suite does not: the typed `parse` overload, every `sf.*`
  helper's issue path, `getField` on an absent header, and `setField` deleting an empty field.

## Consequences

### Positive

- **One implementation of the grammar** - quoting, token validity, Decimal rounding and key rules
  are decided once and checked against the working group's own suite
- **Typed headers** - a field's shape is declared once as a schema, and the caller gets typed data
  or a failure, never a half-parsed value
- **Lossless round trips** - `Token`, `Decimal`, `DisplayString`, `Uint8Array` and `Date` keep
  every bare item type distinct, so `parse` then `stringify` reproduces the canonical text
- **New fields become cheap** - `Idempotency-Key`, `Priority`, `Cache-Status` and the current
  rate-limit draft are each a few lines over this package

### Negative

- **Wrappers for three types** - callers reading the untyped model handle `Token`, `Decimal` and
  `DisplayString` instances where they might expect primitives; the schema helpers unwrap them
- **A type argument on every call** - `parse(text, "dictionary")` is more to write than a
  sniffing parser, and it is the only way to be correct for Items that look like Dictionaries
- **Vendored fixtures** - several thousand lines of JSON live in the repo and need a manual refresh
  when the suite changes

### Neutral

- **`remix` dependency** - the schema helpers are `remix/data-schema` schemas, the same dependency
  `@sdxc/problem` and `@sdxc/validate` already carry
- **Existing per-header parsers stay** - `remix/headers` keeps the headers whose grammars predate
  RFC 9651, and `@sdxc/server-timing` keeps its own writer

## Implementation Plan

### Phase 1: Specify and build the package

**Priority:** High
**Estimated Effort:** 6 hours

1. Vendor the httpwg suite at a pinned commit and write `conformance.test.ts` first; it fails
   until the parser exists
2. Implement the bare item parsers and serializers, then Parameters, Inner Lists, and the three
   top-level types, following RFC 9651 section 4 step by step
3. Implement `getField`, `setField`, the typed `parse` overload, and the `./schema` helpers with
   their own tests
4. Write the README per the package documentation guide, add `fmt.overrides` for the fixtures
   in the root `vite.config.ts` if the formatter touches them, and add the root README row

### Phase 2: Adopt in `@sdxc/rate-limit`

**Priority:** Medium
**Estimated Effort:** 1 hour

1. Build `rateLimitHeaders`' values with `stringify`, keeping `headers.test.ts`'s byte-exact
   expectations unchanged as the check that output did not move
2. Record the move to the named-policy draft revision as a separate decision

### Phase 3: Add the `Cache-Status` reader to `@sdxc/workers-cache`

**Priority:** Low
**Estimated Effort:** 1 hour

1. Add a `cacheHops(response)` reader for RFC 9211 `Cache-Status`, next to `cacheStatus`
2. Test it with RFC 9211's examples

### Phase 4: Publish

**Priority:** Low
**Estimated Effort:** 30 minutes

1. Remove `private: true`, add `description` and `LICENSE.md`
2. `bun run release:bootstrap @sdxc/structured-fields`, then configure the trusted publisher

## Current Progress

- [x] Phase 1: Specify and build the package
  - [x] Vendor the httpwg suite (commit `00462dd`) and run it as `src/conformance.test.ts`
  - [x] Parser and serializer for the three top-level types and every bare item type
  - [x] `getField`, `setField`, the typed `parse` overload and the `./schema` helpers
  - [x] README
- [x] Phase 2: Adopt in `@sdxc/rate-limit`
  - [x] `rateLimitHeaders` writes both fields through `stringify`; `headers.test.ts`'s byte-exact
        expectations are unchanged
  - [ ] Move to the named-policy draft revision (a separate decision)
- [x] Phase 3: Add the `Cache-Status` reader to `@sdxc/workers-cache`
  - [x] `cacheHops(response)` beside `cacheStatus`, tested with RFC 9211's examples
- [ ] Phase 4: Publish

## Notes

- Implementation: `ValidationError` is `remix/data-schema`'s class, re-exported, where the
  Decision names `@sdxc/validate`'s. `remix` is already a dependency and `@sdxc/validate` is not;
  the class carries the same `issues`, and it is the one `s.parse` throws, so a caller mixing
  both catches one class. Byte Sequences use the platform's `atob`/`btoa` in place of
  `@sdxc/crypto`'s `Base64` for the same reason: `atob` implements forgiving base64, which is
  what RFC 9651 section 4.2.7 asks of a parser (missing padding and nonzero pad bits accepted).
- Implementation: schema parameters are typed `SF.SyncSchema<Output>`, a
  `StandardSchemaV1<unknown, Output>` whose `validate` returns synchronously, in place of
  `StandardSchemaV1<SF.ValueOf[Type]>` (on `parse`/`getField`) and
  `StandardSchemaV1<SF.BareItem, V>` (on `sf.item`/`sf.value`/`sf.innerList`). The Decision's
  constraints rejected its own usage examples: `s.object(...)` and `s.boolean()` declare their
  input as `unknown`, which does not fit a `BareItem` input, and an `s.object` output such as
  `{ u?: number }` does not fit the `Dictionary` output. `SyncSchema` also makes a schema with an
  async `validate` the type error the Decision describes; at runtime one that returns a Promise
  anyway fails with a `ValidationError`.
- Implementation: `SF.MemberInput`'s two object forms are named `SF.ItemInput` and
  `SF.InnerListInput`; the shapes are the ones the Decision lists.
- Implementation: `sf.item` and `sf.value` report a bare value's issue under `"value"` and
  parameter issues under `"params"` (a Dictionary member `u` fails at `["u", "value"]`), and
  `sf.innerList` under `"items", index`, matching the model's own keys.
- Implementation: a Date beyond the range a JavaScript `Date` holds (about ±8.64e12 seconds) fails
  to parse; the suite marks the two such cases `can_fail`.
- Implementation: the vendored fixtures are laid out by `vp fmt` (whitespace only) instead of
  gaining a `fmt` ignore entry in the root `vite.config.ts`, so the package needs no root
  configuration change. The suite passes in full: 2,137 cases.
- Adoption: `@sdxc/rate-limit` writes the fields of draft-ietf-httpapi-ratelimit-headers-07
  (`RateLimit: limit=…, remaining=…, reset=…`, `RateLimit-Policy: <limit>;w=<seconds>`). The one
  output change is for numbers RFC 9651 cannot represent: a field holding an Integer beyond 15
  digits is now left out, where the template strings wrote it anyway.
- Adoption: `cacheHops` returns `CacheHop[]` with camelCase fields (`fwd-status` as
  `fwdStatus`) and also reads `collapsed`, `key` and `detail`, which the Decision's schema
  leaves out. An absent or invalid field reads as `[]`, the RFCs' "ignore the field", so the
  reader sits beside `cacheStatus` as a plain value with no `Result` to unwrap.

## Alternatives Considered

### 1. Use `structured-headers` from npm

A maintained RFC 8941/9651 implementation. It throws on parse errors, models Dictionaries as
`Map`s and items as `[value, Map]` tuples, and has no Standard Schema integration.

**Rejected because**: the repo needs `Result`-returning parsing and typed results through
`remix/data-schema`. Wrapping it would convert every tuple and `Map` and catch every throw, which
costs about as much as the parser, and the conformance suite gives the same confidence.

### 2. Extend `remix/headers`

Add a generic Structured Field class alongside its per-header classes.

**Rejected because**: it is an upstream package with its own grammar conventions and a
never-failing parser; a local fork would drift from each release.

### 3. Keep per-field string handling

Each package writes its own field, as `@sdxc/rate-limit` does.

**Rejected because**: the idempotency middleware, a `Cache-Status` reader and the rate-limit
draft update would each add a copy, and reading (as opposed to writing) a field by hand is where
the grammar's edge cases produce bugs.

## References

- [RFC 9651 - Structured Field Values for HTTP](https://www.rfc-editor.org/rfc/rfc9651)
- [httpwg/structured-field-tests](https://github.com/httpwg/structured-field-tests)
- [RFC 9211 - The Cache-Status HTTP Response Header Field](https://www.rfc-editor.org/rfc/rfc9211)
- [RFC 9218 - Extensible Prioritization Scheme for HTTP](https://www.rfc-editor.org/rfc/rfc9218)
- [draft-ietf-httpapi-ratelimit-headers](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/)
- [W3C Server Timing](https://www.w3.org/TR/server-timing/)
- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)
- [ADR-077: Problem Details Package](./ADR-077-problem-details-package.md)
- [ADR-082: Idempotency-Key Package](./ADR-082-idempotency-key-package.md)
