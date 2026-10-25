# @sdxc/jsonpath

RFC 9535 JSONPath queries over JSON values, with normalized paths and every function extension.

[JSONPath](https://www.rfc-editor.org/rfc/rfc9535) selects nodes from a JSON value with
expressions like `$.store.book[?@.price < 10].title`. This package implements the whole standard:
name, wildcard, index, slice and filter selectors; child and descendant segments; comparisons and
logical operators; and the `length`, `count`, `match`, `search` and `value` functions, with
`match` and `search` reading [I-Regexp](https://www.rfc-editor.org/rfc/rfc9485) patterns. It passes
the official JSONPath compliance test suite.

## Installation

```sh
npm add @sdxc/jsonpath
```

Fallible calls return [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values.

## Usage

### Run a query once

```typescript
import { query } from "@sdxc/jsonpath";

query({ users: [{ name: "Ada", admin: true }, { name: "Alan" }] }, "$.users[?@.admin].name");
// success([{ value: "Ada", location: ["users", 0, "name"], path: "$['users'][0]['name']" }])
```

### Parse once, select many times

```typescript
import { JSONPath } from "@sdxc/jsonpath";
import { unwrap } from "@sdxc/result";

let cheap = unwrap(JSONPath.parse("$..book[?@.price < 10].title"));

cheap.values(store); // ["Sayings of the Century", "Moby Dick"]
cheap.values(otherStore);
```

### Functions

```typescript
import { JSONPath } from "@sdxc/jsonpath";
import { unwrap } from "@sdxc/result";

unwrap(JSONPath.parse("$.books[?length(@.title) > 15]"));
unwrap(JSONPath.parse("$.books[?count(@.authors[*]) >= 2]"));
unwrap(JSONPath.parse("$.users[?match(@.email, '[a-z]+@example\\.com')]"));
unwrap(JSONPath.parse("$.books[?search(@.title, 'Rings')]"));
unwrap(JSONPath.parse("$.groups[?value(@..id) == 7]"));
```

In `match` and `search` patterns, `.` matches anything but a line break, and `^` and `$` anchor as
the compliance suite expects. A pattern that is not an I-Regexp makes the function false.

## API

### `JSONPath.parse(source: string): Result<JSONPath, JsonPathSyntaxError>`

Parses a query, refusing everything RFC 9535 refuses: invalid syntax, whitespace before or after
the query, an index outside ±(2^53 − 1), an unknown function, and a function argument of the wrong
type, such as `length(@.*)` or comparing a query that can select several nodes.

### `jsonPath.select(document: JSONValue): JsonPathNode[]`

The selected nodes, in the order RFC 9535 defines. Object members are visited in the order the
object holds them.

### `jsonPath.values(document: JSONValue): JSONValue[]`

The selected values alone.

### `jsonPath.source`

The query text.

### `query(document: JSONValue, source: string): Result<JsonPathNode[], JsonPathSyntaxError>`

`JSONPath.parse` and `select` in one call.

### `normalizedPath(location: readonly (string | number)[]): string`

The normalized path of a location, the canonical query for one node: `["a", 0]` becomes
`$['a'][0]`, with `'`, `\` and control characters escaped.

### `JsonPathSyntaxError`

The parse failure; `offset` is where in the query the problem was found.

### Types

#### `JsonPathNode`

`{ value, location, path }`: the selected value, its member names and indexes from the root, and
its normalized path.

#### `JSONValue`

The JSON values a query reads.

## Pattern: Patch Every Matching Node

`location` is the node's path as segments, which
[`@sdxc/json-pointer`](https://www.npmjs.com/package/@sdxc/json-pointer) turns into the pointers
[`@sdxc/json-patch`](https://www.npmjs.com/package/@sdxc/json-patch) operations aim at.

```typescript
import { apply } from "@sdxc/json-patch";
import { stringify } from "@sdxc/json-pointer";
import { JSONPath } from "@sdxc/jsonpath";
import { unwrap } from "@sdxc/result";

let overdue = unwrap(JSONPath.parse("$.invoices[?@.due < '2026-01-01' && !@.paid].status"));

let patch = overdue.select(ledger).map((node) => ({
	op: "replace" as const,
	path: stringify(node.location),
	value: "overdue",
}));

let next = apply(ledger, patch);
```

## Pattern: Let Clients Filter A Collection

A query string carries a JSONPath filter; the handler parses it once and answers `400` with the
offset when it is invalid.

```typescript
import { JSONPath } from "@sdxc/jsonpath";
import { isFailure } from "@sdxc/result";

async function listOrders(request: Request) {
	let filter = new URL(request.url).searchParams.get("filter") ?? "$[*]";
	let parsed = JSONPath.parse(filter);
	if (isFailure(parsed)) {
		return Response.json(
			{ error: parsed.error.message, offset: parsed.error.offset },
			{ status: 400 },
		);
	}
	return Response.json(parsed.data.values(await orders.all()));
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
		"@sdxc/jsonpath": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
