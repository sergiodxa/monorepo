/**
 * Builds the shortcode → entry map from a catalog. Custom shortcodes overwrite
 * Unicode ones when both claim the same name; within one kind, later entries win.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EmojiEntry, ShortcodeIndex } from "./types.js";

import { isCustomEmoji } from "./types.js";

/**
 * Indexes every shortcode and emoticon on the entries. Custom names displace
 * Unicode; a later custom displaces an earlier custom.
 *
 * @param entries - Catalog rows to index
 * @returns An immutable shortcode map
 */
export function indexEntries(entries: readonly EmojiEntry[]): ShortcodeIndex {
	let map = new Map<string, EmojiEntry>();

	for (let entry of entries) {
		if (isCustomEmoji(entry)) continue;
		for (let name of entry.shortcodes) {
			let key = name.toLowerCase();
			let current = map.get(key);
			if (current && isCustomEmoji(current)) continue;
			map.set(key, entry);
		}
		for (let emoticon of entry.emoticons ?? []) {
			let current = map.get(emoticon);
			if (current && isCustomEmoji(current)) continue;
			map.set(emoticon, entry);
		}
	}

	for (let entry of entries) {
		if (!isCustomEmoji(entry)) continue;
		for (let name of entry.shortcodes) {
			map.set(name.toLowerCase(), entry);
		}
	}

	return map;
}
