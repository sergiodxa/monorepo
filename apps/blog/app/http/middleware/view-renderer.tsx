/**
 * The blog's `ctx.render`: it lays a view and its model over the `render()` the router installs
 * before it, handing the view the document assets `assets()` published as `ctx.assets`, so every
 * controller renders a view rather than a node and each page's document links the same build.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { RenderFunction } from "remix/middleware/render";

import { Renderer, renderWith } from "remix/middleware/render";

import type { BlogRenderer, RenderOptions } from "~/app/http/context";

/**
 * Creates the middleware that publishes the blog's `ctx.render`. It runs after `assets()`, whose
 * `ctx.assets` every view receives, and after `render()`, which streams the document, resolves
 * each `<Frame>` through the router and maps every island to its built chunk.
 *
 * @example createRouter({ middleware: [assets(assetResolver, paths), render({ assets: assetResolver }), viewRenderer()] })
 */
export function viewRenderer() {
	return renderWith((ctx) => createViewRenderer(ctx.get(Renderer) as RenderFunction, ctx.assets));
}

/**
 * Creates the request-scoped renderer controllers reach through `ctx.render`, rendering a view
 * with its model and the request's document assets through `render()`, which leads the stream
 * with `<!DOCTYPE html>` and keeps every page in standards mode.
 *
 * @param renderPage The renderer `render()` published for this request.
 * @param assets The document assets `assets()` published for this request.
 */
function createViewRenderer(renderPage: RenderFunction, assets: DocumentAssets): BlogRenderer {
	return async function renderView(ViewComponent, viewModel, options?: RenderOptions) {
		let View = ViewComponent();
		let headers = new Headers(options?.headers);
		headers.set("content-type", "text/html; charset=utf-8");

		return renderPage(View({ model: viewModel, assets }), {
			status: options?.status ?? 200,
			headers,
		});
	};
}
