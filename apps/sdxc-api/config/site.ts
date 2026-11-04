/**
 * Public site identity for the landing page: hostname, product name and short pitch.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Production origin the Cloudflare domain binding serves. */
export const SITE_ORIGIN = "https://api.sdxc.dev";

/** Brand shown as the hero-level signal. */
export const SITE_BRAND = "sdxc APIs";

/** One-line product pitch under the brand. */
export const SITE_TAGLINE = "Package capabilities as pay-per-call HTTP and MCP tools for agents.";

/** Longer description for meta tags and the markdown twin. */
export const SITE_DESCRIPTION =
	"Run individual @sdxc package operations over HTTP or MCP. Agents pay per request with x402; humans keep free docs and npm installs.";

/** `<title>` and Open Graph title for the public landing. */
export const SITE_TITLE = `${SITE_BRAND} — pay-per-call package APIs`;

/** Who publishes the API, named in the landing's byline and structured data. */
export const AUTHOR_NAME = "Sergio Xalambrí";

/** The author's own site, linked from the byline and claimed with `rel="me"`. */
export const AUTHOR_URL = "https://sergiodxa.com";

/** Avatar URL the landing's `h-card` publishes; the page does not request the image. */
export const AUTHOR_PHOTO = "https://github.com/sergiodxa.png";

/** X handle for `twitter:site` and `twitter:creator`. */
export const AUTHOR_X_HANDLE = "@sergiodxa";

/** GitHub profile claimed with `rel="me"`. */
export const AUTHOR_GITHUB = "https://github.com/sergiodxa";

/** X profile claimed with `rel="me"`. */
export const AUTHOR_X_URL = "https://x.com/sergiodxa";

/** Docs site claimed with `rel="me"`, where the packages stay free to read. */
export const DOCS_ORIGIN = "https://sdxc.dev";

/**
 * Profiles the landing claims as the same publisher, in `rel="me"` and in the
 * organization node's `sameAs`.
 */
export const AUTHOR_PROFILES = [AUTHOR_URL, AUTHOR_GITHUB, AUTHOR_X_URL, DOCS_ORIGIN] as const;
