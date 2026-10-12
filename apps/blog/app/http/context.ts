/**
 * Request-context types for the blog HTTP layer: the `BlogRenderer` and render-option
 * shapes, and the `AppContext` the router's global middleware produces, set as the
 * router default type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { RemixNode } from "remix/component";
import type { RouterContext } from "remix/router";

import type { createWebRouter } from "~/app/initializers/router";

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

/**
 * Request context available after the app's global middleware stack runs, read off the
 * router itself so every value a global middleware publishes reaches the handlers.
 */
export type AppContext = RouterContext<ReturnType<typeof createWebRouter>>;

declare module "remix/router" {
	/** Uses the app middleware context as the default for route helpers. */
	interface RouterTypes {
		context: AppContext;
	}
}
