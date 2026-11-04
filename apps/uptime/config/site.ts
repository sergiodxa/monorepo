/**
 * Who operates the public site. Legal pages, the trust page and the footer name this
 * person, and the same URLs are what `rel="me"` and the organization `sameAs` claim,
 * so a parser and a search engine agree on one identity.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The person who builds and operates the service. `photo` is the public avatar a card
 * can cite; the product itself ships no separate logo file.
 */
export const SITE_OWNER = {
	name: "Sergio Xalambrí",
	url: "https://sergiodxa.com",
	photo: "https://github.com/sergiodxa.png",
	note: "Builds and operates Uptime.",
} as const;

/**
 * The X handle Twitter cards name as the site and the author. The same profile is the
 * `rel="me"` link {@link SITE_OWNER_PROFILES} already lists.
 */
export const SITE_OWNER_X_HANDLE = "@sergiodxa";

/**
 * Profiles that resolve to {@link SITE_OWNER}, the personal site first. The X entry is
 * the profile {@link SITE_OWNER_X_HANDLE} names.
 */
export const SITE_OWNER_PROFILES = [
	SITE_OWNER.url,
	"https://github.com/sergiodxa",
	"https://x.com/sergiodxa",
	"https://www.youtube.com/sergiodxa",
] as const;
