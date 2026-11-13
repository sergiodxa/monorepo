---
title: Add an emoji picker to a composer
description: Let people insert emoji from a dialog or by typing `:name`, keep shortcodes in the stored text, and expand them when the message renders.
section:
    title: Interface
    order: 4.5
order: 7
lastUpdated: 2026-11-13
outcomes:
    - "How to mount `EmojiPicker` in a native dialog with the `emojiPicker` mixin"
    - "How to attach colon-suggest to an input or textarea with `emojiInput`"
    - "How to expand shortcodes when rendering a message that is not markdown"
---

A chat composer, an issue title and a CMS body all want the same thing: people type
`:bug:` or pick from a grid, the field stores text a plain `<textarea>` can hold, and
the page shows the glyph (or a custom image) when that text renders.
[`@sdxc/emoji`](/api/emoji) supplies the catalog, the field mixin, the picker markup
and the string helpers; this guide wires them into a Remix v3 composer.

```bash
npm add @sdxc/emoji @sdxc/u @sdxc/ui remix
```

Load `@sdxc/ui/theme.css` (or the shared `--ui-*` theme your app already mounts) so
the picker’s surfaces, borders and focus rings match the rest of the page.

Without script the field still accepts typed `:name:` text. Suggest and picker are
upgrades on that baseline.

## Attach colon-suggest to the field

`emojiInput` opens a suggest list after two characters following `:`, inserts a
Unicode character on pick, and inserts `:name:` for customs. Point it at a host
element the mixin fills:

```tsx {% title="resources/components/message-field.tsx" %}
import type { Handle } from "remix/component";

import { emojis } from "@sdxc/emoji/catalog";
import { emojiInput } from "@sdxc/emoji/ui";
import { clientEntry } from "remix/component";

type MessageFieldProps = {
	id: string;
	name: string;
	defaultValue?: string;
	placeholder?: string;
};

export const MessageField = clientEntry(
	import.meta.url,
	function MessageField(handle: Handle<MessageFieldProps>) {
		return () => {
			let {
				defaultValue = "",
				id,
				name,
				placeholder = "Write a message",
			} = handle.props;
			let suggestId = `${id}-suggest`;

			return (
				<>
					<textarea
						id={id}
						name={name}
						rows={3}
						required
						defaultValue={defaultValue}
						placeholder={placeholder}
						mix={[emojiInput({ catalog: emojis, suggest: suggestId })]}
					/>
					<div id={suggestId} hidden popover="manual" />
				</>
			);
		};
	},
);
```

The mixin is client behavior, so the field lives in a `clientEntry` island. The empty
suggest host is enough: the mixin writes rows into it while a token is open. The same
`mix` works on a single-line `<input type="text">`, which is how issue titles take
`:bug:`.

## Open a browse picker from a button

The picker is pure markup. Put it in a native `<dialog>`, attach `emojiPicker()` so
search filters cells and a cell click becomes `ui:emoji-pick`, then insert into the
field from that event:

```tsx {% title="resources/components/emoji-browse.tsx" %}
import type { Handle } from "remix/component";

import { EMOJI_CATEGORIES, emojis } from "@sdxc/emoji/catalog";
import { EmojiPickEvent, EmojiPicker, emojiPicker } from "@sdxc/emoji/ui";
import { Button, Dialog } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

const LABELS: Record<(typeof EMOJI_CATEGORIES)[number], string> = {
	"smileys-emotion": "Smileys",
	"people-body": "People",
	"animals-nature": "Nature",
	"food-drink": "Food",
	"travel-places": "Travel",
	activities: "Activities",
	objects: "Objects",
	symbols: "Symbols",
	flags: "Flags",
};

type EmojiBrowseProps = {
	dialogId: string;
	fieldId: string;
};

export const EmojiBrowse = clientEntry(
	import.meta.url,
	function EmojiBrowse(handle: Handle<EmojiBrowseProps>) {
		return () => {
			let { dialogId, fieldId } = handle.props;

			function insert(event: EmojiPickEvent) {
				let field = document.getElementById(fieldId);
				if (!(field instanceof HTMLTextAreaElement)) return;
				let { detail } = event;
				let chunk =
					detail.kind === "unicode" ? detail.emoji : `:${detail.name}:`;
				let start = field.selectionStart ?? field.value.length;
				let end = field.selectionEnd ?? start;
				field.setRangeText(chunk, start, end, "end");
				field.dispatchEvent(new Event("input", { bubbles: true }));
				let dialog = document.getElementById(dialogId);
				if (dialog instanceof HTMLDialogElement) dialog.close();
			}

			return (
				<>
					<Button
						type="button"
						variant="ghost"
						commandfor={dialogId}
						command="show-modal"
						aria-label="Insert emoji"
					>
						😀
					</Button>
					<Dialog id={dialogId} aria-label="Emoji">
						<EmojiPicker
							mix={[
								emojiPicker(),
								on<HTMLElement, "ui:emoji-pick">(
									"ui:emoji-pick",
									(event) => {
										insert(event);
									},
								),
							]}
						>
							<EmojiPicker.Search
								aria-label="Search emoji"
								placeholder="Search"
							/>
							<EmojiPicker.Categories>
								{EMOJI_CATEGORIES.map((category) => (
									<EmojiPicker.CategoryTab
										category={category}
										label={LABELS[category]}
									>
										{LABELS[category].slice(0, 1)}
									</EmojiPicker.CategoryTab>
								))}
							</EmojiPicker.Categories>
							<EmojiPicker.Viewport>
								{EMOJI_CATEGORIES.map((category) => (
									<EmojiPicker.Category
										id={category}
										label={LABELS[category]}
									>
										{emojis
											.filter(
												(entry) =>
													entry.category === category,
											)
											.map((entry) => (
												<EmojiPicker.Cell entry={entry} />
											))}
									</EmojiPicker.Category>
								))}
							</EmojiPicker.Viewport>
							<EmojiPicker.Empty>No matches</EmojiPicker.Empty>
							<EmojiPicker.Status />
						</EmojiPicker>
					</Dialog>
				</>
			);
		};
	},
);
```

`detail.name` is always the preferred shortcode (`shortcodes[0]`). Call
`event.preventDefault()` on `ui:emoji-pick` when a keep-open or multi-pick UI should
skip a mixin’s default insert-and-close path.

## Expand shortcodes when the message is not markdown

Chat bubbles and issue titles often store plain text, not a markdown tree. Expand on
display with `replaceShortcodes` for Unicode-only catalogs, or `tokenize` when customs
must become `<img>` tags:

```typescript {% title="app/services/expand-emoji.ts" %}
import { replaceShortcodes, segmentsToHTML, tokenize } from "@sdxc/emoji";
import { shortcodes } from "@sdxc/emoji/catalog";

import type { ShortcodeIndex } from "@sdxc/emoji";

/** Expands Unicode shortcodes and emoticons for a text node or string child. */
export function expandEmoji(text: string, index: ShortcodeIndex = shortcodes) {
	return replaceShortcodes(text, index);
}

/** Builds HTML when the catalog may hold https custom images. */
export function expandEmojiHtml(text: string, index: ShortcodeIndex) {
	return segmentsToHTML(tokenize(text, index));
}
```

```tsx {% title="resources/views/message-bubble.tsx" %}
import type { Handle } from "remix/component";

import { expandEmoji } from "~/app/services/expand-emoji";

export function MessageBubble(handle: Handle<{ text: string }>) {
	return () => <p>{expandEmoji(handle.props.text)}</p>;
}
```

Posts written as markdown still go through
[Expand emoji shortcodes in markdown](/docs/content-and-feeds/emoji-markdown) instead of
this string path.

## Where to go next

- [Expand emoji shortcodes in markdown](/docs/content-and-feeds/emoji-markdown) — the
  walk visitor for posts and docs.
- [Ship custom workspace emoji](/docs/content-and-feeds/emoji-custom) — overlay image
  shortcodes and render them as images.
- [Build the interface with remix/component](/docs/building-remix-apps/interface-with-remix-ui)
  — dialogs, mixins and `clientEntry` islands.
- [`@sdxc/emoji`](/api/emoji) — picker parts, events and catalog shape.
