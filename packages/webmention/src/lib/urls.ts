/**
 * URL resolution the way a browser resolves a page's links: against the page's
 * `<base href>` when it has one, else against the URL it was served from, with a value
 * that is not a URL skipped rather than guessed at.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DOMDocument } from "@sdxc/html/document";

/**
 * Resolves a reference, answering `null` for one that is not a URL against this base.
 *
 * @param value - The reference as the markup spells it; `""` names the base itself
 * @param base - The absolute URL it resolves against
 */
export function resolve(value: string, base: string | URL): URL | null {
	try {
		return new URL(value.trim(), base);
	} catch {
		return null;
	}
}

/** Reads a value as an absolute URL, answering `null` for a relative reference or anything else. */
export function absolute(value: string): URL | null {
	try {
		return new URL(value.trim());
	} catch {
		return null;
	}
}

/**
 * The URL a page's relative references resolve against: its first `<base href>`,
 * itself resolved against the page URL, else the page URL.
 */
export function baseOf(document: DOMDocument, pageUrl: string | URL): URL | null {
	let page = resolve("", pageUrl);
	if (page === null) return null;

	let href = document.querySelector("base[href]")?.getAttribute("href");
	if (href === null || href === undefined) return page;
	return resolve(href, page) ?? page;
}

/** A URL without its fragment, which never reaches the server and so names the same resource. */
export function withoutFragment(url: URL): string {
	let copy = new URL(url);
	copy.hash = "";
	return copy.href;
}
