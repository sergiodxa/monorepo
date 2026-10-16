/**
 * The site's own identity: the one origin every canonical URL is built from, its author, and
 * how it describes itself. Whichever host served a request — a preview deployment, the
 * workers.dev name, the custom domain — a page states one address, so a crawler and a model
 * that read the same page from two hosts agree on what it is.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Where this site is read, which is the origin every URL it publishes is built on. */
export const SITE_URL = "https://sdxc.dev";

/**
 * Hosts the site answered on before {@link SITE_URL}. The worker still serves them so old
 * links resolve, and redirects a page read there to the same path on the current origin.
 */
export const FORMER_HOSTS = ["sdxc.sergiodxa.com"];

/** Who wrote the collection, credited wherever the site names a person. */
export const AUTHOR_NAME = "Sergio Xalambrí";

/** The author's own site, which is where the writing about this work lives. */
export const AUTHOR_URL = "https://sergiodxa.com";

/** The author's handle on X, where new packages and releases are announced. */
export const AUTHOR_X_HANDLE = "@sergiodxa";

/** The profile `AUTHOR_X_HANDLE` names. */
export const AUTHOR_X_URL = "https://x.com/sergiodxa";

/** Where a reader funds the author's work on these packages. */
export const SPONSOR_URL = "https://github.com/sponsors/sergiodxa";

/** What the collection is, for a page that states nothing of its own. */
export const SITE_DESCRIPTION =
	"Small TypeScript packages built on web standards. Take one, or take the set.";

/** The name a social card and a structured-data node call this site. */
export const SITE_NAME = "sdxc";

/** The absolute form of a path on this site, for a document that must name one. */
export function absoluteUrl(path: string): string {
	return new URL(path, SITE_URL).href;
}
