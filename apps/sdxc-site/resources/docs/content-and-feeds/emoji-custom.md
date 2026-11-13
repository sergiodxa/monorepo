---
title: Ship custom workspace emoji
description: Overlay tenant image shortcodes on the built-in catalog, keep `:name:` in stored text, and render customs as https images in markdown or plain HTML.
section:
    title: Markdown
    order: 8
order: 8
lastUpdated: 2026-11-13
outcomes:
    - "How to shape custom emoji entries and merge them onto the built-in catalog"
    - "How to expand customs as images in markdown and in plain-text render paths"
    - "How pickers and colon-suggest insert `:name:` for customs instead of a glyph"
---

Products that let a workspace upload stickers still store what a `<textarea>` can
hold: the shortcode `:shipit:`, not an image chip. Display turns that name into an
`<img>` whose `src` is an `https:` URL. This guide overlays those customs on
[`@sdxc/emoji`](/api/emoji)’s built-in Unicode catalog and renders them in markdown
and in plain HTML.

```bash
npm add @sdxc/emoji @sdxc/markdown @sdxc/result
```

Unicode shortcodes still expand to characters. Customs never become a Private Use
glyph: the shortcode is the identity.

## Shape a custom entry

A custom row carries the shortcodes that resolve to it, an `https:` image URL, the
`custom` category, and an optional accessible label:

```typescript {% title="app/services/workspace-emoji.ts" %}
import type { CustomEmoji, EmojiEntry } from "@sdxc/emoji";

import { merge } from "@sdxc/emoji";
import { emojis as builtIn } from "@sdxc/emoji/catalog";

export function workspaceCatalog(
	rows: ReadonlyArray<{ name: string; src: string; label?: string }>,
): EmojiEntry[] {
	let customs: CustomEmoji[] = rows.map((row) => ({
		shortcodes: [row.name],
		src: row.src,
		category: "custom",
		label: row.label,
	}));
	return merge(builtIn, customs);
}
```

`merge` appends customs and lets them win when a shortcode already exists on a
Unicode row, so `:shipit:` can mean the workspace sticker instead of a built-in
alias. Only `https:` sources are accepted at render time; other schemes are
skipped so a bad upload cannot become an active content URL.

## Render customs in markdown

Pass the merged catalog into the markdown visitor with `{ custom: "html" }` so a
text node that holds a custom becomes `inlineHtml` with an `<img>`:

```typescript {% title="app/services/content/prepare.ts" %}
import { emojis } from "@sdxc/emoji/markdown";
import { Markdown } from "@sdxc/markdown";

import { workspaceCatalog } from "~/app/services/workspace-emoji";
import { listWorkspaceEmoji } from "~/app/models/emoji";

export async function preparePost(document: Markdown.Document) {
	let catalog = workspaceCatalog(await listWorkspaceEmoji());
	return Markdown.walk(document, emojis(catalog, { custom: "html" }));
}
```

Leave `custom` at its default (`"text"`) when the HTML renderer cannot host
`inlineHtml`: Unicode still expands, and `:shipit:` stays visible as the shortcode
until a later pass draws it.

## Render customs outside markdown

Chat and titles that skip the markdown AST use `tokenize` and `segmentsToHTML`:

```typescript {% title="app/services/expand-emoji.ts" %}
import { indexEntries, segmentsToHTML, tokenize } from "@sdxc/emoji";

import type { EmojiEntry } from "@sdxc/emoji";

export function expandEmojiHtml(text: string, catalog: readonly EmojiEntry[]) {
	return segmentsToHTML(tokenize(text, indexEntries(catalog)));
}
```

Place the HTML with a path your CSP already allows for those image hosts. Unicode
segments stay text; custom segments become `<img src="https://…" alt="…">`.

## What the composer inserts

[`emojiInput`](/docs/building-remix-apps/emoji-picker) and the picker insert a
Unicode character for Unicode picks and `:name:` for customs. The field never has
to embed an image. Point both the field mixin and the picker cells at the same
merged catalog so suggest, browse and display agree on every name:

```tsx {% title="resources/components/composer-field.tsx" %}
import type { Handle } from "remix/component";

import { emojiInput } from "@sdxc/emoji/ui";
import { clientEntry } from "remix/component";

import type { EmojiEntry } from "@sdxc/emoji";

type ComposerFieldProps = {
	id: string;
	name: string;
	catalog: EmojiEntry[];
};

export const ComposerField = clientEntry(
	import.meta.url,
	function ComposerField(handle: Handle<ComposerFieldProps>) {
		return () => {
			let { catalog, id, name } = handle.props;
			let suggestId = `${id}-suggest`;
			return (
				<>
					<textarea
						id={id}
						name={name}
						mix={[emojiInput({ catalog, suggest: suggestId })]}
					/>
					<div id={suggestId} hidden popover="manual" />
				</>
			);
		};
	},
);
```

Serialize the catalog the island needs, or fetch it from a route the Worker already
caches: the built-in table is large, and a tenant overlay is usually a short list.

## Where to go next

- [Expand emoji shortcodes in markdown](/docs/content-and-feeds/emoji-markdown) —
  Unicode expansion in the content walk.
- [Add an emoji picker to a composer](/docs/building-remix-apps/emoji-picker) —
  suggest, browse and plain-text display.
- [`@sdxc/emoji`](/api/emoji) — `merge`, `tokenize`, `segmentsToHTML` and entry
  types.
