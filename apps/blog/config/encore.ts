/**
 * Encore's App Store listing, the languages its pages are written in, and the colours the
 * browser chrome paints around them. The app is on sale, so every download call links the
 * listing and the pages carry Safari's smart banner.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Encore's numeric Apple ID, which the listing's URL and the smart banner name. */
export const ENCORE_APP_STORE_ID = "6813754400";

/** The listing every download call links to. */
export const ENCORE_APP_STORE_URL = `https://apps.apple.com/app/id${ENCORE_APP_STORE_ID}`;

/**
 * The languages Encore's pages are written in, the app's own: English first, as the fallback
 * for a reader whose language is none of them, then Argentine Spanish and Japanese.
 */
export const ENCORE_LOCALES = ["en", "es-AR", "ja"] as const;

/** One of the languages Encore's pages are written in. */
export type EncoreLocale = (typeof ENCORE_LOCALES)[number];

/**
 * The `theme-color` the browser tints its chrome with on Encore's pages: the warm paper of the
 * card's face in light, and the plum night the game is played on in dark.
 */
export const ENCORE_THEME_COLORS = { light: "#FFFAF0", dark: "#0E0513" } as const;

/**
 * The language of the social card for a shared link: the one `?lang=` names, matched on its
 * base tag as the page is (`es` and `es-MX` reach Argentine Spanish), English without one.
 *
 * @param url The request URL.
 * @returns The social card's language.
 */
export function shareLocale(url: URL): EncoreLocale {
	let requested = url.searchParams.get("lang")?.trim().toLowerCase();
	if (!requested) return "en";
	let base = requested.split("-")[0];
	return (
		ENCORE_LOCALES.find((locale) => locale.toLowerCase() === requested) ??
		ENCORE_LOCALES.find((locale) => locale.toLowerCase().split("-")[0] === base) ??
		"en"
	);
}

/**
 * An Encore page's address in a language, keeping a reader who picked one with `?lang=` on it.
 *
 * @param href The page's path, which may carry a fragment.
 * @param locale The language the reader is on.
 * @returns The path, with `?lang=` for any language but English.
 * @example inLanguage("/apps/encore#faq", "ja") // "/apps/encore?lang=ja#faq"
 */
export function inLanguage(href: string, locale: EncoreLocale): string {
	if (locale === "en") return href;
	let [path, hash] = href.split("#");
	return `${path}?lang=${locale}${hash ? `#${hash}` : ""}`;
}
