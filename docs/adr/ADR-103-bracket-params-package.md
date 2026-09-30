# ADR-103: Bracket Params Package

## Status

**Accepted** - 2026-09-30

## Background

A query string is flat: `URLSearchParams` maps a name to one or more strings. Filter, sort and
pagination state is not flat, and the convention every server framework reads for it is bracket
syntax: `filter[status]=open&sort[0][field]=date&tags[]=a&tags[]=b`. The `qs` package is the
de-facto reader and writer for that syntax, but it ships its own parser instead of building on
`URLSearchParams`, guesses nothing about types (every leaf is a string), and leaves validation to
the caller.

Forms use the same syntax (`post[title]`, `post[photos][]`) and hit the same wall.
`remix/data-schema/form-data`'s `f.object` and `@sdxc/validate` both read search params and
`FormData` flat, so `filter[status]` arrives as the literal key `"filter[status]"`. This package
reads and writes the nested form of either, and validates it in the same call.

## Decision

Add `@sdxc/bracket-params`, a format package named after the syntax it speaks, since it reads
both query strings and form data. It exports `parse`, `stringify`, `toFormData` and `fieldName`.

```typescript
import { parse, stringify, toFormData } from "@sdxc/bracket-params";
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

let Filters = s.object({
	filter: s.object({ status: s.string(), tags: s.array(s.string()) }),
	page: coerce.number(),
});

let result = parse(new URL(request.url), Filters);
// Result<{ filter: { status: string; tags: string[] }; page: number }, ValidationError>

let query = stringify({ filter: { status: "open" }, page: 2 });
// "filter%5Bstatus%5D=open&page=2"
let params = new URLSearchParams(query);

let form = toFormData({ post: { title: "Hi", photos: [file] } });
// post[title]=Hi, post[photos][0]=<file>
```

### `parse(source, schema, options?)`

- `source` is a query string (leading `?` optional), a `URLSearchParams`, a `URL`, an
  `@sdxc/location` `Location`, or a `FormData`. `URL` and `Location` are read through their
  `searchParams`. Only `FormData` carries `File` values; they arrive as leaves unchanged, so a
  schema reads them with `s.instanceof_(File)`.
- `schema` is any synchronous Standard Schema; `remix/data-schema` is the one the repo uses. The
  schema receives the nested value and its output types the result.
- The return value is a `Result`, with the schema's issues in a `ValidationError` from
  `@sdxc/validate`, so a failure reads the same as every other validation failure in the repo. An
  asynchronous schema fails the parse, which keeps `parse` synchronous.

### Reading rules

| Query                 | Value                         |
| --------------------- | ----------------------------- |
| `a=1`                 | `{ a: "1" }`                  |
| `a=1&a=2`             | `{ a: ["1", "2"] }`           |
| `a[b][c]=1`           | `{ a: { b: { c: "1" } } }`    |
| `a[]=1&a[]=2`         | `{ a: ["1", "2"] }`           |
| `a[1]=y&a[0]=x`       | `{ a: ["x", "y"] }`           |
| `a[0][b]=1&a[0][c]=2` | `{ a: [{ b: "1", c: "2" }] }` |
| `a[0]=x&a[k]=y`       | `{ a: { 0: "x", k: "y" } }`   |
| `a[5]=x`              | `{ a: ["x"] }` (compacted)    |
| `a=1&a[b]=2`          | failure: a value and a group  |
| `a[b`, `[a]`, `a]`    | the literal key               |
| `__proto__[x]=1`      | parameter ignored             |

- Every text leaf is a string. Types come from the schema (`coerce.number()`, `coerce.boolean()`), so
  `"007"` is never read as `7`.
- A group whose keys are all array indices (or `[]` pushes) becomes an array, ordered by index and
  compacted. Indices are stored as keys and compacted at the end, so `a[99999999]=x` allocates one
  entry; no array-length limit is needed.
- `depth` (default 5) bounds the bracket segments one key may nest, and `parameterLimit` (default 1000) bounds the parameters (or fields) one source may carry. Exceeding either fails the parse instead of
  silently truncating, so a caller never validates a partial query.

### `stringify(value)` and `toFormData(value)`

`stringify` writes a nested object as a query string through `URLSearchParams`, so encoding
follows the `application/x-www-form-urlencoded` serializer (brackets as `%5B`/`%5D`, spaces as
`+`). `toFormData` writes the same keys into a `FormData`, appending each `Blob` (a `File`
included) as its own field; the types reject a `Blob` passed to `stringify`.

- Objects write `key[child]`; arrays write `key[index]`, which is the only form that keeps an
  array of objects grouped and that round-trips through `parse` at any length.
- Strings, numbers, booleans and bigints write `String(value)`; a `Date` writes `toISOString()`;
  `null` and `undefined` are skipped. Empty arrays and objects write nothing, since the syntax has
  no way to express them.

### `fieldName(path)`

Writes one path as its field name (`["items", 0, "quantity"]` to `items[0][quantity]`). A form
names its inputs with it, and it turns a schema issue's `path` into the name of the input the
issue belongs to, for UI that matches issues to fields by name.

## Consequences

### Positive

- **One call from URL or form to typed value** - `parse(source, schema)` covers reading, nesting
  and validating.
- **Round trip** - `parse(stringify(value))` reproduces any value whose leaves are strings, and
  `parse(toFormData(value))` any whose leaves are strings or files.
- **Built on the platform** - decoding and encoding are `URLSearchParams`'; the package only maps
  keys to paths.

### Negative

- **No dot notation or comma lists** - `a.b=1` and `a=1,2` stay literal. Dots are common inside
  real keys, and a comma list is indistinguishable from a value containing a comma.
- **Top-level keys containing brackets** cannot be written unambiguously by `stringify`.

### Neutral

- **Reading a `Request`** stays with the caller: `parse(await request.formData(), schema)` keeps
  `parse` synchronous.
- `@sdxc/validate` keeps reading `URLSearchParams` and `FormData` flat.

## Alternatives Considered

### 1. A data-schema wrapper (`q.object(...)` passed to `s.parse`)

**Rejected because**: the caller wants the query read and validated in one call whose input is
the URL itself; a wrapper schema makes the nesting an invisible property of the schema instead.

### 2. Array length limit (`qs`'s `arrayLimit`)

**Rejected because**: `qs` needs it to avoid allocating sparse arrays. Storing indices as keys and
compacting removes the allocation, and a limit would break the round trip for long arrays.
