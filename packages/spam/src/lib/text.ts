/**
 * Text measurements the rules share: the links a submission carries and its words. Every rule
 * reads the same extraction, so two rules never disagree about how many links a text holds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * An absolute `http(s)` URL or a `www.` host, stopping at whitespace, quotes, angle brackets and
 * the brackets that close Markdown and BBCode link syntax. A bracketed IPv6 host is read whole.
 */
const URL_PATTERN = /\b(?:https?:\/\/(?:\[[0-9a-f:.]+\])?|www\.)[^\s"'<>()[\]]*/gi;

/** Punctuation a sentence puts after a URL, which is never part of it. */
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;

/**
 * The distinct links in `text`, parsed. A `www.` link is read as `http://`; a match that fails to
 * parse is dropped, so every entry has a host.
 *
 * @example extractLinks("see https://example.com/a.").map((url) => url.hostname); // ["example.com"]
 */
export function extractLinks(text: string): URL[] {
	let seen = new Set<string>();
	let links: URL[] = [];
	for (let match of text.matchAll(URL_PATTERN)) {
		let raw = match[0].replace(TRAILING_PUNCTUATION, "");
		let href = /^www\./i.test(raw) ? `http://${raw}` : raw;
		if (!URL.canParse(href)) continue;
		let url = new URL(href);
		if (seen.has(url.href)) continue;
		seen.add(url.href);
		links.push(url);
	}
	return links;
}

/** The words of `text` with its links removed, split on anything that is not a letter or digit. */
export function extractWords(text: string): string[] {
	return text
		.replace(URL_PATTERN, " ")
		.split(/[^\p{L}\p{N}'’]+/u)
		.filter((word) => word.length > 0);
}
