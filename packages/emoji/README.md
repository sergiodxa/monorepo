# @sdxc/emoji

Emoji shortcodes, tokenize and render, with a markdown visitor and picker UI.

Colon names such as `:tada:`, ASCII emoticons such as `:)`, and workspace customs whose
display is an `https:` image share one catalog shape. The built-in Unicode table lives on a
separate entry so callers that pass their own map never download it.

## Installation

```sh
npm add @sdxc/emoji
```

`@sdxc/emoji/markdown` walks documents from
[`@sdxc/markdown`](https://www.npmjs.com/package/@sdxc/markdown). `@sdxc/emoji/ui` styles with
[`@sdxc/u`](https://www.npmjs.com/package/@sdxc/u) against the shared `--ui-*` theme apps load with
`@sdxc/ui/theme.css`, and renders with `remix/component` from
[`remix`](https://www.npmjs.com/package/remix).

## Usage

### Expand shortcodes in a string

```typescript
import { replaceShortcodes } from "@sdxc/emoji";
import { shortcodes } from "@sdxc/emoji/catalog";

replaceShortcodes("Ship it :tada:", shortcodes); // "Ship it 🎉"
replaceShortcodes("Hi :)", shortcodes); // "Hi 🙂"
```

Customs stay as `:name:` in the plain-text path. Use `tokenize` when a custom must become an
image.

### Tokenize for HTML

```typescript
import { indexEntries, segmentsToHTML, tokenize } from "@sdxc/emoji";
import { emojis } from "@sdxc/emoji/catalog";

let index = indexEntries([
	...emojis,
	{
		shortcodes: ["blobcat"],
		src: "https://cdn.example/blob.png",
		category: "custom",
		label: "Blob cat",
	},
]);

segmentsToHTML(tokenize("Hi :blobcat:", index));
// text + <img src="https://cdn.example/blob.png" …> for https customs
```

### Expand shortcodes in markdown

```typescript
import { emojis as catalog } from "@sdxc/emoji/catalog";
import { emojis } from "@sdxc/emoji/markdown";
import { Markdown } from "@sdxc/markdown";
import { isFailure } from "@sdxc/result";

let parsed = Markdown.parse("Ship it :tada:\n");
if (isFailure(parsed)) throw parsed.error;

let walked = Markdown.walk(parsed.data.document, emojis(catalog));
if (isFailure(walked)) throw walked.error;
```

Code fences and inline code keep their colons. Pass `{ custom: "html" }` when customs should
become `inlineHtml` images instead of remaining `:name:` in the text node.

### Attach colon-suggest to a field

```tsx
import { emojis } from "@sdxc/emoji/catalog";
import { emojiInput } from "@sdxc/emoji/ui";

<textarea mix={[emojiInput({ catalog: emojis, suggest: "emoji-suggest" })]} />
<div id="emoji-suggest" hidden popover="manual" />
```

Suggest opens after two characters following `:`. Unicode picks insert the glyph; customs insert
`:name:`. Without script the field still accepts typed shortcodes.

### Browse with a picker

```tsx
import { emojis } from "@sdxc/emoji/catalog";
import { EmojiPicker, emojiPicker } from "@sdxc/emoji/ui";
import { on } from "remix/component";

<dialog id="emoji">
	<EmojiPicker
		mix={[
			emojiPicker(),
			on("ui:emoji-pick", (event) => {
				// event.detail: { kind, name, emoji? | src? }
			}),
		]}
	>
		<EmojiPicker.Search aria-label="Search emoji" placeholder="Search" />
		<EmojiPicker.Viewport>
			<EmojiPicker.Category id="smileys-emotion" label="Smileys">
				{emojis
					.filter((entry) => entry.category === "smileys-emotion")
					.map((entry) => (
						<EmojiPicker.Cell entry={entry} />
					))}
			</EmojiPicker.Category>
		</EmojiPicker.Viewport>
		<EmojiPicker.Empty>No matches</EmojiPicker.Empty>
		<EmojiPicker.Status />
	</EmojiPicker>
</dialog>;
```

Category tab glyphs and every visible string are props you pass — the package ships none.

## API

### `replaceShortcodes(text: string, index: ShortcodeIndex): string`

Replaces known `:name:` tokens and ASCII emoticons with Unicode characters. Custom shortcodes
stay as `:name:`.

### `tokenize(text: string, index: ShortcodeIndex): EmojiSegment[]`

Splits text into `text`, `unicode`, and `custom` segments for renderers that need images.

### `segmentsToText(segments: readonly EmojiSegment[]): string`

Joins segments as plain text: Unicode as characters, customs as `:name:`.

### `segmentsToHTML(segments: readonly EmojiSegment[]): string`

Joins segments as HTML. Customs with an `https:` `src` become `<img>`; other schemes fall back
to the escaped `:name:` spelling.

### `isHttpsSrc(src: string): boolean`

Whether a custom emoji URL is safe to embed.

### `indexEntries(entries: readonly EmojiEntry[]): ShortcodeIndex`

Builds the shortcode and emoticon map `replaceShortcodes` and `tokenize` read. Each name points
at one entry; later aliases on the same entry still resolve.

### `merge(base: readonly EmojiEntry[], extra: readonly EmojiEntry[]): EmojiEntry[]`

Overlays tenant or app rows onto a base catalog. Custom shortcodes win over Unicode aliases of
the same name; later extras win within the same kind.

### `searchEmojis(entries: readonly EmojiEntry[], query: string, limit?: number): EmojiEntry[]`

Ranks entries for suggest and picker search. Colons in `query` are ignored. Defaults to at most
12 rows (`DEFAULT_SUGGEST_LIMIT`).

### `preferredName(entry: EmojiEntry): string`

The shortcode UIs and `ui:emoji-pick` expose: always `shortcodes[0]`.

### `SUGGEST_MIN_CHARS`

Characters after `:` required before the field mixin opens suggest (`2`).

### `DEFAULT_SUGGEST_LIMIT`

Default cap for `searchEmojis` and suggest rows (`12`).

### `EMOJI_CATEGORIES`

Ordered Unicode category ids the built-in catalog and a default tab strip use.

### `isUnicodeEmoji(entry)` / `isCustomEmoji(entry)`

Narrow an `EmojiEntry` to its Unicode or custom shape.

### `@sdxc/emoji/catalog`

#### `emojis`

Generated Unicode entries, one row per glyph.

#### `shortcodes`

`indexEntries(emojis)`, ready for `replaceShortcodes` and `tokenize`.

#### `EMOJI_CATEGORIES`

Re-exported from the root for callers that only import the catalog.

### `@sdxc/emoji/markdown`

#### `emojis(catalog, options?: EmojiMarkdownOptions)`

A `Markdown.walk` visitor over `text` nodes. Unicode expands; customs stay `:name:` when
`options.custom` is `"text"` (the default), or become `inlineHtml` images when `"html"`.

### `@sdxc/emoji/ui`

#### `EmojiPicker`

Browse panel: search, category tabs, viewport, cells, empty and status. Place it inside your
`<dialog>` or popover; attach behavior with `emojiPicker()` via `mix`.

#### `EmojiSuggest`

Colon-autocomplete listbox host. The field mixin can fill its rows, or you render
`EmojiSuggest.Item` yourself.

#### `emojiInput(options: EmojiInputOptions)`

Mixin for `<input>` / `<textarea>`: opens suggest after two characters following `:`, inserts
Unicode or `:name:` for customs, and ignores password-like inputs and fenced regions in
textareas.

- `catalog`: catalog rows or a prebuilt `ShortcodeIndex`
- `suggest`: host element, its id, or a getter
- `limit`: max suggest rows (default `12`)

#### `emojiPicker()`

Mixin for the picker host: filters cells from the search field, jumps category tabs to their
sections, and turns cell activation into a cancelable `ui:emoji-pick`.

#### `EMOJI_PICK_EVENT` / `EmojiPickEvent` / `EmojiPickDetail`

DOM event type `"ui:emoji-pick"`, the `Event` subclass, and its detail:
`{ kind: "unicode"; emoji; name }` or `{ kind: "custom"; name; src; label? }`.
`preventDefault()` opts out of a mixin's default insert-and-close path.

### Types

#### `EmojiEntry`

`UnicodeEmoji | CustomEmoji`. Unicode rows carry `emoji`, `shortcodes`, `category`, optional
`tags` and `emoticons`. Custom rows carry `shortcodes`, `src`, `category: "custom"`, and
optional `label`.

#### `ShortcodeIndex`

`ReadonlyMap<string, EmojiEntry>` from `indexEntries`.

#### `EmojiSegment`

`{ type: "text"; value }` | `{ type: "unicode"; emoji; name }` |
`{ type: "custom"; name; src; label? }`.

#### `EmojiCategory`

Unicode/CLDR groups plus `"custom"`.

#### `EmojiMarkdownOptions`

- `custom`: `"text"` (default) or `"html"`, as under `@sdxc/emoji/markdown`.

## Pattern: Expand Shortcodes Outside Markdown

Chat bubbles and titles often store plain text. Expand on display with the built-in index.

```typescript
import { replaceShortcodes } from "@sdxc/emoji";
import { shortcodes } from "@sdxc/emoji/catalog";

export function expandEmoji(text: string): string {
	return replaceShortcodes(text, shortcodes);
}

expandEmoji("Fixed :bug: in login"); // "Fixed 🐛 in login"
```

## Pattern: Walk Markdown With The Built-In Catalog

Compose the visitor with your other passes so `:tada:` becomes Unicode before the page renders.

```typescript
import { emojis as catalog } from "@sdxc/emoji/catalog";
import { emojis } from "@sdxc/emoji/markdown";
import { Markdown } from "@sdxc/markdown";
import { isFailure } from "@sdxc/result";

export function preparePost(document: Markdown.Document) {
	return Markdown.walk(document, emojis(catalog));
}

let parsed = Markdown.parse("Ship it :tada:\n");
if (isFailure(parsed)) throw parsed.error;
let walked = preparePost(parsed.data.document);
if (isFailure(walked)) throw walked.error;
```

## Pattern: Overlay Custom Workspace Emoji

Merge tenant image shortcodes onto the built-in table so pickers, suggest, and render agree.

```typescript
import { merge, segmentsToHTML, tokenize, indexEntries } from "@sdxc/emoji";
import { emojis as builtIn } from "@sdxc/emoji/catalog";

let catalog = merge(builtIn, [
	{
		shortcodes: ["shipit"],
		src: "https://cdn.example/shipit.png",
		category: "custom",
		label: "Ship it",
	},
]);

let index = indexEntries(catalog);
segmentsToHTML(tokenize("Ready :shipit:", index));
// Ready <img src="https://cdn.example/shipit.png" alt="Ship it" …>
```

Pass the same `catalog` to `emojiInput` and to `emojis(catalog, { custom: "html" })` so the
field inserts `:shipit:` and the page draws the image.

## Pattern: Wire A Composer Field Island

Hydrate only the field that needs suggest; without script typed `:name:` still posts.

```tsx
import type { Handle } from "remix/component";

import { emojis } from "@sdxc/emoji/catalog";
import { emojiInput } from "@sdxc/emoji/ui";
import { clientEntry } from "remix/component";

type MessageFieldProps = {
	id: string;
	name: string;
	defaultValue?: string;
};

export const MessageField = clientEntry(
	import.meta.url,
	function MessageField(handle: Handle<MessageFieldProps>) {
		return () => {
			let { defaultValue = "", id, name } = handle.props;
			let suggestId = `${id}-suggest`;
			return (
				<>
					<textarea
						id={id}
						name={name}
						defaultValue={defaultValue}
						mix={[emojiInput({ catalog: emojis, suggest: suggestId })]}
					/>
					<div id={suggestId} hidden popover="manual" />
				</>
			);
		};
	},
);
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/emoji": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
