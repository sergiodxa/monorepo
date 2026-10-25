# @sdxc/link-header

Parse and stringify RFC 8288 `Link` headers and RFC 9264 link sets.

A [`Link`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Link) value is a
list of URI-References with relation types and parameters. Splitting on commas is wrong: a
target can contain a comma and a parameter value can be quoted, so this package scans angle
brackets and quoted strings instead. Malformed entries are dropped so a merge into a response
already under construction cannot fail on one bad link.

## Installation

```sh
npm add @sdxc/link-header
```

## Usage

### Parse a header

```typescript
import { parse } from "@sdxc/link-header";

let links = parse('</a,b.css>; rel="preload"; as="style", </items?page=2>; rel="next"');

links[0]?.target; // "/a,b.css"
links[0]?.rels; // ["preload"]
links[0]?.params; // { as: "style" }

links.find((link) => link.rels.includes("next"))?.target; // "/items?page=2"
```

`parse(null)` is `[]`. A `type` parameter lands in `params.type`, which is how a feed reader
learns the advertised media type.

### Write a header

```typescript
import { serializeLink, stringify } from "@sdxc/link-header";

stringify([
	serializeLink("https://api.example.com/items?page=2", "next"),
	serializeLink("/feed.xml", "self", { type: "application/atom+xml" }),
]);
// <https://api.example.com/items?page=2>; rel="next", </feed.xml>; rel="self"; type="application/atom+xml"
```

`stringify([])` is `null`, so the caller deletes the header instead of writing an empty one.

### Merge without dropping foreign links

```typescript
import { parse, serializeLink, stringify } from "@sdxc/link-header";

let kept = parse(headers.get("Link"))
	.filter((link) => !link.rels.includes("next"))
	.map((link) => link.raw);

let value = stringify([...kept, serializeLink(nextUrl, "next")]);
if (value === null) headers.delete("Link");
else headers.set("Link", value);
```

`raw` is the exact source text, so parameters this caller did not read still round-trip.

### Read and write a link set

`@sdxc/link-header/linkset` reads and writes [RFC 9264](https://www.rfc-editor.org/rfc/rfc9264)
link sets in both forms, `application/linkset` (the `Link` grammar, one link per line) and
`application/linkset+json`, through one flat list of links, so a header converts to either.

```typescript
import { parse, parseJson, stringifyJson, toHeader } from "@sdxc/link-header/linkset";

let links = parse(response.headers.get("Link"), { context: response.url });
let json = stringifyJson(links); // {"linkset":[{"anchor":"https://example.org/","next":[…]}]}

let result = parseJson(await linksetResponse.text());
if (result.status === "success") headers.set("Link", toHeader(result.data) ?? "");
```

`context` fills a missing `anchor` and resolves relative references, which RFC 9264 recommends
so a set keeps its meaning outside the response. `title*` and every other RFC 8187 attribute
decode into `internationalized`, and other attributes land in `extensions` as arrays.
`parseJson` answers a `LinksetParseError` listing every member that breaks the RFC, each at a
JSON Pointer.

## API

### `parse(header: string | null): Link[]`

Splits a `Link` header into entries in source order, per
[RFC 8288](https://www.rfc-editor.org/rfc/rfc8288). A `null` or empty header answers `[]`. An
entry with no URI-Reference is skipped. The call never throws.

### `stringify(links: readonly Link[] | readonly string[]): string | null`

Joins link-value texts, or the `raw` of parsed entries, into one header value. An empty list
answers `null`.

### `serializeLink(target: string, rel: string, params?: Record<string, string>): string`

Renders one link-value with a quoted `rel` and any extra parameters after it. Values are quoted
so a comma inside one cannot split the header.

### `@sdxc/link-header/linkset`

`parse(text, options?)` reads the text form or a `Link` header, `stringify(links)` writes the
text form, `toHeader(links)` writes one header line (`null` when empty), `parseJson(text)` and
`stringifyJson(links)` read and write the JSON form. `MEDIA_TYPE` and `JSON_MEDIA_TYPE` name both.

### Types

#### `Link`

A parsed `link-value`. `target` is the URI-Reference with angle brackets stripped. `rels` is the
first `rel` parameter, lowercased and split on whitespace. `params` is every other named
parameter, first of each name, unquoted. `raw` is the exact source text for a round-trip merge.

## Pattern: Follow Next Links As A Client

Walk a paginated API until `rel="next"` runs out.

```typescript
import { parse } from "@sdxc/link-header";

export async function fetchAll<T>(start: string): Promise<T[]> {
	let items: T[] = [];
	let next: string | null = start;

	while (next !== null) {
		let response = await fetch(next);
		items.push(...((await response.json()) as T[]));

		let links = parse(response.headers.get("Link"));
		next = links.find((link) => link.rels.includes("next"))?.target ?? null;
	}

	return items;
}
```

Relative targets stay relative; resolve them with `new URL(target, response.url)` when the
resource was fetched.

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
		"@sdxc/link-header": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
