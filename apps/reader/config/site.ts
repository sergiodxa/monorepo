/**
 * The public identity every indexed page names: the origin canonical URLs resolve
 * to, and the person the site belongs to. Head tags, schema.org nodes and the
 * h-card read these, so the three cannot drift apart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** The origin a crawler is told every public page lives on. */
export const SITE_URL = "https://reader.sergiodxa.com";

/** The product name `og:site_name` and the WebSite node carry. */
export const SITE_NAME = "Reader";

/**
 * The description a page uses when it has none of its own. It is the English
 * landing description, which is what a crawler that sends no language sees.
 */
export const SITE_DESCRIPTION =
	"Follow any site that publishes RSS or Atom. Reader checks each feed as often as it publishes and puts every new post in one queue, newest first, with nothing promoted into it.";

/** The personal X account public pages name as the site and as their author. */
export const TWITTER_HANDLE = "@sergiodxa";

/** The profile `rel="me"` and Organization `sameAs` publish for {@link TWITTER_HANDLE}. */
export const TWITTER_PROFILE = "https://x.com/sergiodxa";

/**
 * Who the site belongs to. `sameAs` is the set `rel="me"` also publishes, which is
 * how the home page's h-card is recognized as this person's.
 */
export const PUBLISHER = {
	name: "Sergio Xalambrí",
	url: "https://sergiodxa.com",
	photo: "https://github.com/sergiodxa.png",
	sameAs: [
		"https://sergiodxa.com",
		"https://github.com/sergiodxa",
		TWITTER_PROFILE,
		"https://www.youtube.com/sergiodxa",
	],
} as const;

/**
 * Open Graph locales for the languages the public pages are written in. The
 * document's `lang` stays the BCP 47 tag; this is the `language_TERRITORY` form.
 */
export const OG_LOCALES: Record<string, string> = {
	en: "en_US",
	es: "es_ES",
};
