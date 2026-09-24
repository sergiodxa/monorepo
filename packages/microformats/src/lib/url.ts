/**
 * Resolves a URL a page wrote against the URL the page is read under, which every
 * `u-*` value, implied `photo` and `url`, `rel` link and `e-*` attribute goes through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DOMDocument } from "@sdxc/html/document";

/** A reference that starts with a scheme, which needs no resolving. */
const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:/iu;

/**
 * The absolute form of `value`. An absolute URL, and a value the URL parser rejects,
 * are returned as written, as an empty reference returns the base as given: the suite
 * expects `http://example.com` to stay without the slash a URL serializer adds.
 */
export function resolveUrl(value: string, base: string): string {
	if (value === "") return base;
	if (ABSOLUTE_URL.test(value)) return value;
	try {
		return new URL(value, base).href;
	} catch {
		return value;
	}
}

/**
 * The URL relative references resolve against: the first `<base href>` in the
 * document, itself resolved against the URL the page was fetched from.
 */
export function documentBase(document: DOMDocument, baseUrl: string | URL): string {
	let base = String(baseUrl);
	let element = document.querySelector("base[href]");
	let href = element?.getAttribute("href");
	if (href === null || href === undefined) return base;
	return resolveUrl(href, base);
}
