/**
 * Wraps the request's `render()` so every page reads the document's asset URLs from context,
 * looked up on each render. The wrapped renderer is Remix's own, which is what resolves a
 * `<Frame>` through the router and prepends `<!DOCTYPE html>`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { RequestContext } from "remix/router";

import { documentAssets } from "~/app/initializers/assets";
import { DocumentAssets } from "~/resources/layouts/document";

/**
 * The renderer `renderWith()` installs over the one `render()` published. The assets are
 * looked up per render, since a Worker may not await at module scope.
 *
 * @param ctx The request whose `render()` this wraps.
 */
export function withDocumentAssets(ctx: RequestContext) {
	let renderPage = ctx.render;

	return async function renderDocument(node: RemixNode, init?: ResponseInit) {
		let value = await documentAssets();
		return await renderPage(<DocumentAssets value={value}>{node}</DocumentAssets>, init);
	};
}
