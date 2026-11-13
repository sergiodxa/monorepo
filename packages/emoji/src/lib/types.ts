/**
 * Catalog entry shapes: one Unicode glyph or one custom image, each with the
 * shortcodes that resolve to it. The grid lists each entry once; replace and
 * suggest look up by shortcode through a derived index.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Unicode/CLDR groups the picker tabs jump between, plus workspace customs. */
export type EmojiCategory =
	| "smileys-emotion"
	| "people-body"
	| "animals-nature"
	| "food-drink"
	| "travel-places"
	| "activities"
	| "objects"
	| "symbols"
	| "flags"
	| "custom";

/** Ordered category ids the built-in catalog and default tab strip use. */
export const EMOJI_CATEGORIES: readonly Exclude<EmojiCategory, "custom">[] = [
	"smileys-emotion",
	"people-body",
	"animals-nature",
	"food-drink",
	"travel-places",
	"activities",
	"objects",
	"symbols",
	"flags",
];

/** A Unicode emoji: one glyph, many shortcodes, optional tags and ASCII emoticons. */
export interface UnicodeEmoji {
	emoji: string;
	shortcodes: string[];
	category: Exclude<EmojiCategory, "custom">;
	tags?: string[];
	/** ASCII emoticons that resolve to this emoji, e.g. `:)` */
	emoticons?: string[];
}

/**
 * A workspace custom emoji: the shortcode is the identity and `src` is an
 * `https:` image URL shown at render time.
 */
export interface CustomEmoji {
	shortcodes: string[];
	src: string;
	category: "custom";
	label?: string;
}

/** One catalog row: either a Unicode glyph or a custom image. */
export type EmojiEntry = UnicodeEmoji | CustomEmoji;

/** Whether the entry draws a Unicode character rather than an image. */
export function isUnicodeEmoji(entry: EmojiEntry): entry is UnicodeEmoji {
	return "emoji" in entry;
}

/** Whether the entry draws a custom image. */
export function isCustomEmoji(entry: EmojiEntry): entry is CustomEmoji {
	return entry.category === "custom";
}

/**
 * Shortcode (without colons) or emoticon → catalog entry. Built by
 * {@link indexEntries}; custom shortcodes win over Unicode when merged.
 */
export type ShortcodeIndex = ReadonlyMap<string, EmojiEntry>;

/** One piece of text after {@link tokenize} splits shortcodes and emoticons. */
export type EmojiSegment =
	| { type: "text"; value: string }
	| { type: "unicode"; emoji: string; name: string }
	| { type: "custom"; name: string; src: string; label?: string };
