/**
 * Reads a showcase screenshot from the site's own static files through the `ASSETS` binding,
 * the files `public/showcase/` deploys, so a social card can draw an item's cover.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";

/**
 * The bytes of a static file the site serves.
 *
 * @param path The file's path on the site, such as `/showcase/keel/card.png`.
 * @param origin Any address on the site, which the path resolves against.
 * @returns The bytes, or `null` when the site serves no such file.
 */
export async function readShowcaseScreenshot(
	path: string,
	origin: URL,
): Promise<Uint8Array | null> {
	let response = await env.ASSETS.fetch(new URL(path, origin));
	if (!response.ok) return null;
	return new Uint8Array(await response.arrayBuffer());
}
