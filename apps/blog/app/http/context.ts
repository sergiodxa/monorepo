/**
 * Request-context types for the blog HTTP layer. Defines the `BlogRenderer`
 * and render-option shapes and the `AppContext` produced after global middleware
 * (form data, session, auth, renderer), and sets it as the router default type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ContextWithEntries, RequestContext } from "remix/router";
import type { RemixNode } from "remix/ui";

import { Auth } from "remix/middleware/auth";
import { Renderer } from "remix/middleware/render";
import { Session } from "remix/session";

/** Optional HTTP metadata for rendered HTML responses. */
export interface RenderOptions {
	status?: number;
	headers?: HeadersInit;
}

/** Renders an app view component with its view model into an HTML response. */
export interface BlogRenderer {
	<ViewModel>(
		ViewComponent: () => (props: { model: ViewModel }) => RemixNode,
		viewModel: ViewModel,
		options?: RenderOptions,
	): Promise<Response>;
}

/** Request context available after the app's global middleware stack runs. */
export type AppContext = ContextWithEntries<
	RequestContext<Record<string, string>>,
	[
		{ key: typeof FormData; value: FormData },
		{ key: typeof Session; value: Session },
		{ key: typeof Auth; value: unknown },
		{ key: typeof Renderer; value: BlogRenderer; property: "render" },
	]
>;

declare module "remix/router" {
	/** Uses the app middleware context as the default for route helpers. */
	interface RouterTypes {
		context: AppContext;
	}
}
