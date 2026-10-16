/**
 * The renderer types for the blog HTTP layer: the `BlogRenderer` controllers reach as
 * `ctx.render`, and the HTTP metadata a rendered response may carry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { RemixNode } from "remix/component";

/** Optional HTTP metadata for rendered HTML responses. */
export interface RenderOptions {
	status?: number;
	headers?: HeadersInit;
}

/**
 * Renders an app view component with its view model into an HTML response. The view also
 * receives the request's document assets, which it hands to the layout wrapping its page.
 */
export interface BlogRenderer {
	<ViewModel>(
		ViewComponent: () => (props: { model: ViewModel; assets: DocumentAssets }) => RemixNode,
		viewModel: ViewModel,
		options?: RenderOptions,
	): Promise<Response>;
}
