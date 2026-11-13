/**
 * Merges catalog extras onto a base list and re-indexes shortcode ownership.
 * Custom entries win over Unicode for the same shortcode; later extras win
 * within the same kind.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EmojiEntry } from "./types.js";

import { isCustomEmoji, isUnicodeEmoji } from "./types.js";

/**
 * Appends `extra` to `base`, coalescing Unicode rows that share a glyph and
 * keeping custom rows as separate identities keyed by their preferred shortcode.
 *
 * @param base - Existing catalog
 * @param extra - Tenant or app overlays
 * @returns A new catalog array
 */
export function merge(base: readonly EmojiEntry[], extra: readonly EmojiEntry[]): EmojiEntry[] {
	let byGlyph = new Map<string, EmojiEntry>();
	let customs: EmojiEntry[] = [];
	let customKeys = new Set<string>();

	function absorb(entry: EmojiEntry) {
		if (isCustomEmoji(entry)) {
			let key = entry.shortcodes[0]?.toLowerCase() ?? "";
			if (key === "") return;
			if (customKeys.has(key)) {
				let index = customs.findIndex(
					(row) => isCustomEmoji(row) && row.shortcodes[0]?.toLowerCase() === key,
				);
				if (index >= 0) customs[index] = entry;
				return;
			}
			customKeys.add(key);
			customs.push(entry);
			return;
		}

		let existing = byGlyph.get(entry.emoji);
		if (!existing || !isUnicodeEmoji(existing)) {
			byGlyph.set(entry.emoji, {
				...entry,
				shortcodes: [...entry.shortcodes],
				tags: entry.tags ? [...entry.tags] : undefined,
				emoticons: entry.emoticons ? [...entry.emoticons] : undefined,
			});
			return;
		}

		let shortcodes = unique([...existing.shortcodes, ...entry.shortcodes]);
		let tags = unique([...(existing.tags ?? []), ...(entry.tags ?? [])]);
		let emoticons = unique([...(existing.emoticons ?? []), ...(entry.emoticons ?? [])]);
		byGlyph.set(entry.emoji, {
			emoji: entry.emoji,
			category: entry.category,
			shortcodes,
			tags: tags.length > 0 ? tags : undefined,
			emoticons: emoticons.length > 0 ? emoticons : undefined,
		});
	}

	for (let entry of base) absorb(entry);
	for (let entry of extra) absorb(entry);

	return [...byGlyph.values(), ...customs];
}

/** Dedupes while preserving first-seen order, lowercasing shortcode-like tokens. */
function unique(values: string[]): string[] {
	let seen = new Set<string>();
	let out: string[] = [];
	for (let value of values) {
		let key = value.startsWith(":") || value.includes(")") ? value : value.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(value);
	}
	return out;
}
