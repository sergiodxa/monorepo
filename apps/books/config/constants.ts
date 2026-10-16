/**
 * Values the funnel is configured with that never change between requests. Links and
 * identifiers built from them are published in newsletters and social posts, so each one
 * stays fixed once it has shipped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The canonical origin. Forced onto every canonical URL, so canonical links point here
 * whether a request lands on the `workers.dev` subdomain or a preview deployment.
 */
export const SITE_URL = "https://books.sergiodxa.com";

/** The handbook's title, published as `og:site_name` and in structured data. */
export const SITE_NAME = "React Router OAuth2 Handbook";

/** The description a page without its own publishes, in search results and link previews. */
export const SITE_DESCRIPTION =
	"A practical guide to implementing secure OAuth2 authentication in React Router and Remix applications.";

/** The Open Graph card image, published in newsletters and social posts already in the wild. */
export const OG_IMAGE_URL = `${SITE_URL}/og.jpg`;
