# @sdxc/bracket-params

Read and write nested query strings and form data with bracket syntax, validated by a Standard
Schema.

`URLSearchParams` and `FormData` are flat: a name maps to values. `parse` reads bracket keys
(`filter[status]=open&sort[0][field]=date&tags[]=a`) into nested objects and arrays and runs the
result through your schema in the same call. `stringify` writes a nested object back as a query
string, and `toFormData` writes it as a form, files included. Decoding and encoding are the
platform's own.

Every text value is read as a string: types come from the schema (`coerce.number()`), so `"007"`
is never guessed into `7`. `parse` returns a `Result` instead of throwing.

## Installation

```bash
npm add @sdxc/bracket-params
```

The schema comes from any [Standard Schema](https://standardschema.dev) library; the examples use
[`remix/data-schema`](https://www.npmjs.com/package/remix).
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) installs alongside and supplies
`isFailure` and `unwrap`.

## Usage

### Read A URL

```typescript
import { parse } from "@sdxc/bracket-params";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

let Filters = s.object({
	filter: s.object({ status: s.string(), tags: s.array(s.string()) }),
	page: coerce.number(),
});

let result = parse(new URL(request.url), Filters);
// ?filter[status]=open&filter[tags][]=a&page=2

if (isFailure(result)) return Response.json(result.error.issues, { status: 400 });
result.data; // { filter: { status: "open", tags: ["a"] }, page: 2 }
```

`parse` also reads a query string (with or without its `?`), a `URLSearchParams` and an
[`@sdxc/location`](https://www.npmjs.com/package/@sdxc/location) `Location`.

### Read A Form

```typescript
let Post = s.object({
	post: s.object({ title: s.string(), photos: s.array(s.instanceof_(File)) }),
});

let result = parse(await request.formData(), Post);
// post[title]=Hi, post[photos][]=<file>, post[photos][]=<file>
```

### Write A Query Or A Form

```typescript
import { stringify, toFormData } from "@sdxc/bracket-params";

let query = stringify({ filter: { status: "open", tags: ["a", "b"] }, page: 2 });
// "filter%5Bstatus%5D=open&filter%5Btags%5D%5B0%5D=a&filter%5Btags%5D%5B1%5D=b&page=2"
let params = new URLSearchParams(query);

let form = toFormData({ post: { title: "Hi", photos: [file] } });
await fetch("/posts", { method: "POST", body: form });
```

## API

### `parse(source, schema, options?)`

Reads a query string, `URLSearchParams`, `URL`, `Location` or `FormData` into nested values and
validates them against a synchronous schema, returning the schema's output or a
`ValidationError` whose `issues` carry each path. How keys read:

| Source          | Value                       |
| --------------- | --------------------------- |
| `a=1&a=2`       | `{ a: ["1", "2"] }`         |
| `a[b][c]=1`     | `{ a: { b: { c: "1" } } }`  |
| `a[]=1&a[]=2`   | `{ a: ["1", "2"] }`         |
| `a[1]=y&a[0]=x` | `{ a: ["x", "y"] }`         |
| `a[0][b]=1`     | `{ a: [{ b: "1" }] }`       |
| `a[0]=x&a[k]=y` | `{ a: { 0: "x", k: "y" } }` |
| `a[b=1`         | `{ "a[b": "1" }` (literal)  |

A group whose keys are all indices becomes an array ordered by index, with gaps closed. Files in
a `FormData` arrive as values unchanged. A key used both as a value and as a group
(`a=1&a[b]=2`) fails, and a parameter with a `__proto__` segment is ignored.

`options.depth` (default `5`) bounds the bracket segments of one key, and
`options.parameterLimit` (default `1000`) bounds the entries of one source; exceeding either
fails the parse.

### `stringify(value)`

Writes an object as a query string without a leading `?`. Objects write `key[child]`, arrays
write `key[index]`, a `Date` writes its ISO string, other values write `String(value)`, and
`null`, `undefined` and empty groups write nothing. `parse(stringify(value))` reproduces any value
whose leaves are strings.

### `toFormData(value)`

Writes an object as `FormData` with the same keys `stringify` writes, appending each `Blob` or
`File` as its own field, so `parse(toFormData(value))` also reproduces files.

### `fieldName(path)`

Writes a path as its bracket field name, the inverse of how `parse` reads one key:
`fieldName(["items", 0, "quantity"])` is `"items[0][quantity]"`. It takes a schema issue's
`path` as-is, so a form can place each issue on the input it belongs to.

### Types

`BracketParamsSource` is what `parse` reads and `ParseOptions` its limits. `TextValue` is what
`stringify` writes as text, `FormValue` adds `Blob` for `toFormData`, and
`BracketInput<Value, Leaf>` is the nested shape both writers accept. `PathSegment` is one
segment `fieldName` takes.

## Pattern: Filter Links That Keep The Current Query

Read the current filters, change one, and write the link back:

```typescript
import { parse, stringify } from "@sdxc/bracket-params";
import { unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";

let Query = s.object({
	filter: s.defaulted(s.object({ status: s.optional(s.string()) }), {}),
	q: s.optional(s.string()),
});

let current = unwrap(parse(new URL(request.url), Query));
let openHref = `?${stringify({ ...current, filter: { ...current.filter, status: "open" } })}`;
```

## Versioning

Releases are dated (`2026.9.30`) and carry no compatibility promise between dates; pin an exact
version.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
