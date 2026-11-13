---
title: Expand emoji shortcodes in markdown
description: Turn `:tada:` and ASCII emoticons in markdown into Unicode characters during the same walk that highlights code and draws diagrams.
section:
    title: Markdown
    order: 8
order: 7
lastUpdated: 2026-11-13
outcomes:
    - "How to expand `:name:` shortcodes in a markdown walk with `@sdxc/emoji`"
    - "How to compose the visitor with highlight, diagrams and other passes"
    - "How to keep custom shortcodes as `:name:` or emit them as images"
---

Authors type emoji the way GitHub does: a colon name such as `:tada:`, or an ASCII
emoticon such as `:)`. This guide expands those tokens while a post walks through
[`@sdxc/markdown`](/api/markdown), using the visitor from
[`@sdxc/emoji`](/api/emoji). Code fences and inline code stay literal, the way
typography leaves them alone.

```bash
npm add @sdxc/emoji @sdxc/highlight @sdxc/markdown @sdxc/result
```

The built-in catalog lives on `@sdxc/emoji/catalog`, a separate entry so the root
module never pulls the table in. Import it only when the Worker should ship the
generated Unicode set.

## Expand shortcodes in one walk

`emojis(catalog)` from `@sdxc/emoji/markdown` is a visitor over `text` nodes. Pass
the built-in list (or your own map) and compose it with the other passes your
pipeline already runs:

```typescript {% title="app/services/content/prepare.ts" %}
import { emojis as catalog } from "@sdxc/emoji/catalog";
import { emojis } from "@sdxc/emoji/markdown";
import { highlight } from "@sdxc/highlight/markdown";
import { Markdown } from "@sdxc/markdown";

export function preparePost(document: Markdown.Document) {
	return Markdown.walk(document, Markdown.compose(highlight, emojis(catalog)));
}
```

A paragraph that says `Ship it :tada:` becomes a text node reading `Ship it 🎉`.
Unknown names stay as typed. List the visitor after plugins that rewrite whole
paragraphs (embeds, for example) and beside the highlighter: emoji only touches
`text`, so order among sibling text visitors is what you choose to read.

> [!WARNING]
> Merge visitors with `Markdown.compose`. An object spread keeps only the last
> handler for each key, so of two visitors that both handle `text`, only the
> second one runs.

## What the author writes

Shortcodes use the same spelling GitHub accepts. Emoticons from the catalog also
expand:

```text
Celebrated the launch :tada: with the team :)

A `:code:` span and a fence keep their colons:

~~~ts
const mood = ":tada:";
~~~
```

The first line becomes Unicode. The inline code and the fence keep `:tada:` as
characters, so a tutorial that talks about shortcodes still shows the source.

## Keep or draw custom emoji

Workspace customs are not Unicode: they are a shortcode whose display is an
`https:` image. By default the visitor expands Unicode and leaves customs as
`:name:` in the text node, which is what you want when the HTML renderer only
speaks characters. Pass `{ custom: "html" }` when the tree may hold
`inlineHtml` and you want those images in the page:

```typescript {% title="app/services/content/prepare-with-customs.ts" %}
import { merge } from "@sdxc/emoji";
import { emojis as builtIn } from "@sdxc/emoji/catalog";
import { emojis } from "@sdxc/emoji/markdown";
import { Markdown } from "@sdxc/markdown";

import type { EmojiEntry } from "@sdxc/emoji";

export function prepareWithCustoms(
	document: Markdown.Document,
	workspace: readonly EmojiEntry[],
) {
	let catalog = merge(builtIn, workspace);
	return Markdown.walk(document, emojis(catalog, { custom: "html" }));
}
```

`merge` lets custom shortcodes win over Unicode aliases of the same name. How to
shape those rows and serve their images is
[Ship custom workspace emoji](/docs/content-and-feeds/emoji-custom).

## Check a post expands

A unit test against `preparePost` fails when a shortcode survives the walk:

```typescript {% title="app/services/content/prepare.test.ts" %}
import { Markdown } from "@sdxc/markdown";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { preparePost } from "~/app/services/content/prepare";

test("expands emoji shortcodes in text", () => {
	let { document } = unwrap(Markdown.parse("Ship it :tada:\n"));
	let [paragraph] = unwrap(preparePost(document)).children;

	expect(paragraph).toMatchObject({
		type: "paragraph",
		children: [{ type: "text", value: "Ship it 🎉" }],
	});
});
```

## Where to go next

- [A markdown content pipeline](/docs/content-and-feeds/markdown-pipeline) — the
  parse, walk and route this visitor plugs into.
- [Add an emoji picker to a composer](/docs/building-remix-apps/emoji-picker) —
  colon-suggest and a browse picker for the fields that write the markdown.
- [Ship custom workspace emoji](/docs/content-and-feeds/emoji-custom) — overlay
  image shortcodes on the built-in catalog.
- [`@sdxc/emoji`](/api/emoji) — `replaceShortcodes`, `tokenize` and the catalog
  entries.
