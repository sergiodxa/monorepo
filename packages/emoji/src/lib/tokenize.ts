/**
 * Splits text into plain runs, Unicode emoji picks, and custom image picks so
 * renderers can draw characters and `<img>` without string-replacing customs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EmojiSegment, ShortcodeIndex } from "./types.js";

import { isCustomEmoji, isUnicodeEmoji } from "./types.js";

/** A complete `:shortcode:` token. */
const SHORTCODE = /:([a-z0-9_+-]+):/gi;

/**
 * Tokenizes `text` against the index. Unicode shortcodes and emoticons become
 * `unicode` segments; custom shortcodes become `custom` segments; everything
 * else stays `text`.
 *
 * @param text - Source string
 * @param index - Shortcode map from {@link indexEntries}
 * @returns Ordered segments covering the whole string
 */
export function tokenize(text: string, index: ShortcodeIndex): EmojiSegment[] {
	let segments: EmojiSegment[] = [];
	let cursor = 0;

	for (let match of text.matchAll(SHORTCODE)) {
		let start = match.index ?? 0;
		if (start > cursor) {
			pushText(segments, text.slice(cursor, start));
		}
		let name = match[1]!.toLowerCase();
		let entry = index.get(name);
		if (entry && isUnicodeEmoji(entry)) {
			segments.push({ type: "unicode", emoji: entry.emoji, name: entry.shortcodes[0] ?? name });
		} else if (entry && isCustomEmoji(entry)) {
			segments.push({
				type: "custom",
				name: entry.shortcodes[0] ?? name,
				src: entry.src,
				label: entry.label,
			});
		} else {
			pushText(segments, match[0]!);
		}
		cursor = start + match[0]!.length;
	}

	if (cursor < text.length) {
		pushText(segments, text.slice(cursor));
	}

	return tokenizeEmoticons(
		segments.length === 0 ? [{ type: "text", value: text }] : segments,
		index,
	);
}

/** Walks text segments and splits known emoticons into unicode segments. */
function tokenizeEmoticons(segments: EmojiSegment[], index: ShortcodeIndex): EmojiSegment[] {
	let emoticons: string[] = [];
	for (let key of index.keys()) {
		if (/^[a-z0-9_+-]+$/i.test(key)) continue;
		if (key.startsWith(":") && key.endsWith(":")) continue;
		emoticons.push(key);
	}
	emoticons.sort((a, b) => b.length - a.length);
	if (emoticons.length === 0) return segments;

	let out: EmojiSegment[] = [];
	for (let segment of segments) {
		if (segment.type !== "text") {
			out.push(segment);
			continue;
		}
		splitEmoticons(segment.value, emoticons, index, out);
	}
	return out;
}

function splitEmoticons(
	value: string,
	emoticons: string[],
	index: ShortcodeIndex,
	out: EmojiSegment[],
) {
	let rest = value;
	while (rest.length > 0) {
		let hit: { at: number; emoticon: string } | undefined;
		for (let emoticon of emoticons) {
			let at = rest.indexOf(emoticon);
			if (at < 0) continue;
			if (!hit || at < hit.at || (at === hit.at && emoticon.length > hit.emoticon.length)) {
				hit = { at, emoticon };
			}
		}
		if (!hit) {
			pushText(out, rest);
			return;
		}
		if (hit.at > 0) pushText(out, rest.slice(0, hit.at));
		let entry = index.get(hit.emoticon);
		if (entry && isUnicodeEmoji(entry)) {
			out.push({
				type: "unicode",
				emoji: entry.emoji,
				name: entry.shortcodes[0] ?? hit.emoticon,
			});
		} else {
			pushText(out, hit.emoticon);
		}
		rest = rest.slice(hit.at + hit.emoticon.length);
	}
}

function pushText(segments: EmojiSegment[], value: string) {
	if (value === "") return;
	let last = segments.at(-1);
	if (last?.type === "text") {
		last.value += value;
		return;
	}
	segments.push({ type: "text", value });
}
