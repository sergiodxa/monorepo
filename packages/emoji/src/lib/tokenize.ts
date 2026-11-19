/**
 * Splits text into plain runs, Unicode emoji picks, and custom image picks so
 * renderers can draw characters and `<img>` without string-replacing customs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EmojiSegment, ShortcodeIndex } from "./types.js";

import { emoticonKeys, findEmoticon } from "./emoticons.js";
import { isCustomEmoji, isUnicodeEmoji } from "./types.js";

/** A complete `:shortcode:` token. */
const SHORTCODE = /:([a-z0-9_+-]+):/gi;

/**
 * Tokenizes `text` against the index. Unicode shortcodes and emoticons standing
 * as their own word become `unicode` segments; custom shortcodes become `custom`
 * segments; everything else stays `text`.
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

/**
 * Splits emoticons out of the text segments. A segment's ends count as word edges
 * only at the start and end of the whole string, so an emoticon glued to a
 * shortcode stays text.
 */
function tokenizeEmoticons(segments: EmojiSegment[], index: ShortcodeIndex): EmojiSegment[] {
	let emoticons = emoticonKeys(index);
	if (emoticons.length === 0) return segments;

	let out: EmojiSegment[] = [];
	segments.forEach((segment, position) => {
		if (segment.type !== "text") {
			out.push(segment);
			return;
		}
		let edges = { start: position === 0, end: position === segments.length - 1 };
		splitEmoticons(segment.value, emoticons, index, edges, out);
	});
	return out;
}

/** Pushes `value` as text and unicode segments, one per emoticon standing as its own word. */
function splitEmoticons(
	value: string,
	emoticons: readonly string[],
	index: ShortcodeIndex,
	edges: { start: boolean; end: boolean },
	out: EmojiSegment[],
) {
	let cursor = 0;
	let hit = findEmoticon(value, cursor, emoticons, edges);
	while (hit) {
		if (hit.at > cursor) pushText(out, value.slice(cursor, hit.at));
		let entry = index.get(hit.emoticon);
		if (entry && isUnicodeEmoji(entry)) {
			out.push({ type: "unicode", emoji: entry.emoji, name: entry.shortcodes[0] ?? hit.emoticon });
		} else {
			pushText(out, hit.emoticon);
		}
		cursor = hit.at + hit.emoticon.length;
		hit = findEmoticon(value, cursor, emoticons, edges);
	}
	pushText(out, value.slice(cursor));
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
