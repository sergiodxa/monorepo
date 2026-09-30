# @sdxc/bracket-params

Read and write nested query strings and form data with bracket syntax, validated by a Standard
Schema.

[`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) and
[`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) map a name to flat
values. This package reads bracket keys such as `filter[status]=open` and `items[0][quantity]=2`
into nested objects and arrays, runs them through your schema in the same call, and writes a
nested value back in the same syntax.

## Installation

```bash
npm add @sdxc/bracket-params
```

Schemas come from any [Standard Schema](https://standardschema.dev) library, such as
[`remix`](https://www.npmjs.com/package/remix)'s `remix/data-schema`, installed alongside.

## Usage

### Read A Query String

```typescript
import { parse } from "@sdxc/bracket-params";
import * as s from "remix/data-schema";

parse("?tags[]=a&tags[]=b", s.object({ tags: s.array(s.string()) }));
// { status: "success", data: { tags: ["a", "b"] } }
```

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

// https://example.com/tasks?filter[status]=open&filter[tags][]=a&page=2
let result = parse(new URL(request.url), Filters);

if (isFailure(result)) return Response.json(result.error.issues, { status: 400 });
result.data; // { filter: { status: "open", tags: ["a"] }, page: 2 }
```

### Read A Form

```typescript
import { parse } from "@sdxc/bracket-params";
import * as s from "remix/data-schema";

let Post = s.object({
	post: s.object({ title: s.string(), photos: s.array(s.instanceof_(File)) }),
});

// post[title]=Hi, post[photos][]=<file>, post[photos][]=<file>
let result = parse(await request.formData(), Post);
```

### Write A Query Or A Form

```typescript
import { stringify, toFormData } from "@sdxc/bracket-params";

let query = stringify({ filter: { status: "open" }, page: 2 });
// "filter%5Bstatus%5D=open&page=2"

let form = toFormData({ post: { title: "Hi", photos: [file] } });
await fetch("/posts", { method: "POST", body: form });
```

## API

### `parse(source, schema, options?)`

Reads a query string (with or without its `?`), `URLSearchParams`, `URL`,
[`@sdxc/location`](https://www.npmjs.com/package/@sdxc/location) `Location` or `FormData` into
nested values and validates them with a synchronous schema, returning an
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) `Result` with the schema's output or
an [`@sdxc/validate`](https://www.npmjs.com/package/@sdxc/validate) `ValidationError` whose
`issues` carry each path.

| Source          | Value                       |
| --------------- | --------------------------- |
| `a=1&a=2`       | `{ a: ["1", "2"] }`         |
| `a[b][c]=1`     | `{ a: { b: { c: "1" } } }`  |
| `a[]=1&a[]=2`   | `{ a: ["1", "2"] }`         |
| `a[1]=y&a[0]=x` | `{ a: ["x", "y"] }`         |
| `a[0][b]=1`     | `{ a: [{ b: "1" }] }`       |
| `a[0]=x&a[k]=y` | `{ a: { 0: "x", k: "y" } }` |
| `a[b=1`         | `{ "a[b": "1" }`            |

Text values stay strings, so types come from the schema (`coerce.number()`), and files arrive
unchanged. A key used both as a value and as a group (`a=1&a[b]=2`) fails the parse, and a key
with a `__proto__` segment is ignored.

- `options.depth`: bracket segments one key may nest before the parse fails. Default `5`.
- `options.parameterLimit`: entries one source may carry before the parse fails. Default `1000`.

### `stringify(value)`

Writes an object as a query string without its `?`, with objects as `key[child]`, arrays as
`key[index]` and a `Date` as its ISO string, skipping `null` and `undefined`. It stands in for
appending every bracket key by hand:

```typescript
let params = new URLSearchParams();
params.append("filter[status]", "open");
params.append("page", "2");
params.toString(); // what stringify({ filter: { status: "open" }, page: 2 }) returns
```

### `toFormData(value)`

Writes an object as `FormData` with the keys `stringify` writes, appending each `Blob` or `File`
as its own field so it keeps its name and type.

### `fieldName(path)`

Writes a path as its bracket field name, so `fieldName(["items", 0, "quantity"])` is
`"items[0][quantity]"`. It takes a schema issue's `path` as-is.

### Types

- `BracketParamsSource`: the sources `parse` reads.
- `ParseOptions`: the `depth` and `parameterLimit` options of `parse`.
- `TextValue`: a value the writers write as text: string, number, boolean, bigint, `Date`, `null` or `undefined`.
- `FormValue`: a `TextValue` or a `Blob`, which only `toFormData` accepts.
- `BracketInput<Value, Leaf>`: the nested shape of objects and arrays the writers accept.
- `PathSegment`: one segment of a `fieldName` path, a key or a schema issue's `{ key }`.

## Pattern: Filter Links That Keep The Current Query

Read the current filters, replace one, and write the link back. Every other part of the query
carries over.

```typescript
import { parse, stringify } from "@sdxc/bracket-params";
import { unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";

let Query = s.object({
	q: s.defaulted(s.string(), ""),
	filter: s.defaulted(s.object({ status: s.optional(s.string()) }), {}),
});

let current = unwrap(parse(new URL(request.url), Query));
let openHref = `?${stringify({ ...current, filter: { ...current.filter, status: "open" } })}`;
```

## Pattern: Show Each Issue On Its Input

A form names its inputs with `fieldName`, and the same function turns each issue's path back into
that name, so a refused submission can mark the exact input that failed.

```typescript
import { fieldName, parse } from "@sdxc/bracket-params";
import * as s from "remix/data-schema";
import { min } from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";

let Order = s.object({
	items: s.array(s.object({ sku: s.string(), quantity: coerce.number().pipe(min(1)) })),
});

// <input name={fieldName(["items", 0, "quantity"])} /> submits items[0][quantity]
let result = parse(await request.formData(), Order);

if (result.status === "failure") {
	let errors = new Map(
		result.error.issues.map((issue) => [fieldName(issue.path ?? []), issue.message]),
	);
	errors.get("items[0][quantity]"); // "Expected number greater than or equal to 1"
}
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written
`YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out
per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/bracket-params": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later
release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
