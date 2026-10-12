# @sdxc/microformats

Parse, read and write microformats2.

[Microformats2](https://microformats.org/wiki/microformats2-parsing) are class names on ordinary
HTML (`h-entry`, `p-name`, `u-in-reply-to`, `dt-published`, `e-content`) that a parser turns
into a JSON document of typed items. Webmention reads a linking page through that JSON, and
Micropub sends and answers with it. The package has three entry points:

- `@sdxc/microformats` parses HTML into canonical mf2 JSON, reads and writes that JSON, and
  validates a single item. Classic microformats (`hentry`, `vcard`, `hreview`, …) are read
  too, mapped onto their mf2 types.
- `@sdxc/microformats/vocabulary` gives typed views of `h-entry`, `h-card`, `h-feed` and
  `h-cite`, and the IndieWeb algorithms built on them: authorship, the representative `h-card`,
  Post Type Discovery, and which entry on a page responds to a URL.
- `@sdxc/microformats/ui` gives `remix/component` templates typed class names as a mixin, and a
  `<time>` component.

The parser is checked against the official
[microformats test suite](https://github.com/microformats/tests).

## Installation

```sh
npm add @sdxc/microformats
```

It installs [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) for fallible functions,
[`@sdxc/html`](https://www.npmjs.com/package/@sdxc/html) for the HTML tree, and
[`remix`](https://www.npmjs.com/package/remix) for `remix/data-schema` and `remix/component`.

## Usage

### Parse a page

```typescript
import { findItem, parse, values } from "@sdxc/microformats";
import { isFailure } from "@sdxc/result";

let response = await fetch("https://example.com/replies/1");
let result = parse(await response.text(), response.url);
if (isFailure(result)) throw result.error;

let document = result.data;
document.rels.me; // ["https://github.com/someone"]

let item = findItem(document, "h-entry");
if (item) values(item, "in-reply-to"); // ["https://example.org/articles/some-slug"]
```

Pass the URL the page was served from, after redirects: `u-*` values, implied `photo` and
`url`, `rel` links and the URLs inside `e-*` markup all resolve against it and the page's
`<base href>`.

### Read an entry

```typescript
import { findItem, parse } from "@sdxc/microformats";
import { authorOf, postType, readEntry } from "@sdxc/microformats/vocabulary";
import { unwrap } from "@sdxc/result";

let document = unwrap(parse(html, pageUrl));
let item = findItem(document, "h-entry");

if (item) {
	let entry = unwrap(readEntry(item));
	entry.inReplyTo[0]?.url; // "https://example.org/articles/some-slug"
	entry.published?.instant; // a Date, or null when the page named no instant
	postType(item); // "reply"
	authorOf(item, document, pageUrl); // a card, { url } to fetch next, or null
}
```

### Mark up a template

```tsx
import { css } from "remix/component";
import { mf, MicroTime } from "@sdxc/microformats/ui";

<article mix={[mf("h-entry"), css({ padding: 16 })]}>
	<h1 mix={[mf("p-name")]}>{post.title}</h1>
	<a href={post.url} mix={[mf("u-url", "u-uid")]}>
		<MicroTime property="dt-published" value={post.publishedAt}>
			{post.publishedLabel}
		</MicroTime>
	</a>
	<div mix={[mf("e-content")]}>{post.body}</div>
</article>;
```

## API

### `@sdxc/microformats`

#### `parse(source: string, baseUrl: string | URL, options?: MF2.ParseOptions): Result<MF2.Document, MicroformatsParseError>`

Parses a full page or a fragment into the canonical document, failing only for a source with no
markup at all. `options.backcompat` (default `true`) reads classic roots in subtrees that carry
no mf2 root.

#### `fromDocument(document: DOMDocument, baseUrl: string | URL, options?: MF2.ParseOptions): MF2.Document`

The same parse over a tree `parseDocument` from `@sdxc/html/document` already built, so one
tree serves every reader of the page.

#### `stringify(value: MF2.Document | MF2.Item): string`

Writes canonical JSON text. A document's `relUrls` is written as `rel-urls`; an item is written
as it is, which is Micropub's `q=source` answer.

#### `parseJSON(text: string): Result<MF2.Document, MicroformatsShapeError>`

Reads canonical JSON text back into a document; `rels` and `rel-urls` may be absent and read as
empty.

#### `ITEM_SCHEMA: Schema<unknown, MF2.Item>`

A `remix/data-schema` schema for one mf2 item already decoded from JSON, such as a Micropub JSON
create body. Its output is canonical: `{ html }` content gains the `value` its markup reads as,
and a nested item without a `value` takes its first `name`, then its first `url`.

#### `findItem(document: MF2.Document | MF2.Item[], type: string): MF2.Item | null`

The first item whose type includes `type`, depth-first: each item, then the items in its
properties, then its `children`.

#### `values(item: MF2.Item, property: string): string[]`

Every value of a property as a string: a nested item's `value`, a URL's `value`, an embedded
value's text. A missing property is `[]`.

#### `MicroformatsParseError`, `MicroformatsShapeError`

The failure of `parse`, and the failure of `parseJSON` and the vocabulary readers.
`MicroformatsShapeError.issues` holds the Standard Schema issues, empty for text that is not
JSON.

#### `MF2` namespace

`Document` (`items`, `rels`, `relUrls`), `Item` (`type`, `properties`, `id?`, `lang?`,
`children?`), `NestedItem` (an item inside a property, with its `value` and, under `e-*`, its
`html`), `Url` (`{ value, alt }` for an image with alternative text), `Embedded`
(`{ html, value, lang? }`), `PropertyValue` (the union of `string` and those three), `RelUrl` and
`ParseOptions`. `dt-*` values are strings in the specification's normalized form.

### `@sdxc/microformats/vocabulary`

#### `readEntry(item)`, `readCard(item)`, `readFeed(item)`

Typed views (`Vocabulary.Entry`, `Card`, `Feed`) answering a `Result`, failing with a
`MicroformatsShapeError` when the item is of another type. A response property holding a
nested `h-cite` or a bare URL both become a `Vocabulary.Cite`; a feed's entries are its
`h-entry` children.

#### `readItem(item: MF2.Item, schema: StandardSchemaV1): Result<Output, MicroformatsShapeError>`

Reads any vocabulary through a synchronous Standard Schema, which receives the item's
properties with each one-element array replaced by its element.

#### `authorOf(entry: MF2.Item, document: MF2.Document, pageUrl: string): Vocabulary.Card | { url: string } | null`

The [authorship algorithm](https://indieweb.org/authorship-spec): the entry's `author`, then
that of the `h-feed` holding it, then `rel=author` when the page is the entry's permalink.
`{ url }` means authorship continues at another page.

#### `representativeCard(document: MF2.Document, pageUrl: string): Vocabulary.Card | null`

The [representative h-card](https://microformats.org/wiki/representative-h-card-parsing): the
card whose `uid` and a `url` are the page, else the card with a `url` the page links with
`rel=me`, else the page's only card when one of its `url`s is the page.

#### `postType(entry: MF2.Item): Vocabulary.PostType`

[Post Type Discovery](https://www.w3.org/TR/post-type-discovery/): `rsvp`, `repost`, `like`,
`reply`, `bookmark`, `video`, `photo`, then `article` when the content does not start with the
name, else `note`.

#### `responseTo(document: MF2.Document, target: string): { entry: MF2.Item; type } | null`

The entry responding to `target` and how: `repost`, `like`, `reply` or `bookmark` by property,
else `mention` when it links to the target anywhere. URLs compare after normalization.

#### `Vocabulary` namespace

`Entry`, `Card`, `Feed`, `Cite`, `PostType`, and `DateTime` (`{ value, instant }`, where
`instant` is a `Date` when the value names one and `null` for a date alone or a time without a
timezone).

### `@sdxc/microformats/ui`

#### `mf(...names: MF2UI.ClassName[]): MixinDescriptor`

A mixin appending class tokens to its host's `className`, after whatever `css()` or the host
put there. It reaches through components that forward `mix`.

#### `classes(...names: MF2UI.ClassName[]): string`

The same tokens as a `class` string, each once.

#### `MicroTime`

`<MicroTime property="dt-published" value={date}>{label}</MicroTime>` renders a `<time>` with
the class and an ISO `datetime`; the visible text is the children, or the ISO string without
them.

#### `MF2UI` namespace

`ClassName` is `Root | Property`: the `h-entry`, `h-card`, `h-feed`, `h-cite`, `h-event` and
`h-adr` roots, the common `h-entry` and `h-card` properties under the prefix the vocabulary
gives them (`u-in-reply-to`, never `p-in-reply-to`), and the `-x-` vendor escape (`h-x-thing`,
`p-x-mood`). Any other name, a classic `hentry` included, is a type error.

## Pattern: Label A Webmention

A Webmention receiver fetches the source once, checks it links to the target, and reads how it
responds and who wrote it.

```typescript
import { parseDocument } from "@sdxc/html/document";
import { fromDocument } from "@sdxc/microformats";
import { authorOf, readEntry, responseTo } from "@sdxc/microformats/vocabulary";
import { isFailure, unwrap } from "@sdxc/result";

async function label(sourceUrl: string, targetUrl: string) {
	let page = await fetch(sourceUrl);
	let tree = parseDocument(await page.text());
	if (isFailure(tree)) return null;

	let document = fromDocument(tree.data, page.url);
	let response = responseTo(document, targetUrl);
	if (!response) return null;

	let entry = unwrap(readEntry(response.entry));
	let author = authorOf(response.entry, document, page.url);
	return { type: response.type, content: entry.content, author };
}
```

`e-*` markup comes back as its author wrote it, so pass `entry.content.html` through
`HTML.sanitize` from [`@sdxc/html`](https://www.npmjs.com/package/@sdxc/html) before rendering
it.

## Pattern: Answer Micropub With The Same Shape

Micropub's JSON create body is an mf2 item, and its `q=source` answer is the stored item
written back.

```typescript
import { ITEM_SCHEMA, stringify } from "@sdxc/microformats";
import type { MF2 } from "@sdxc/microformats";
import { postType } from "@sdxc/microformats/vocabulary";
import { parseSafe } from "remix/data-schema";

async function create(request: Request) {
	let result = parseSafe(ITEM_SCHEMA, await request.json());
	if (!result.success) return Response.json({ error: "invalid_request" }, { status: 400 });

	let type = postType(result.value); // "note", "article", "bookmark", …
	let url = await savePost(type, result.value);
	return new Response(null, { status: 201, headers: { Location: url } });
}

function source(item: MF2.Item) {
	return new Response(stringify(item), { headers: { "Content-Type": "application/json" } });
}
```

## Pattern: Find Who A Site Belongs To

The representative `h-card` of a home page identifies its owner, for an IndieAuth profile or a
mention's author.

```typescript
import { parse } from "@sdxc/microformats";
import { representativeCard } from "@sdxc/microformats/vocabulary";
import { unwrap } from "@sdxc/result";

let response = await fetch("https://example.com/");
let document = unwrap(parse(await response.text(), response.url));

let card = representativeCard(document, response.url);
card?.name; // "Someone"
card?.photo?.value; // "https://example.com/avatar.jpg"
```

## Pattern: Read A Feed

An `h-feed` lists its posts as `h-entry` children; entries without their own author take the
feed's.

```typescript
import { findItem, parse } from "@sdxc/microformats";
import { authorOf, readFeed } from "@sdxc/microformats/vocabulary";
import { unwrap } from "@sdxc/result";

let response = await fetch("https://example.com/notes");
let document = unwrap(parse(await response.text(), response.url));

let item = findItem(document, "h-feed");
let feed = item ? unwrap(readFeed(item)) : null;
feed?.entries.map((entry) => entry.url); // each post's permalink, in page order

let posts = (item?.children ?? []).filter((child) => child.type.includes("h-entry"));
let authors = posts.map((post) => authorOf(post, document, response.url)); // the feed's author fills in
```

## Pattern: Read A Vocabulary Of Your Own

`readItem` reads any vocabulary, such as `h-recipe` or a vendor `h-x-*` type, through a
`remix/data-schema` schema; single values arrive unwrapped.

```typescript
import { findItem, parse } from "@sdxc/microformats";
import { readItem } from "@sdxc/microformats/vocabulary";
import { isFailure, unwrap } from "@sdxc/result";
import { object, string } from "remix/data-schema";

let RECIPE = object({ name: string(), yield: string().transform(Number) });

let document = unwrap(parse(html, pageUrl));
let item = findItem(document, "h-recipe");
let recipe = item ? readItem(item, RECIPE) : null;
if (recipe && isFailure(recipe)) console.error(recipe.error.issues);
```

## Pattern: Store And Reload A Parsed Page

The canonical JSON round-trips, so a parsed page can be cached and read back without parsing
the HTML again.

```typescript
import { parse, parseJSON, stringify } from "@sdxc/microformats";
import { unwrap } from "@sdxc/result";

let document = unwrap(parse(html, pageUrl, { backcompat: false }));
let text = stringify(document); // { "items": …, "rels": …, "rel-urls": … }

let reloaded = unwrap(parseJSON(text));
reloaded.relUrls; // the same rel-urls, under its camelCase name
```

## Pattern: Verify A Template With The Parser

A test renders a page and reads it back the way a consumer will, so a missing class shows up
as a failed expectation.

```typescript
import { findItem, parse } from "@sdxc/microformats";
import { readEntry } from "@sdxc/microformats/vocabulary";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

test("an article page is an h-entry", async () => {
	let response = await handler(new Request("https://example.com/articles/hello"));
	let document = unwrap(parse(await response.text(), response.url));

	let item = findItem(document, "h-entry");
	if (!item) throw new Error("Expected an h-entry");
	expect(unwrap(readEntry(item)).author?.name).toBe("Someone");
});
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
		"@sdxc/microformats": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
