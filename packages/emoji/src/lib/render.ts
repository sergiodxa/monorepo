/**
 * Turns {@link tokenize} segments into plain text or HTML. Custom images only
 * render when `src` is an `https:` URL; anything else falls back to `:name:`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EmojiSegment } from "./types.js";

/**
 * Joins segments as plain text: Unicode as characters, customs as `:name:`.
 *
 * @param segments - Output of {@link tokenize}
 */
export function segmentsToText(segments: readonly EmojiSegment[]): string {
	let out = "";
	for (let segment of segments) {
		if (segment.type === "text") out += segment.value;
		else if (segment.type === "unicode") out += segment.emoji;
		else out += `:${segment.name}:`;
	}
	return out;
}

/**
 * Joins segments as HTML: Unicode as escaped text, customs as `<img>` when
 * `src` is `https:`, otherwise the escaped `:name:` spelling.
 *
 * @param segments - Output of {@link tokenize}
 */
export function segmentsToHTML(segments: readonly EmojiSegment[]): string {
	let out = "";
	for (let segment of segments) {
		if (segment.type === "text") {
			out += escapeHTML(segment.value);
			continue;
		}
		if (segment.type === "unicode") {
			out += escapeHTML(segment.emoji);
			continue;
		}
		if (!isHttpsSrc(segment.src)) {
			out += escapeHTML(`:${segment.name}:`);
			continue;
		}
		let alt = escapeHTML(segment.label ?? segment.name);
		out += `<img src="${escapeHTML(segment.src)}" alt="${alt}" draggable="false" />`;
	}
	return out;
}

/** Whether a custom emoji URL is safe to embed. */
export function isHttpsSrc(src: string): boolean {
	try {
		return new URL(src).protocol === "https:";
	} catch {
		return false;
	}
}

function escapeHTML(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}
