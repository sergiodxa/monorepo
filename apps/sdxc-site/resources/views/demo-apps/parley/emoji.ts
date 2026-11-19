/**
 * Parley's emoji: the built-in Unicode catalog with Fernhill's own custom emoji overlaid, so
 * the picker, the composer's `:name:` suggestions, rendered messages and reactions all agree on
 * what a shortcode means and how a custom one is drawn.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CustomEmoji, EmojiEntry } from "@sdxc/emoji";

import { indexEntries, isCustomEmoji, merge, preferredName } from "@sdxc/emoji";
import { emojis } from "@sdxc/emoji/catalog";

/** Fernhill's custom emoji, served beside the demo's other files. */
export const CUSTOM_EMOJI: CustomEmoji[] = [
	{
		shortcodes: ["sprout"],
		src: "/demos/parley/emoji/sprout.svg",
		category: "custom",
		label: "Sprout",
	},
	{
		shortcodes: ["shipit"],
		src: "/demos/parley/emoji/shipit.svg",
		category: "custom",
		label: "Ship it",
	},
	{
		shortcodes: ["fernhill"],
		src: "/demos/parley/emoji/fernhill.svg",
		category: "custom",
		label: "Fernhill",
	},
	{
		shortcodes: ["lgtm"],
		src: "/demos/parley/emoji/lgtm.svg",
		category: "custom",
		label: "Looks good to me",
	},
];

/** Every emoji Parley knows: the built-in catalog with the customs overlaid. */
export const CATALOG: EmojiEntry[] = merge(emojis, CUSTOM_EMOJI);

/** Shortcodes and emoticons to entries, for expanding text. */
export const INDEX = indexEntries(CATALOG);

/** Names a reaction's screen reader hears for the emoji the fixtures use most. */
const NAMES: Record<string, string> = {
	"👍": "Thumbs up",
	"🎉": "Party popper",
	"👀": "Eyes",
	"🙏": "Folded hands",
	"😂": "Tears of joy",
	"🐈": "Cat",
	"✅": "Check mark",
	"💯": "Hundred points",
};

/** Unicode emoji by character, for naming a reaction from its glyph. */
const BY_GLYPH = new Map(
	emojis.flatMap((entry) => ("emoji" in entry ? [[entry.emoji, entry] as const] : [])),
);

/** Turns a shortcode into words: `heart_eyes` reads "Heart eyes". */
function words(shortcode: string): string {
	let spaced = shortcode.replaceAll("_", " ").replaceAll("+1", "thumbs up");
	return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** The custom emoji a reaction key such as `:shipit:` names, if any. */
export function customEmoji(key: string): CustomEmoji | undefined {
	if (!/^:[a-z0-9_+-]+:$/.test(key)) return undefined;
	let entry = INDEX.get(key.slice(1, -1));
	return entry !== undefined && isCustomEmoji(entry) ? entry : undefined;
}

/**
 * Whether a reaction key is one Parley can draw: a Unicode emoji from the catalog, or a custom
 * emoji's `:shortcode:`.
 */
export function isReactionKey(key: string): boolean {
	return BY_GLYPH.has(key) || customEmoji(key) !== undefined;
}

/**
 * What an emoji is called aloud, for a reaction chip and its tooltip.
 *
 * @param key A Unicode emoji, or a custom emoji's `:shortcode:`.
 */
export function emojiLabel(key: string): string {
	let custom = customEmoji(key);
	if (custom !== undefined) return custom.label ?? words(preferredName(custom));
	let named = NAMES[key];
	if (named !== undefined) return named;
	let entry = BY_GLYPH.get(key);
	return entry === undefined ? key : words(preferredName(entry));
}
