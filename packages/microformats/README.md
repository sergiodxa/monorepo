# @sdxc/microformats

Parse, read and write microformats2.

## Installation

```bash
npm add @sdxc/microformats
```

Fallible functions return [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values;
it installs alongside this package, as do [`@sdxc/html`](https://www.npmjs.com/package/@sdxc/html),
which builds the tree the parser walks, and [`remix`](https://www.npmjs.com/package/remix), whose
`remix/data-schema` validates items and whose `remix/component` renders the `./ui` helpers.

[Microformats2](https://microformats.org/wiki/microformats2-parsing) is the vocabulary the
IndieWeb reads a page through: class names on ordinary HTML (`h-entry`, `p-name`,
`u-in-reply-to`, `dt-published`, `e-content`) that a parser turns into a JSON document of typed
items. Webmention reads a linking page's microformats to show a mention as a reply, a like or a
repost; Micropub's JSON request body and its `q=source` answer are the same JSON.

- **`@sdxc/microformats`** parses HTML into canonical mf2 JSON, reads and writes that JSON, and
  validates a single item with a `remix/data-schema` schema. Classic microformats (`hentry`,
  `vcard`, `hreview`, …) are read too, mapped onto their mf2 types.
- **`@sdxc/microformats/vocabulary`** gives typed views of `h-entry`, `h-card`, `h-feed` and
  `h-cite`, and the IndieWeb living algorithms built on them: authorship, the representative
  `h-card`, Post Type Discovery, and which entry on a page responds to a URL.
- **`@sdxc/microformats/ui`** gives `remix/component` templates typed class names, as a mixin that sits
  in `mix` beside `css()`, and a `<time>` component.

The parser runs the official [microformats test suite](https://github.com/microformats/tests)
fixture by fixture. It departs from the suite on a handful of markup that the underlying DOM
reads differently from an HTML5 parser, on the classic include pattern, and in two places where
the suite contradicts itself.

## Usage

### Parse A Page

```typescript
import { findItem, parse } from "@sdxc/microformats";
import { isFailure } from "@sdxc/result";

let response = await fetch("https://ada.example.com/replies/1");
let result = parse(await response.text(), response.url);
if (isFailure(result)) throw result.error;

let document = result.data;
document.rels.me; // ["https://github.com/ada"]
findItem(document, "h-entry")?.properties["in-reply-to"]; // ["https://example.com/articles/some-slug"]
```

The base URL is required: `u-*` values, implied `photo` and `url`, `rel` links and the URLs
inside `e-*` markup all resolve against it (and against `<base href>`, when the page has one).

### Read An Entry

```typescript
import { findItem } from "@sdxc/microformats";
import { authorOf, postType, readEntry } from "@sdxc/microformats/vocabulary";
import { unwrap } from "@sdxc/result";

let item = findItem(document, "h-entry");
if (!item) return;

let entry = unwrap(readEntry(item));
entry.inReplyTo[0]?.url; // "https://example.com/articles/some-slug"
entry.published?.instant; // Date, or null when the page named no instant
postType(item); // "reply"
authorOf(item, document, response.url); // a card, { url } to fetch, or null
```

### Mark Up A Template

```tsx
import { mf, MicroTime } from "@sdxc/microformats/ui";

<article mix={[mf("h-entry"), css({ padding: 16 })]}>
	<h1 mix={[mf("p-name")]}>{post.title}</h1>
	<Link href={post.url} mix={[mf("u-url", "u-uid")]}>
		<MicroTime property="dt-published" value={post.publishedAt}>
			{post.publishedLabel}
		</MicroTime>
	</Link>
	<div mix={[mf("e-content")]}>{post.body}</div>
</article>;
```

## API

### `@sdxc/microformats`

#### `parse(source: string, baseUrl: string | URL, options?: MF2.ParseOptions): Result<MF2.Document, MicroformatsParseError>`

Parses markup, a full page or a fragment, into the canonical document. Fails only for a
source with no markup at all. `options.backcompat` (default `true`) controls whether classic
roots are read where a subtree carries no mf2 root.

#### `fromDocument(document: DOMDocument, baseUrl: string | URL, options?: MF2.ParseOptions): MF2.Document`

The same parse over a tree `parseDocument` from
[`@sdxc/html/document`](https://www.npmjs.com/package/@sdxc/html) already built, so one tree
serves a link check and the microformats read alike.

#### `stringify(value: MF2.Document | MF2.Item): string`

Writes canonical JSON text. A document's `relUrls` is written under its wire name
`rel-urls`; an item is written as it is, which is Micropub's `q=source` answer.

#### `parseJSON(text: string): Result<MF2.Document, MicroformatsShapeError>`

Reads canonical JSON text back into a document; `rels` and `rel-urls` may be absent. The
error carries the data-schema `issues` (none when the text is not JSON at all).

#### `ITEM_SCHEMA: Schema<unknown, MF2.Item>`

Validates one mf2 item already decoded from JSON, which is a Micropub JSON create body. The
output is always canonical: `{ html }` content gains the `value` its markup reads as, and a
nested item written without a `value` takes its first `name`, then its first `url`.

```typescript
import { ITEM_SCHEMA } from "@sdxc/microformats";
import { parseSafe } from "remix/data-schema";

let result = parseSafe(ITEM_SCHEMA, await request.json());
```

#### `findItem(document: MF2.Document | MF2.Item[], type: string): MF2.Item | null`

The first item whose type includes `type`, depth-first: each item, then the items in its
properties, then its `children`.

#### `values(item: MF2.Item, property: string): string[]`

Every value of a property as a string: a nested item's `value`, a URL's `value`, an
embedded value's text. A missing property is `[]`.

#### `MicroformatsParseError`, `MicroformatsShapeError`

The failures of `parse` and of `parseJSON` and the vocabulary readers.
`MicroformatsShapeError.issues` holds the Standard Schema issues.

#### `MF2` namespace

`Document` (`items`, `rels`, `relUrls`), `Item` (`type`, `properties`, `id?`, `lang?`,
`children?`), `NestedItem` (an item in a property, with its `value` and, for `e-*`, its
`html`), `Url` (`{ value, alt }` for an image with alternative text), `Embedded`
(`{ html, value, lang? }`), `PropertyValue` (the union of the four), `RelUrl` and
`ParseOptions`. `dt-*` values stay strings in the specification's normalized form; the
vocabulary's `DateTime.instant` converts where the page named an instant.

### `@sdxc/microformats/vocabulary`

#### `readEntry(item)`, `readCard(item)`, `readFeed(item)`

Typed views (`Vocabulary.Entry`, `Card`, `Feed`), failing with a `MicroformatsShapeError`
when the item is not of that type. A response property holding a nested `h-cite` or a bare
URL both become a `Vocabulary.Cite`; an author that is a URL becomes a card with only `url`.
A feed's entries are its `h-entry` children.

#### `readItem(item, schema)`

Reads any vocabulary through a synchronous Standard Schema, which receives the item's
properties with each one-element array replaced by its element.

#### `authorOf(entry, document, pageUrl): Vocabulary.Card | { url: string } | null`

The [authorship algorithm](https://indieweb.org/authorship-spec): the entry's `author`,
then that of the `h-feed` holding it, then `rel=author` when the page is the entry's
permalink. `{ url }` means authorship ends at another page, which the caller may fetch.

#### `representativeCard(document, pageUrl): Vocabulary.Card | null`

The [representative h-card](https://microformats.org/wiki/representative-h-card-parsing):
the card whose `uid` and a `url` are the page, else the card with a `url` the page links
with `rel=me`, else the only card on the page when one of its `url`s is the page.

#### `postType(entry): Vocabulary.PostType`

[Post Type Discovery](https://www.w3.org/TR/post-type-discovery/): `rsvp`, `repost`,
`like`, `reply`, `bookmark`, `video`, `photo`, then `article` when the name is not a prefix
of the content, else `note`.

#### `responseTo(document, target)`

The entry that responds to `target` and how: `repost`, `like`, `reply` or `bookmark` by
property, or `mention` when it links to the target anywhere else (a property value or a link
in its markup). URLs compare after normalization.

### `@sdxc/microformats/ui`

#### `mf(...names: MF2UI.ClassName[]): MixinDescriptor`

A mixin appending microformats class tokens to its host's `className`, after whatever a
`css()` mixin or the host put there. It reaches through components that forward `mix`.

#### `classes(...names: MF2UI.ClassName[]): string`

The same tokens as a `class` string, each once.

#### `MicroTime`

`<MicroTime property="dt-published" value={date}>{label}</MicroTime>` renders
`<time class="dt-published" datetime="2026-09-23T13:15:00.000Z">`, the visible text being
the children, or the ISO string without them.

#### `MF2UI` namespace

`ClassName` is `Root | Property`: the `h-entry`, `h-card`, `h-feed`, `h-cite`, `h-event` and
`h-adr` roots, their properties with the prefix the vocabulary gives them (`u-in-reply-to`,
never `p-in-reply-to`), and the specification's `-x-` vendor escape (`h-x-thing`,
`p-x-mood`). Anything else, a classic `hentry` included, is a type error.

## Pattern: Label A Webmention From One Fetch

```typescript
import { parseDocument } from "@sdxc/html/document";
import { fromDocument } from "@sdxc/microformats";
import { authorOf, readEntry, responseTo } from "@sdxc/microformats/vocabulary";
import { isFailure } from "@sdxc/result";

let tree = parseDocument(sourceHtml);
if (isFailure(tree)) return reject();

let document = fromDocument(tree.data, sourceUrl);
let response = responseTo(document, targetUrl);
if (!response) return reject(); // the source never links to the target

let entry = readEntry(response.entry);
let author = authorOf(response.entry, document, sourceUrl);
```

`e-*` markup comes back as authored, URLs resolved: it is somebody else's markup, so send it
through `HTML.sanitize` from [`@sdxc/html`](https://www.npmjs.com/package/@sdxc/html) before
rendering it. `authorOf` returning `{ url }` means another fetch; bound it the way you bound the
first.

## Pattern: Answer Micropub With The Same Shape

```typescript
import { ITEM_SCHEMA, stringify } from "@sdxc/microformats";
import { postType } from "@sdxc/microformats/vocabulary";
import { parseSafe } from "remix/data-schema";

let result = parseSafe(ITEM_SCHEMA, await request.json());
if (!result.success) return Response.json({ error: "invalid_request" }, { status: 400 });

let type = postType(result.value); // "note", "article", "bookmark", …

// later, for q=source:
return new Response(stringify(storedItem), { headers: { "Content-Type": "application/json" } });
```

## Pattern: Verify A Template With The Parser

Pass the URL the page was served from, after redirects (`response.url`), so relative URLs
resolve where a browser would resolve them.

```typescript
import { findItem, parse } from "@sdxc/microformats";
import { readEntry } from "@sdxc/microformats/vocabulary";
import { unwrap } from "@sdxc/result";

let response = await handler(new Request("https://example.com/articles/hello"));
let document = unwrap(parse(await response.text(), response.url));
let entry = unwrap(readEntry(findItem(document, "h-entry")!));
expect(entry.author?.name).toBe("Ada Lovelace");
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
