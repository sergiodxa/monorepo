/**
 * Replaces complete `:name:` shortcodes and known ASCII emoticons with Unicode
 * characters. Custom shortcodes stay as typed so render/tokenize can draw images.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ShortcodeIndex } from "./types.js";

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

/** Longest-first emoticon replacement so `:-)` wins over `:)` when both exist. */
function replaceEmoticons(text: string, index: ShortcodeIndex): string {
	let emoticons: string[] = [];
	for (let key of index.keys()) {
		if (key.startsWith(":") && key.endsWith(":") && key.length > 2) continue;
		if (/^[a-z0-9_+-]+$/i.test(key)) continue;
		emoticons.push(key);
	}
	emoticons.sort((a, b) => b.length - a.length);

	let out = text;
	for (let emoticon of emoticons) {
		let entry = index.get(emoticon);
		if (!entry || !isUnicodeEmoji(entry)) continue;
		out = out.split(emoticon).join(entry.emoji);
	}
	return out;
}
