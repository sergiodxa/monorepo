# @sdxc/emoji

Emoji shortcodes, tokenize and render, with a markdown visitor and picker UI.

## Install

```bash
npm add @sdxc/emoji
```

`@sdxc/emoji/markdown` walks documents from
[`@sdxc/markdown`](https://www.npmjs.com/package/@sdxc/markdown). `@sdxc/emoji/ui` styles with
[`@sdxc/u`](https://www.npmjs.com/package/@sdxc/u) against the shared `--ui-*` theme apps load with
`@sdxc/ui/theme.css`. The built-in catalog is a separate entry so callers that pass their own map
never download it.

## Quick start

```ts
import { indexEntries, replaceShortcodes, tokenize, segmentsToHTML } from "@sdxc/emoji";
import { emojis, shortcodes } from "@sdxc/emoji/catalog";

replaceShortcodes("Ship it :tada:", shortcodes); // "Ship it 🎉"

let segments = tokenize(
	"Hi :blobcat:",
	indexEntries([
		...emojis,
		{ shortcodes: ["blobcat"], src: "https://cdn.example/blob.png", category: "custom" },
	]),
);
segmentsToHTML(segments); // text + <img> for https customs
```

### Markdown

```ts
import { Markdown } from "@sdxc/markdown";
import { emojis as catalog } from "@sdxc/emoji/catalog";
import { emojis } from "@sdxc/emoji/markdown";

let walked = Markdown.walk(document, emojis(catalog));
```

### UI

```tsx
import { EmojiPicker, EmojiSuggest, emojiInput, emojiPicker } from "@sdxc/emoji/ui";
import { emojis } from "@sdxc/emoji/catalog";
import { on } from "remix/component";

<dialog id="emoji">
	<EmojiPicker mix={[emojiPicker(), on("ui:emoji-pick", (event) => { /* … */ })]}>
		<EmojiPicker.Search aria-label="Search emoji" placeholder="Search" />
		<EmojiPicker.Viewport>
			<EmojiPicker.Category id="smileys-emotion" label="Smileys">
				{emojis.filter((entry) => entry.category === "smileys-emotion").map((entry) => (
					<EmojiPicker.Cell entry={entry} />
				))}
			</EmojiPicker.Category>
		</EmojiPicker.Viewport>
		<EmojiPicker.Empty>No matches</EmojiPicker.Empty>
		<EmojiPicker.Status />
	</EmojiPicker>
</dialog>

<textarea
	mix={[emojiInput({ catalog: emojis, suggest: "emoji-suggest" })]}
/>
<div id="emoji-suggest" hidden>
	<EmojiSuggest>{/* rows filled by the field mixin, or render EmojiSuggest.Item yourself */}</EmojiSuggest>
</div>
```

## Entries

| Entry                  | Exports                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `@sdxc/emoji`          | `merge`, `indexEntries`, `replaceShortcodes`, `tokenize`, `searchEmojis`, render helpers, types |
| `@sdxc/emoji/catalog`  | Generated `emojis`, `shortcodes` index, `EMOJI_CATEGORIES`                                      |
| `@sdxc/emoji/markdown` | `emojis(catalog)` walk visitor                                                                  |
| `@sdxc/emoji/ui`       | `EmojiPicker`, `EmojiSuggest`, `emojiInput`, `ui:emoji-pick`                                    |

## Catalog

`bun run generate` in this package downloads pinned OSS sources (see `SOURCES.md`), merges
aliases, writes `scripts/conflicts.md`, and refreshes `src/data/emojis.ts`.
