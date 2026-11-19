/**
 * Replaces complete `:name:` shortcodes and ASCII emoticons that stand as their own
 * word with Unicode characters. Custom shortcodes stay as typed so render/tokenize can draw images.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ShortcodeIndex } from "./types.js";

import { emoticonKeys, findEmoticon } from "./emoticons.js";
import { isUnicodeEmoji } from "./types.js";

/** A complete `:shortcode:` token; names are letters, digits, `+`, `-`, `_`. */
const SHORTCODE = /:([a-z0-9_+-]+):/gi;

/**
 * Substitutes known Unicode shortcodes and emoticons in `text`. Unknown names
 * and custom entries are left unchanged.
 *
 * @param text - Source string
 * @param index - Shortcode map from {@link indexEntries}
 * @returns Text with Unicode glyphs where shortcodes resolved
 */
export function replaceShortcodes(text: string, index: ShortcodeIndex): string {
	let withShortcodes = text.replace(SHORTCODE, (match, name: string) => {
		let entry = index.get(name.toLowerCase());
		if (!entry || !isUnicodeEmoji(entry)) return match;
		return entry.emoji;
	});

	return replaceEmoticons(withShortcodes, index);
}

/** Swaps every emoticon that stands as its own word, so URLs and paths keep their colons. */
function replaceEmoticons(text: string, index: ShortcodeIndex): string {
	let emoticons = emoticonKeys(index);
	if (emoticons.length === 0) return text;

	let out = "";
	let cursor = 0;
	let hit = findEmoticon(text, cursor, emoticons);
	while (hit) {
		let entry = index.get(hit.emoticon);
		out += text.slice(cursor, hit.at);
		out += entry && isUnicodeEmoji(entry) ? entry.emoji : hit.emoticon;
		cursor = hit.at + hit.emoticon.length;
		hit = findEmoticon(text, cursor, emoticons);
	}
	return out + text.slice(cursor);
}
