/**
 * Picks the language of a page the blog writes in both English and Spanish, such as `/mcp`
 * and `/press`, from a `?lang=` override or the request's `Accept-Language`, so every
 * bilingual page answers the same tags the same way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Languages the bilingual pages are written in.
 *
 * English leads because it is the fallback: a reader whose language is neither gets it.
 */
export const PAGE_LOCALES = ["en", "es-AR"] as const;

/** One of the languages the bilingual pages are written in. */
export type PageLocale = (typeof PAGE_LOCALES)[number];

/**
 * Finds the language a request tag should be served in. An exact match wins, then a match
 * on the base tag, so `es`, `es-MX` and `es-419` all reach the Argentine Spanish page — the
 * regional tag identifies the written dialect, independent of the intended reader.
 *
 * @param tag A language tag, from a header or a query parameter.
 * @returns The language to serve, or `undefined` when nothing matches.
 */
function matchLocale(tag: string): PageLocale | undefined {
	let wanted = tag.trim().toLowerCase();
	if (wanted === "") return undefined;

	let exact = PAGE_LOCALES.find((locale) => locale.toLowerCase() === wanted);
	if (exact) return exact;

	let base = wanted.split("-")[0];
	return PAGE_LOCALES.find((locale) => locale.toLowerCase().split("-")[0] === base);
}

/**
 * Picks the language to serve. An explicit `?lang=` wins first, since it is the only way to
 * share a link to one translation regardless of browser settings; otherwise the first
 * matching `Accept-Language` entry wins, honouring quality only by request order.
 *
 * @param url The request URL, read for `?lang=`.
 * @param acceptLanguage The request's `Accept-Language` header, when it sent one.
 * @returns The language to serve, defaulting to English.
 */
export function resolvePageLocale(url: URL, acceptLanguage: string | null): PageLocale {
	let requested = url.searchParams.get("lang");
	if (requested !== null) {
		let chosen = matchLocale(requested);
		if (chosen) return chosen;
	}

	for (let entry of acceptLanguage?.split(",") ?? []) {
		let chosen = matchLocale(entry.split(";")[0] ?? "");
		if (chosen) return chosen;
	}

	return "en";
}
