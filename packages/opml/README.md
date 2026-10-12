# @sdxc/opml

Read and write OPML subscription lists.

OPML is how a list of feeds moves between readers: one exports it, another imports it. `parse`
turns any reader's export, folders and all, into a flat list of subscriptions, and `stringify`
writes that list back as an OPML 2.0 document.

## Installation

```sh
npm add @sdxc/opml
```

`parse` answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result),
which installs alongside it.

## Usage

### Read a subscription list

```typescript
import { parse } from "@sdxc/opml";
import { isFailure } from "@sdxc/result";

let result = parse(source);
if (isFailure(result)) return result.error.message; // not XML, or not OPML

for (let outline of result.data) {
	await subscribe(outline.feedUrl, { title: outline.title, siteUrl: outline.siteUrl });
}
```

Subscriptions come back in document order, each feed URL once. A well-formed document that lists
no feeds succeeds with an empty array.

### Keep the folders

Readers let people file feeds into folders. Every subscription inside one carries the name of the
nearest folder around it:

```typescript
let source = `<opml version="2.0"><body>
	<outline text="Tech">
		<outline text="Blog" xmlUrl="https://example.com/feed.xml" />
	</outline>
	<outline text="News" xmlUrl="https://news.example.com/rss" />
</body></opml>`;

parse(source);
// success([
//   { title: "Blog", feedUrl: "https://example.com/feed.xml", folder: "Tech" },
//   { title: "News", feedUrl: "https://news.example.com/rss" },
// ])
```

### Write a subscription list

```typescript
import { stringify } from "@sdxc/opml";

let source = stringify(
	[
		{ title: "Blog", feedUrl: "https://example.com/feed.xml", folder: "Tech" },
		{ title: "News", feedUrl: "https://news.example.com/rss", siteUrl: "https://news.example.com" },
	],
	{ title: "Subscriptions", dateCreated: new Date() },
);
```

Each folder becomes one `<outline>` holding its subscriptions; folders come first, sorted by name,
followed by the unfiled subscriptions in the order given. Every value is escaped, so reading the
document back yields the same subscriptions.

## API

### `parse(source: string): Result<OPML.Outline[], OPMLParseError>`

Reads every outline with an `xmlUrl` anywhere under the `<opml>` root, as a flat list in document
order. An outline without `xmlUrl` is a folder, and its name becomes the `folder` of the feeds
under it. The title falls back from `text` to `title`, `htmlUrl`, then `xmlUrl`; `siteUrl` comes
from `htmlUrl`. Attribute names match in any case, values are trimmed, and a repeated feed URL
keeps its first entry. Fails with `OPMLParseError` when the text is not XML or the root element is
not `<opml>`.

### `stringify(outlines: OPML.Outline[], options?: OPML.StringifyOptions): string`

Writes an OPML 2.0 document. Each subscription becomes `<outline type="rss">` with its title in
both `text` and `title`, plus `htmlUrl` when it has a `siteUrl`. The `<head>` carries only the
options given.

### `OPMLParseError`

The `Error` `parse` fails with; its `message` says whether the text was not XML or which root
element arrived instead of `<opml>`.

### Types

#### `OPML.Outline`

`{ title: string; feedUrl: string; siteUrl?: string; folder?: string }`: one subscription.
`folder` is the name of the nearest folder around it when read, and the folder it is written
inside of.

#### `OPML.StringifyOptions`

- `title`: the document's own title, which a reader shows when importing it.
- `dateCreated`: when the document was written, emitted as a UTC date string.

## Pattern: Import an uploaded file

Read the file a form uploads, tell a broken file apart from an empty list, and subscribe to each
feed.

```typescript
import { parse } from "@sdxc/opml";
import { isFailure } from "@sdxc/result";

async function importSubscriptions(request: Request) {
	let form = await request.formData();
	let file = form.get("opml");
	if (!(file instanceof File)) return Response.json({ error: "Choose a file" }, { status: 400 });

	let result = parse(await file.text());
	if (isFailure(result)) {
		return Response.json({ error: "That file is not an OPML export" }, { status: 422 });
	}

	if (result.data.length === 0) {
		return Response.json({ error: "That file lists no feeds" }, { status: 422 });
	}

	for (let outline of result.data) {
		await subscribe({
			feedUrl: outline.feedUrl,
			title: outline.title,
			siteUrl: outline.siteUrl,
			folder: outline.folder,
		});
	}

	return Response.json({ imported: result.data.length });
}
```

Feed URLs arrive exactly as the document wrote them; resolving or fetching them is up to you.

## Pattern: Serve an export as a download

```typescript
import { stringify } from "@sdxc/opml";

function exportSubscriptions(subscriptions: Subscription[]) {
	let source = stringify(
		subscriptions.map((subscription) => ({
			title: subscription.title,
			feedUrl: subscription.feedUrl,
			siteUrl: subscription.siteUrl,
			folder: subscription.folder,
		})),
		{ title: "Subscriptions", dateCreated: new Date() },
	);

	return new Response(source, {
		headers: {
			"Content-Type": "text/x-opml",
			"Content-Disposition": `attachment; filename="subscriptions.opml"`,
		},
	});
}
```

## Pattern: Merge an import into existing subscriptions

`parse` removes duplicates within one document; skip the feeds a person already follows before
saving.

```typescript
import { parse } from "@sdxc/opml";
import { isFailure } from "@sdxc/result";

let result = parse(source);
if (isFailure(result)) throw result.error;

let followed = new Set(existing.map((subscription) => subscription.feedUrl));
let added = result.data.filter((outline) => !followed.has(outline.feedUrl));
```

## Pattern: Group subscriptions by folder

Rebuild the folder tree for display from the flat list.

```typescript
import type { OPML } from "@sdxc/opml";

function groupByFolder(outlines: OPML.Outline[]) {
	let groups = new Map<string, OPML.Outline[]>();
	for (let outline of outlines) {
		let key = outline.folder ?? "Unfiled";
		groups.set(key, [...(groups.get(key) ?? []), outline]);
	}
	return groups;
}
```

## Pattern: Test an export against its import

A document `stringify` writes reads back as the subscriptions that went into it, so an export and
an import can be tested against each other without a fixture.

```typescript
import { parse, stringify } from "@sdxc/opml";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

test("round-trips subscriptions", () => {
	let outlines = [
		{ title: "Tom & Jerry", feedUrl: "https://example.com/feed?a=1&b=2", folder: "Cartoons" },
		{ title: "News", feedUrl: "https://news.example.com/rss" },
	];

	expect(unwrap(parse(stringify(outlines)))).toEqual(outlines);
});
```

Folders are written first and sorted by name, so list filed subscriptions in that order when the
comparison needs to match exactly.

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
