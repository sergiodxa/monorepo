/**
 * Gives a test renderer the document assets the app's renderer provides, so a page composed
 * into the document layout renders the tags the test asset manifest names. A stand-in
 * renderer wraps its node with this before streaming it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { documentAssets } from "~/app/lib/assets";
import { DocumentAssets } from "~/resources/layouts/document";

/**
 * Wraps `node` in the document assets provider, looked up the way the app's renderer does.
 *
 * @example renderToString(await withDocumentAssets(node))
 */
export async function withDocumentAssets(node: RemixNode): Promise<RemixNode> {
	let assets = await documentAssets();
	return <DocumentAssets value={assets}>{node}</DocumentAssets>;
}
