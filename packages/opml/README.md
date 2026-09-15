# @sdxc/opml

Read and write OPML subscription lists.

OPML is how someone moves between feed readers: one exports the list, the other imports
it. This package is both halves of that, `parse` and `stringify`, over a document shape
that has barely changed in twenty years.

Reading is deliberately forgiving. A real export is a tree, because readers let people
file feeds into folders, and its attributes are spelled however the exporter felt like
spelling them. Reading flattens the tree, drops the folders, keeps the feeds inside them,
and falls through the attributes an outline might carry its title in, so what comes back
is the flat list an import actually wants.

Writing is deliberately plain: valid OPML 2.0, one `<outline>` per subscription, every
value escaped by the XML layer. A document this package writes reads back as the
subscriptions that went into it.

## Installation

```bash
npm add @sdxc/opml
```

The XML layer beneath it and the `Result` that reading returns, from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), install alongside this
package.

## Usage

### Import A Subscription List

```typescript
import { parse } from "@sdxc/opml";
import { isFailure } from "@sdxc/result";

let result = parse(await file.text());
if (isFailure(result)) throw result.error;

let outlines = result.data;
if (outlines.length === 0) return reportNothingToImport();

for (let outline of outlines) {
	await subscribe(outline.feedUrl, { title: outline.title, siteUrl: outline.siteUrl });
}
```

An empty list is a success, not a failure: a well-formed document that happens to list no
feeds is a different thing from a file that is not a subscription list, and only the
caller knows what to say about each.

### Export One

```typescript
import { stringify } from "@sdxc/opml";

let source = stringify(
	subscriptions.map((subscription) => ({
		title: subscription.title,
		feedUrl: subscription.feedUrl,
		siteUrl: subscription.siteUrl,
	})),
	{ title: "Subscriptions", dateCreated: new Date() },
);

return new Response(source, {
	headers: {
		"Content-Type": "text/x-opml",
		"Content-Disposition": `attachment; filename="subscriptions.opml"`,
	},
});
```

## API

### `parse(source: string): Result<OPML.Outline[], OPMLParseError>`

Reads every subscription a document lists, in document order.

- Outlines nest, and every level is visited, so a grouped export yields the same list as
  a flat one.
- An outline with no `xmlUrl` is a folder: it is skipped, and the feeds under it are not.
- The title comes from `text`, then `title`, then `htmlUrl`, then `xmlUrl`, so every
  subscription carries something a row can be labelled with.
- `siteUrl` comes from `htmlUrl`, and is absent when the outline named no site.
- A feed listed more than once appears once, at its first position.
- Values are trimmed, and attribute names are matched without regard to case.

### `stringify(outlines: OPML.Outline[], options?: OPML.StringifyOptions): string`

Writes subscriptions as an OPML 2.0 document with the `head`/`body` structure.

- `options.title` — the document's own title, which a reader shows when importing it.
- `options.dateCreated` — when the document was written, emitted in the format the head
  reads.

The list is written flat, since folders are a reader's own filing rather than anything a
subscription carries.

### Errors

`OPMLParseError` reports text that is not XML, or XML whose root element says it is not
OPML. Nothing a document contains below the root is an error.

### Types

`OPML.Outline` is `{ title: string; feedUrl: string; siteUrl?: string }`.
`OPML.StringifyOptions` is `{ title?: string; dateCreated?: Date }`.

## Pattern: Round-Tripping A List

Reading back a document this package wrote returns the outlines it was given, so an
export and the import beside it can be tested against each other without a fixture:

```typescript
import { parse, stringify } from "@sdxc/opml";
import { unwrap } from "@sdxc/result";

let outlines = [{ title: "Tom & Jerry", feedUrl: "https://example.com/feed?a=1&b=2" }];

expect(unwrap(parse(stringify(outlines)))).toEqual(outlines);
```

## Notes

1. **Only the root element decides whether a document is OPML.** A file whose root is
   anything else fails, which is how an error page served under a `200` in an export's
   place reports itself rather than reading as a list with nothing in it.
2. **Outlines are found anywhere under the root.** The specification puts them in
   `<body>`, and exports that omit it, or nest one oddly, still yield their feeds.
3. **The title is written twice, to `text` and `title`.** The specification requires
   `text`; readers exist that label a row from `title` alone, and one value fills both.
4. **Only subscription outlines survive a round trip.** An outline type OPML also allows
   — an inclusion, a directory entry, a line of an outliner document — is read only for
   the feed it names, and everything else about it is dropped.
5. **Nothing is fetched.** A subscription's feed URL arrives exactly as the document
   wrote it, relative forms included; resolving or retrieving one is the caller's.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/opml": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
