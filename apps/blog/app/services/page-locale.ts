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
 * @param locales The languages the page is written in.
 * @returns The language to serve, or `undefined` when nothing matches.
 */
function matchLocale<Locale extends string>(
	tag: string,
	locales: ReadonlyArray<Locale>,
): Locale | undefined {
	let wanted = tag.trim().toLowerCase();
	if (wanted === "") return undefined;

	let exact = locales.find((locale) => locale.toLowerCase() === wanted);
	if (exact) return exact;

	let base = wanted.split("-")[0];
	return locales.find((locale) => locale.toLowerCase().split("-")[0] === base);
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
	return resolveLocale(url, acceptLanguage, PAGE_LOCALES);
}

/**
 * {@link resolvePageLocale} for a page written in its own set of languages, such as an app
 * page that follows the app's languages. The first language is the fallback.
 *
 * @param url The request URL, read for `?lang=`.
 * @param acceptLanguage The request's `Accept-Language` header, when it sent one.
 * @param locales The page's languages, the fallback first.
 * @returns The language to serve.
 * @example resolveLocale(url, "ja-JP", ["en", "es-AR", "ja"]) // "ja"
 */
export function resolveLocale<Locale extends string>(
	url: URL,
	acceptLanguage: string | null,
	locales: readonly [Locale, ...Array<Locale>],
): Locale {
	let requested = url.searchParams.get("lang");
	if (requested !== null) {
		let chosen = matchLocale(requested, locales);
		if (chosen) return chosen;
	}

	for (let entry of acceptLanguage?.split(",") ?? []) {
		let chosen = matchLocale(entry.split(";")[0] ?? "", locales);
		if (chosen) return chosen;
	}

	return locales[0];
}
