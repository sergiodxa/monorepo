/**
 * Finds ASCII emoticons that stand as words of their own, so `:/` in `https://`,
 * `C:/path` or `a:/b` stays text while `hmm :/` still becomes an emoji. Shared by
 * replace and tokenize so both expand exactly the same spots.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ShortcodeIndex } from "./types.js";

/** One emoticon found at `at`, with whitespace or an open edge on both sides. */
export interface EmoticonHit {
	at: number;
	emoticon: string;
}

/**
 * The index keys that are emoticons rather than shortcode names, longest first so
 * `:-)` wins over `:)` at the same position.
 *
 * @param index - Shortcode map from `indexEntries`
 * @returns Emoticon keys, longest first
 */
export function emoticonKeys(index: ShortcodeIndex): string[] {
	let emoticons: string[] = [];
	for (let key of index.keys()) {
		if (/^[a-z0-9_+-]+$/i.test(key)) continue;
		if (key.length > 2 && key.startsWith(":") && key.endsWith(":")) continue;
		emoticons.push(key);
	}
	return emoticons.sort((a, b) => b.length - a.length);
}

/**
 * The first emoticon at or after `from` that is preceded and followed by
 * whitespace or an edge. An edge counts only when the caller says the text
 * really starts or ends there, which keeps an emoticon glued to a neighbouring
 * shortcode as text.
 *
 * @param text - The run to search
 * @param from - Where to start looking
 * @param emoticons - Keys from {@link emoticonKeys}
 * @param edges - Whether the run's start and end are the text's own edges
 * @returns The hit, or `undefined` when none stands alone
 */
export function findEmoticon(
	text: string,
	from: number,
	emoticons: readonly string[],
	edges: { start: boolean; end: boolean } = { start: true, end: true },
): EmoticonHit | undefined {
	for (let at = from; at < text.length; at++) {
		if (!opensWord(text, at, edges.start)) continue;
		for (let emoticon of emoticons) {
			if (!text.startsWith(emoticon, at)) continue;
			if (!closesWord(text, at + emoticon.length, edges.end)) continue;
			return { at, emoticon };
		}
	}
	return undefined;
}

/** Whether a word may begin at `at`: after whitespace, or at an edge the caller vouches for. */
function opensWord(text: string, at: number, edge: boolean): boolean {
	if (at === 0) return edge;
	return /\s/.test(text[at - 1]!);
}

/** Whether a word may end at `end`: before whitespace, or at an edge the caller vouches for. */
function closesWord(text: string, end: number, edge: boolean): boolean {
	if (end === text.length) return edge;
	return /\s/.test(text[end]!);
}
