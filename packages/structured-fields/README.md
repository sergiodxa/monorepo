# @sdxc/structured-fields

Parse and serialize RFC 9651 structured HTTP field values.

[RFC 9651](https://www.rfc-editor.org/rfc/rfc9651) is the grammar behind fields such as
`Priority`, `Cache-Status`, `RateLimit`, `Idempotency-Key` and `Repr-Digest`: each is a List, a
Dictionary or an Item of typed bare values. Every call names that top-level type (`"list"`,
`"dictionary"` or `"item"`), since the field's definition fixes it. Parsing passes the HTTP
working group's [structured-field-tests](https://github.com/httpwg/structured-field-tests) suite.

## Installation

```sh
npm add @sdxc/structured-fields
```

Results are [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values, and the
`./schema` builders are `remix/data-schema` schemas from [`remix`](https://www.npmjs.com/package/remix).

## Usage

### Write a field

```typescript
import { setField, stringify } from "@sdxc/structured-fields";

let headers = new Headers();
setField(headers, "RateLimit", [{ value: "default", params: { r: 0, t: 7 } }], "list");
// RateLimit: "default";r=0;t=7

stringify({ value: 10, params: { w: 60 } }, "item"); // success: "10;w=60"
```

Members take their shorthand: a bare value for a member without parameters, `params` omitted
anywhere, and `true` written as the bare key.

### Read the untyped model

```typescript
import { parse } from "@sdxc/structured-fields";

let parsed = parse('ExampleCache; hit; ttl=376, "Origin"; fwd=uri-miss', "list");
// success: [
//   { value: Token("ExampleCache"), params: { hit: true, ttl: 376 } },
//   { value: "Origin", params: { fwd: Token("uri-miss") } },
// ]
```

Any error fails the whole field with a `StructuredFieldParseError`; a failure never carries a
partial value.

### Keep a type a primitive cannot carry

```typescript
import { Decimal, DisplayString, Token, stringify } from "@sdxc/structured-fields";

stringify([new Token("HIT"), "HIT", new Decimal(1), 1, new DisplayString("fü")], "list");
// success: 'HIT, "HIT", 1.0, 1, %"f%c3%bc"'
```

`parse` returns the same wrappers, so a round trip keeps every type.

### Read a field through a schema

```typescript
import { isSuccess } from "@sdxc/result";
import { getField } from "@sdxc/structured-fields";
import { sf } from "@sdxc/structured-fields/schema";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";

let priority = s.object({
	u: s.optional(sf.value(sf.integer().pipe(checks.min(0), checks.max(7)))),
	i: s.optional(sf.value(s.boolean())),
});

let result = getField(request.headers, "Priority", "dictionary", priority);
if (isSuccess(result) && result.data) {
	result.data.u; // number | undefined
}
```

`sf.*` schemas hold no state, so build a field's schema once at module scope.

## API

### `@sdxc/structured-fields`

#### `parse(text, type, schema?)`

Parses a field value as `type` into `SF.ValueOf[type]`, or fails with a
`StructuredFieldParseError`. With a synchronous Standard Schema, it answers the schema's output
or a `ValidationError`. Field lines joined with `,` (what `Headers#get` returns) parse as one
value.

#### `stringify(value, type)`

Serializes `SF.InputOf[type]` to canonical text, or fails with a
`StructuredFieldStringifyError`. An empty List or Dictionary succeeds with `""`. An integral
`number` writes as an Integer (at most 15 digits), any other as a Decimal rounded half-to-even to
three digits; a `string` writes as a quoted ASCII sf-string; a `Date` writes as whole seconds.

#### `getField(headers, name, type, schema?)`

`parse` over `headers.get(name)`. An absent field succeeds with `null`.

#### `setField(headers, name, value, type)`

`stringify` onto `headers.set(name, …)`, replacing any earlier value. An empty List or
Dictionary deletes the field, and a failure leaves `headers` untouched.

#### `Token`, `Decimal`, `DisplayString`

Wrappers holding a readonly `value` for the types a primitive cannot tell apart: an sf-token
(`HIT` against the string `"HIT"`), a Decimal (`1.0` against the Integer `1`), and a Unicode
Display String (`%"f%c3%bc"`). Byte Sequences are `Uint8Array`, Dates `Date`, Booleans `boolean`.

#### `StructuredFieldParseError`

`position` is the offset where parsing stopped. RFC 9651 has a recipient ignore an invalid field,
so treat this failure as an absent field.

#### `StructuredFieldStringifyError`

`path` lists the keys and indices to the value with no representation, such as
`[0, "params", "q"]`.

#### `ValidationError`

`remix/data-schema`'s error, re-exported so both failures branch from one import; `issues` holds
the Standard Schema issues.

### `@sdxc/structured-fields/schema`

#### `sf`

Schema builders over the model that compose with `s.object`, `s.array`, `s.union`, `s.optional`,
`.pipe()` and `.refine()`. Issue paths point into the field (`["u", "value"]`,
`[0, "items", 1, "value"]`) and carry an error-map code (`sf.integer`, `sf.token.allowed`, …)
for localized messages.

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

An sf-string is `s.string()` and a Boolean `s.boolean()`. Parameters and Dictionaries are
`s.object(...)`, whose `unknownKeys` option decides what happens to keys the schema omits.

### Types

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
| `StructuredFieldSchemas`                              | The type of `sf`, from `./schema`                                                        |

## Pattern: Read Cache-Status Hops

A List of cache hops, each a Token or String naming the cache, with typed parameters.

```typescript
import { getField } from "@sdxc/structured-fields";
import { sf } from "@sdxc/structured-fields/schema";
import * as s from "remix/data-schema";

let hop = sf.item(
	s.union([sf.token(), s.string()]),
	s.object({
		hit: s.optional(s.boolean()),
		fwd: s.optional(sf.token(["bypass", "method", "uri-miss", "vary-miss", "miss", "stale"])),
		ttl: s.optional(sf.integer()),
	}),
);

let hops = getField(response.headers, "Cache-Status", "list", s.array(hop));
```

## Pattern: An Idempotency-Key Item

The field is an Item holding an sf-string: reading unwraps it, writing quotes and escapes it.

```typescript
import { getField, setField } from "@sdxc/structured-fields";
import { sf } from "@sdxc/structured-fields/schema";
import * as s from "remix/data-schema";

let key = getField(request.headers, "Idempotency-Key", "item", sf.value(s.string()));

let headers = new Headers();
setField(headers, "Idempotency-Key", "8e03978e-40d5-43e8-bc93-6894a57f9324", "item");
// Idempotency-Key: "8e03978e-40d5-43e8-bc93-6894a57f9324"
```

## Pattern: Digests As Byte Sequences

`Repr-Digest` is a Dictionary of Byte Sequences; a `Uint8Array` writes as `:base64:` and
`sf.bytes()` reads it back.

```typescript
import { getField, setField } from "@sdxc/structured-fields";
import { sf } from "@sdxc/structured-fields/schema";
import * as s from "remix/data-schema";

let body = new TextEncoder().encode("hello");
let digest = new Uint8Array(await crypto.subtle.digest("SHA-256", body));
setField(response.headers, "Repr-Digest", { "sha-256": digest }, "dictionary");

let digests = getField(
	response.headers,
	"Repr-Digest",
	"dictionary",
	s.object({ "sha-256": s.optional(sf.value(sf.bytes())) }),
);
```

## Pattern: Inner Lists With Parameters

A Dictionary member can be a parenthesized list carrying its own parameters, as in a signature's
covered components.

```typescript
import { parse, stringify } from "@sdxc/structured-fields";
import { sf } from "@sdxc/structured-fields/schema";
import * as s from "remix/data-schema";

let text = stringify(
	{ sig1: { items: ["@method", "@path"], params: { created: 1_700_000_000 } } },
	"dictionary",
);
// success: 'sig1=("@method" "@path");created=1700000000'

let input = s.object({
	sig1: sf.innerList(sf.value(s.string()), s.object({ created: sf.integer() })),
});
if (text.status === "success") parse(text.data, "dictionary", input);
// success: { sig1: { items: ["@method", "@path"], params: { created: 1700000000 } } }
```

## Pattern: Write Only The Members You Have

`setField` deletes the field when the Dictionary is empty, so build it from the values that exist
and write it unconditionally.

```typescript
import { setField } from "@sdxc/structured-fields";

let priority: Record<string, number | boolean> = {};
if (urgency !== null) priority.u = urgency;
if (incremental) priority.i = true;

setField(headers, "Priority", priority, "dictionary");
```

## Pattern: Branch On Why A Field Failed

An unparseable field is ignored as if absent; a field that parses but breaks the schema is the
client's mistake to report.

```typescript
import { isFailure } from "@sdxc/result";
import { StructuredFieldParseError, getField } from "@sdxc/structured-fields";
import { sf } from "@sdxc/structured-fields/schema";
import * as s from "remix/data-schema";

let schema = s.object({ u: s.optional(sf.value(sf.integer())) });
let result = getField(request.headers, "Priority", "dictionary", schema);

let priority = { u: 3 };
if (isFailure(result)) {
	if (!(result.error instanceof StructuredFieldParseError)) {
		return Response.json({ issues: result.error.issues }, { status: 400 });
	}
} else if (result.data?.u !== undefined) {
	priority.u = result.data.u;
}
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/structured-fields": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
