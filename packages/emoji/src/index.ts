/**
 * Emoji shortcodes: merge catalogs, replace and tokenize text, and search
 * entries for suggest/picker. The built-in table lives on `@sdxc/emoji/catalog`
 * so callers that pass their own map never load it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export { indexEntries } from "./lib/index-entries.js";
export { merge } from "./lib/merge.js";
export { isHttpsSrc, segmentsToHTML, segmentsToText } from "./lib/render.js";
export { replaceShortcodes } from "./lib/replace.js";
export {
	DEFAULT_SUGGEST_LIMIT,
	preferredName,
	searchEmojis,
	SUGGEST_MIN_CHARS,
} from "./lib/search.js";
export { tokenize } from "./lib/tokenize.js";
export { EMOJI_CATEGORIES, isCustomEmoji, isUnicodeEmoji } from "./lib/types.js";
export type {
	CustomEmoji,
	EmojiCategory,
	EmojiEntry,
	EmojiSegment,
	ShortcodeIndex,
	UnicodeEmoji,
} from "./lib/types.js";
