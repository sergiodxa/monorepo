# @sdxc/structured-fields

Parse and serialize RFC 9651 structured HTTP field values.

## Overview

[RFC 9651](https://www.rfc-editor.org/rfc/rfc9651) defines one grammar for new HTTP fields:
`Priority`, `Cache-Status`, `RateLimit`, `Idempotency-Key`, `Repr-Digest` and the client hints
are all a List, a Dictionary or an Item of typed bare values. This package implements the RFC's
parsing and serialization algorithms once, checked against the HTTP working group's
[structured-field-tests](https://github.com/httpwg/structured-field-tests) suite, so each field
becomes a few lines of declaration instead of hand-written string handling.

Every call names the field's top-level type (`"list"`, `"dictionary"` or `"item"`), because the
RFC fixes it in the field's definition rather than in the text. Parsing returns a `Result` from
`@sdxc/result` and never a partial value; serializing fails, with the path to the offending
value, for anything the RFC cannot represent. Headers whose grammar predates RFC 9651 (`Accept`,
`Cache-Control`, `Set-Cookie`, …) stay with `remix/headers`.

The `./schema` entry point adds `remix/data-schema` helpers, so a field's shape is declared once
and read as typed values.

## Usage

### Reading a field with a schema

```typescript
import { getField } from "@sdxc/structured-fields";
import { sf } from "@sdxc/structured-fields/schema";
import { isSuccess } from "@sdxc/result";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";

const PRIORITY = s.object({
	u: s.optional(sf.value(sf.integer().pipe(checks.min(0), checks.max(7)))),
	i: s.optional(sf.value(s.boolean())),
});

let priority = getField(request.headers, "Priority", "dictionary", PRIORITY);
if (isSuccess(priority) && priority.data) {
	priority.data.u; // number | undefined
}
```

### Writing a field

```typescript
import { setField, stringify } from "@sdxc/structured-fields";

setField(headers, "RateLimit", { limit: 10, remaining: 0, reset: 7 }, "dictionary");
// RateLimit: limit=10, remaining=0, reset=7

stringify({ value: 10, params: { w: 60 } }, "item"); // success: "10;w=60"
```

### Reading the untyped model

```typescript
import { parse, Token } from "@sdxc/structured-fields";

let parsed = parse('ExampleCache; hit; ttl=376, "Origin"; fwd=uri-miss', "list");
// success: [
//   { value: Token("ExampleCache"), params: { hit: true, ttl: 376 } },
//   { value: "Origin", params: { fwd: Token("uri-miss") } },
// ]
```

## API

### `.`

#### `parse(text, type, schema?)`

Parses a field value as `type`. Without a schema it returns the model (`SF.ValueOf[type]`) or a
`StructuredFieldParseError`. With a synchronous Standard Schema it validates the model and
returns the schema's output, or a `ValidationError` carrying the issues. Several field lines
joined with `,` (what `Headers#get` returns) are valid input.

```typescript
parse("u=1, i", "dictionary"); // success: { u: { value: 1, params: {} }, i: { value: true, params: {} } }
parse("1, 2,", "list"); // failure: StructuredFieldParseError, position 5
```

#### `stringify(value, type)`

Serializes to the canonical text, or fails with a `StructuredFieldStringifyError` whose `path`
names the offending value. An empty List or Dictionary succeeds with `""`. Members may be
written in their shorthand forms: a bare value for a member without parameters, `params`
omitted anywhere.

- A `number` that is an integer writes as an Integer (at most 15 digits), any other `number`
  as a Decimal rounded half-to-even to three fractional digits
- A `string` writes as a quoted sf-string, which carries printable ASCII only
- A member or parameter whose value is `true` writes as the bare key

```typescript
stringify([1, 1.5, new Decimal(1)], "list"); // success: "1, 1.5, 1.0"
stringify({ i: true, u: 3 }, "dictionary"); // success: "i, u=3"
stringify("fü", "item"); // failure: use new DisplayString("fü")
```

#### `getField(headers, name, type, schema?)`

Reads a field from `Headers` through `parse`. An absent field succeeds with `null`.

#### `setField(headers, name, value, type)`

Writes a field onto `Headers` through `stringify`, replacing any earlier value. An empty List or
Dictionary deletes the field. A failure leaves `headers` untouched.

#### `Token`, `Decimal`, `DisplayString`

Wrappers for the bare item types a JavaScript primitive cannot tell apart: `new Token("HIT")`
writes `HIT` where `"HIT"` writes `"HIT"`, `new Decimal(1)` writes `1.0`, and
`new DisplayString("fü")` writes `%"f%c3%bc"`. `parse` returns them, so a round trip is
lossless. Byte Sequences are `Uint8Array`, Dates are `Date` (whole seconds only), Booleans are
`boolean`.

#### `StructuredFieldParseError`

`position` is the offset into the field value where parsing stopped.

#### `StructuredFieldStringifyError`

`path` lists the keys and indices leading to the value with no representation, such as
`[0, "params", "q"]`.

#### `ValidationError`

`remix/data-schema`'s error, re-exported so a caller branches on both failures from one import.
`issues` holds the Standard Schema issues.

#### `SF` (types)

| Type                                                  | Meaning                                                                                  |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `SF.BareItem`                                         | `number \| Decimal \| string \| Token \| Uint8Array \| boolean \| Date \| DisplayString` |
| `SF.Parameters`                                       | `Record<string, BareItem>` on a null-prototype object, in field order                    |
| `SF.Item`                                             | `{ value, params }`                                                                      |
| `SF.InnerList`                                        | `{ items: Item[], params }`                                                              |
| `SF.Member`, `SF.List`, `SF.Dictionary`               | A List or Dictionary member, the List, and the Dictionary (null prototype)               |
| `SF.FieldType`                                        | `"list" \| "dictionary" \| "item"`                                                       |
| `SF.ValueOf`, `SF.InputOf`                            | What `parse` returns and what `stringify` accepts, per field type                        |
| `SF.ItemInput`, `SF.InnerListInput`, `SF.MemberInput` | The shorthand member forms `stringify` accepts                                           |
| `SF.SyncSchema<Output>`                               | A Standard Schema whose `validate` answers synchronously                                 |

### `./schema`

#### `sf`

Schema builders built on `remix/data-schema`'s `createSchema`, so they compose with `s.object`,
`s.array`, `s.union`, `s.optional`, `.pipe()` and `.refine()`. Issues point at their place in
the field, such as `["u", "value"]` or `[0, "items", 1, "value"]`.

| Builder                       | Accepts                           | Outputs                            |
| ----------------------------- | --------------------------------- | ---------------------------------- |
| `sf.integer()`                | An Integer within 15 digits       | `number`                           |
| `sf.decimal()`                | A Decimal or an Integer           | `number`                           |
| `sf.token(allowed?)`          | A Token, optionally one of a list | its text, narrowed to the literals |
| `sf.displayString()`          | A Display String                  | `string`                           |
| `sf.bytes()`                  | A Byte Sequence                   | `Uint8Array`                       |
| `sf.date()`                   | A Date                            | `Date`                             |
| `sf.item(value, params?)`     | An Item                           | `{ value, params }`                |
| `sf.value(value)`             | An Item, parameters ignored       | the bare value's output            |
| `sf.innerList(item, params?)` | An Inner List                     | `{ items, params }`                |

A plain sf-string and a Boolean need no helper: `s.string()` and `s.boolean()`. Parameters and
Dictionaries are `s.object(...)`, with `s.optional` for keys a field allows but does not
require; the object schema's `unknownKeys` option decides what happens to the rest.

## Pattern: Reading RFC 9211 Cache-Status

A List of cache hops, each a Token or String naming the cache, with typed parameters.

```typescript
import { getField } from "@sdxc/structured-fields";
import { sf } from "@sdxc/structured-fields/schema";
import * as s from "remix/data-schema";

const HOP = sf.item(
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

## Pattern: An Idempotency-Key Item

The field is an Item whose value is an sf-string. Reading unwraps it; writing quotes and escapes
it.

```typescript
import { getField, stringify } from "@sdxc/structured-fields";
import { sf } from "@sdxc/structured-fields/schema";
import * as s from "remix/data-schema";

let key = getField(request.headers, "Idempotency-Key", "item", sf.value(s.string()));
let header = stringify("8e03978e-40d5-43e8-bc93-6894a57f9324", "item");
// success: "\"8e03978e-40d5-43e8-bc93-6894a57f9324\""
```

## Pattern: Writing only the members you have

`setField` deletes the field when the Dictionary ends up empty, so build the object from the
values that exist and write it unconditionally.

```typescript
let quota: Record<string, number> = {};
if (limit !== null) quota.limit = limit;
if (remaining !== null) quota.remaining = remaining;

let written = setField(headers, "RateLimit", quota, "dictionary");
```

## Related Packages

- [`@sdxc/result`](/packages/result) - The `Result` every function returns
- [`@sdxc/rate-limit`](/packages/rate-limit) - Writes the `RateLimit` fields
- [`@sdxc/server-timing`](/packages/server-timing) - `Server-Timing` has its own W3C grammar
  and keeps its own writer

## Tips

1. **Build schemas at module scope** - `sf.*` schemas hold no state, so declare a field's schema
   once and reuse it on every request.
2. **Treat a parse failure as an absent field** - RFC 9651 has recipients ignore an invalid field
   as a whole; fall back to the field's default rather than failing the request.
3. **Use `DisplayString` for Unicode** - an sf-string carries printable ASCII only, so
   `stringify` fails a `string` with other characters.
4. **Write Decimals explicitly when the field requires one** - `2` writes as the Integer `2`;
   `new Decimal(2)` writes `2.0`.
5. **Dates are whole seconds** - a `Date` with milliseconds fails to serialize; truncate it
   first with `new Date(Math.floor(date.getTime() / 1000) * 1000)`.
