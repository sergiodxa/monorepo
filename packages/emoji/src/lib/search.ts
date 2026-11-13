/**
 * Ranks catalog entries for picker search and colon suggest: one hit per entry,
 * preferred shortcode first, prefix matches before substrings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EmojiEntry } from "./types.js";

import { isUnicodeEmoji } from "./types.js";

/** Default cap for {@link EmojiSuggest} rows. */
export const DEFAULT_SUGGEST_LIMIT = 12;

/** Characters after `:` required before the field mixin opens Suggest. */
export const SUGGEST_MIN_CHARS = 2;

/**
 * Finds entries matching `query` (colons ignored), deduped by entry, ranked for
 * suggest/picker search.
 *
 * @param entries - Catalog to search
 * @param query - Typed query, with or without surrounding colons
 * @param limit - Max rows to return
 */
export function searchEmojis(
	entries: readonly EmojiEntry[],
	query: string,
	limit = DEFAULT_SUGGEST_LIMIT,
): EmojiEntry[] {
	let needle = query.replaceAll(":", "").trim().toLowerCase();
	if (needle === "") return [];

	let scored: { entry: EmojiEntry; score: number }[] = [];
	for (let entry of entries) {
		let score = scoreEntry(entry, needle);
		if (score === Infinity) continue;
		scored.push({ entry, score });
	}
	scored.sort(
		(a, b) => a.score - b.score || preferredName(a.entry).localeCompare(preferredName(b.entry)),
	);
	return scored.slice(0, limit).map((row) => row.entry);
}

/** The shortcode UIs and events expose for an entry. */
export function preferredName(entry: EmojiEntry): string {
	return entry.shortcodes[0] ?? "";
}

function scoreEntry(entry: EmojiEntry, needle: string): number {
	let primary = preferredName(entry).toLowerCase();
	if (primary.startsWith(needle)) return 0;
	for (let name of entry.shortcodes) {
		if (name.toLowerCase().startsWith(needle)) return 1;
	}
	if (isUnicodeEmoji(entry)) {
		for (let tag of entry.tags ?? []) {
			if (tag.toLowerCase().startsWith(needle)) return 2;
		}
		for (let emoticon of entry.emoticons ?? []) {
			if (emoticon.toLowerCase().startsWith(needle)) return 2;
		}
	}
	for (let name of entry.shortcodes) {
		if (name.toLowerCase().includes(needle)) return 3;
	}
	if (isUnicodeEmoji(entry)) {
		for (let tag of entry.tags ?? []) {
			if (tag.toLowerCase().includes(needle)) return 4;
		}
	}
	if (isUnicodeEmoji(entry) && entry.emoji.includes(needle)) return 5;
	return Infinity;
}
