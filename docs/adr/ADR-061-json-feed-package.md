# ADR-061: JSON Feed Package

## Status

**Accepted** - 2026-09-15

## Background

`@sdxc/feed` reads whatever a person subscribes to, over `@sdxc/rss` and `@sdxc/atom`.
Both are XML. [JSON Feed](https://www.jsonfeed.org) is the third format a reader meets
in the wild: Daring Fireball, Micro.blog, inessential and a long tail of static-site
generators publish one, usually at `/feed.json`, alongside or instead of their XML feed.

A reader handed `example.com/feed.json` today gets a format error, because the façade
hands every document to the XML parser.

## Context

### JSON Feed is a different format, not a serialization of the others

| Concern       | RSS 2.0 / Atom 1.0             | JSON Feed 1.1                              |
| ------------- | ------------------------------ | ------------------------------------------ |
| Syntax        | XML                            | JSON                                       |
| Recognized by | root element                   | a `version` URL inside the document        |
| Item identity | `guid` / `id`, optional in RSS | `id`, and an item without one is discarded |
| Body          | HTML, escaped into an element  | `content_html` **or** `content_text`       |
| Extensions    | namespaced elements            | keys beginning with `_`                    |
| Authors       | mailbox / person construct     | `authors`, with `name`, `url` and `avatar` |
| Feed date     | `lastBuildDate` / `updated`    | none                                       |

Two of those reach the façade rather than staying inside a parser: a plain-text body has
nowhere to go in a shape whose only body field holds HTML, and a format with no
feed-level date has to get its `updatedAt` from somewhere.

### The version URL is the only evidence

A root element identifies an XML feed. JSON has no equivalent, and the media type is not
evidence — publishers serve feeds as `application/json`, and plenty of JSON that is not a
feed is served the same way. The `version` URL (`https://jsonfeed.org/version/…`) inside
the document is what the format offers, so recognizing a feed means reading it.

## Decision

Add `@sdxc/json-feed`, a sibling of `@sdxc/rss` and `@sdxc/atom`, and teach `@sdxc/feed`
to route to it.

### Shape

One class merged with a namespace of types, as both siblings do:

```ts
class JSONFeed {
	constructor(feed: JSONFeed.Feed);
	get feed(): JSONFeed.Feed;
	get version(): string;
	get items(): JSONFeed.Item[];
	addItem(item: JSONFeed.Item): void;
	removeItem(id: string): void;
	toJSON(): JSONFeed.Document;
	toString(): string;

	static version(value: unknown): string | undefined;
	static fromJSON(value: unknown): Result<JSONFeed, JSONFeedParseError>;
	static parse(source: string): Result<JSONFeed, JSONFeedParseError>;
	static fetch(input, init?): Promise<Result<JSONFeed, JSONFeedFetchError | JSONFeedParseError>>;
}
```

The statics return a `Result`, following `@sdxc/atom` and the AGENTS.md rule rather than
`@sdxc/rss`'s throwing pair. The constructor and `addItem` still throw, which is what
keeps an instance from ever holding data that serializes into a document a reader rejects.

### The API is camelCase; the document is not

`JSONFeed.Feed` and `JSONFeed.Item` name their fields `homePageUrl`, `contentHtml`,
`datePublished`, `sizeInBytes`. The wire names — `home_page_url`, `content_html` — appear
only in `JSONFeed.Document`, `JSONFeed.DocumentItem` and `JSONFeed.DocumentAttachment`,
which is what `toJSON()` returns and therefore what `JSON.stringify` writes.

This is the one place the package departs from `@sdxc/rss` and `@sdxc/atom`, which both
carry the format's own spelling into the API (`pubDate`, `hreflang`). Those spellings are
already camelCase or single words; JSON Feed's are not, and snake_case fields would be the
only ones in the repo. The conversion is a table in two modules, `lib/parse-feed.ts` on
the way in and `lib/build-document.ts` on the way out.

`toJSON()` returning the document, rather than a `{ feed, items }` pair as the XML siblings
do, is what makes `JSON.stringify(feed, null, "\t")` produce a servable feed directly.

### Extensions are inline, not a bag

A publisher's `_blue_shed` object is written as a field of `Feed` and `Item`, typed by a
pattern index signature:

```ts
export type ExtensionKey = `_${string}`;
[extension: ExtensionKey]: unknown;
```

An underscore-prefixed key is exactly what the format reserves for extensions, so the
type says what the spec says, and a custom object round-trips without a second container.

### Reading is lenient, in the way the format asks for

JSON Feed tells a reader to recover from a bad field rather than refuse the feed, and to
discard exactly one thing: an item with no usable `id`. So the parser skips a field the
document typed the wrong way, coerces a numeric `id` to a string, keeps an attachment that
names no media type, and drops an item without an id. It refuses the whole document only
when there is no JSON Feed version URL, no title, or no `items` array.

### Changes to `@sdxc/feed`

- `Feed.Format` gains `"json"`, and `Feed.fromJSON` joins `Feed.fromXML`.
- `Feed.parse` forks on the text: a document whose first non-whitespace character is `{`
  goes to the JSON parser, everything else to the XML one.
- `Feed.Item` gains `contentText`, which holds a plain-text body as plain text. Rendering
  it as markup means escaping it, which is the caller's decision to make.
- `updatedAt` for a JSON feed is the newest item date, since the format declares none.
- Discovery accepts `application/feed+json` and `application/json` links, and applies the
  format's own preference: a page naming a `feed+json` link has its `application/json`
  candidates dropped, and a generic one stands in only when nothing better is offered.

## Consequences

### Positive

- A reader follows a `feed.json` URL with no new API, and `Feed.discover` finds one from
  a site's home page.
- `@sdxc/rss` and `@sdxc/atom` are untouched.
- The package builds feeds as well as reading them, so a publisher can serve JSON Feed
  beside RSS from the same data.

### Negative

- A third parser to maintain, and a third column in the normalized-shape table.
- `contentText` is filled by one of the three formats. An Atom `type="text"` entry still
  reaches `contentHtml`, so the field does not yet mean "every plain-text body".
- The camelCase surface means the package's field names and the spec's do not match
  character for character, so the README carries the mapping.

### Neutral

- `Feed.parse` recognizes JSON by its first character. A JSON Feed that arrived as a
  top-level array or scalar would be neither valid JSON Feed nor parseable as XML.

## Alternatives Considered

**Teach `@sdxc/feed` to read JSON Feed directly, with no package.** The façade would then
be the only place holding a format's vocabulary, and building a JSON feed — the other half
of what a format package does — would have no home.

**Name the API fields as the spec does.** Self-documenting against jsonfeed.org, and the
parser becomes nearly a pass-through. It also puts the repo's only snake_case fields in a
public API, which is what the convention exists to prevent.

**Return `{ feed, items }` from `toJSON()`, as the XML siblings do.** Consistent with them,
and it makes `JSON.stringify(feed)` produce something that is not a feed — the one trap a
JSON format package can avoid outright.

## References

- [JSON Feed Version 1.1](https://www.jsonfeed.org/version/1.1/)
- [ADR-051](./ADR-051-atom-package.md) — the sibling this package's shape follows
- [ADR-052](./ADR-052-feed-facade-package.md) — the façade that normalizes every format
