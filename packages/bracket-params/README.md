# @sdxc/bracket-params

Read and write nested query strings and form data with bracket syntax, validated by a Standard
Schema.

[`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) and
[`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData) map a name to flat
values. This package reads bracket keys such as `filter[status]=open` and `items[0][quantity]=2`
into nested objects and arrays, validates them with your schema in the same call, and writes a
nested value back in the same syntax.

## Installation

```sh
npm add @sdxc/bracket-params
```

Schemas come from any [Standard Schema](https://standardschema.dev) library, such as
`remix/data-schema` from [`remix`](https://www.npmjs.com/package/remix). `parse` answers a
`Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result).

## Usage

### Read a query string

```typescript
import { parse } from "@sdxc/bracket-params";
import * as s from "remix/data-schema";

parse("?tags[]=a&tags[]=b", s.object({ tags: s.array(s.string()) }));
// { status: "success", data: { tags: ["a", "b"] } }
```

### Read a request

A `URL` is read through its query and `FormData` keeps its files. Values arrive as strings, so
coerce numbers and booleans in the schema.

```typescript
import { parse } from "@sdxc/bracket-params";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

let Filters = s.object({
	filter: s.object({ status: s.string(), tags: s.array(s.string()) }),
	page: coerce.number(),
});

// /tasks?filter[status]=open&filter[tags][]=a&page=2
let filters = parse(new URL(request.url), Filters);
if (isFailure(filters)) return Response.json(filters.error.issues, { status: 400 });
filters.data; // { filter: { status: "open", tags: ["a"] }, page: 2 }

let Post = s.object({
	post: s.object({ title: s.string(), photos: s.array(s.instanceof_(File)) }),
});

// post[title]=Hi, post[photos][]=<file>, post[photos][]=<file>
let post = parse(await request.formData(), Post);
```

### Write a value back

```typescript
import { fieldName, stringify, toFormData } from "@sdxc/bracket-params";

stringify({ filter: { status: "open" }, page: 2 }); // "filter%5Bstatus%5D=open&page=2"
toFormData({ post: { title: "Hi", photos: [file] } }); // post[title], post[photos][0]
fieldName(["items", 0, "quantity"]); // "items[0][quantity]"
```

## API

### `parse(source, schema, options?)`

Reads a query string (with or without its `?`), `URLSearchParams`, `URL`,
[`@sdxc/location`](https://www.npmjs.com/package/@sdxc/location) `Location` or `FormData` into
nested values and validates them with a synchronous schema. It answers a `Result` with the
schema's output, or a [`@sdxc/validate`](https://www.npmjs.com/package/@sdxc/validate)
`ValidationError` whose `issues` carry each path.

| Source          | Value                       |
| --------------- | --------------------------- |
| `a=1&a=2`       | `{ a: ["1", "2"] }`         |
| `a[b][c]=1`     | `{ a: { b: { c: "1" } } }`  |
| `a[]=1&a[]=2`   | `{ a: ["1", "2"] }`         |
| `a[1]=y&a[0]=x` | `{ a: ["x", "y"] }`         |
| `a[0][b]=1`     | `{ a: [{ b: "1" }] }`       |
| `a[0]=x&a[k]=y` | `{ a: { 0: "x", k: "y" } }` |
| `a[b=1`         | `{ "a[b": "1" }`            |

A key used both as a value and as a group (`a=1&a[b]=2`) fails the parse, and a key with a
`__proto__` segment is skipped.

- `options.depth`: bracket segments one key may nest before the parse fails. Default `5`.
- `options.parameterLimit`: entries one source may carry before the parse fails. Default `1000`.

### `stringify(value)`

Writes an object as a query string without its `?`: objects as `key[child]`, arrays as
`key[index]`, a `Date` as its ISO string, and `null` or `undefined` as nothing. It stands in for
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

Writes a path as its bracket field name, the one `parse` reads back into that path. It takes a
schema issue's `path` as-is, and answers `""` for an empty path.

### Types

- `BracketParamsSource`: the sources `parse` reads.
- `ParseOptions`: the `depth` and `parameterLimit` options of `parse`.
- `TextValue`: a value the writers write as text: string, number, boolean, bigint, `Date`, `null`
  or `undefined`.
- `FormValue`: a `TextValue` or a `Blob`, which only `toFormData` accepts.
- `BracketInput<Value, Leaf>`: the nested objects and arrays of `Leaf` values the writers accept.
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

Name each input with `fieldName`, and turn each issue's path back into the same name, so a
refused submission marks the exact input that failed.

```typescript
import { fieldName, parse } from "@sdxc/bracket-params";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import { min } from "remix/data-schema/checks";
import * as coerce from "remix/data-schema/coerce";

let Order = s.object({
	items: s.array(s.object({ sku: s.string(), quantity: coerce.number().pipe(min(1)) })),
});

// <input name={fieldName(["items", 0, "quantity"])} /> submits items[0][quantity]
let result = parse(await request.formData(), Order);

if (isFailure(result)) {
	let errors = new Map(
		result.error.issues.map((issue) => [fieldName(issue.path ?? []), issue.message]),
	);
	errors.get("items[0][quantity]"); // the message for that input
}
```

## Pattern: Send Nested Data And Files In One Request

Build the body with `toFormData` on the sending side and read it with `parse` on the receiving
side; the nesting and the files arrive as they were written.

```typescript
import { parse, toFormData } from "@sdxc/bracket-params";
import * as s from "remix/data-schema";
import * as coerce from "remix/data-schema/coerce";

await fetch("/posts", {
	method: "POST",
	body: toFormData({
		post: { title: "Hi", publishedAt: new Date(), tags: ["news", "release"] },
		photos: [new File(["..."], "cover.png", { type: "image/png" })],
	}),
});

let Post = s.object({
	post: s.object({ title: s.string(), publishedAt: coerce.date(), tags: s.array(s.string()) }),
	photos: s.array(s.instanceof_(File)),
});

let post = parse(await request.formData(), Post, { parameterLimit: 100 });
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
