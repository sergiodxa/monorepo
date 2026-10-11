/**
 * The blog's `ctx.render`: Remix's `render()` streams the document and resolves each `<Frame>`
 * through the router, and the blog's renderer lays a view and its model over it inside the
 * document's assets, so every controller renders a view rather than a node.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderFunction } from "remix/middleware/render";

import { Renderer, render, renderWith } from "remix/middleware/render";

import type { BlogRenderer, RenderOptions } from "~/app/http/context";

import { assets, documentAssets } from "~/app/initializers/assets";
import { DocumentAssets } from "~/resources/layouts/document";

/**
 * The middleware that publishes the blog's `ctx.render`: `render()` streams the document,
 * resolves each `<Frame>` through this same router with the visitor's headers, and maps every
 * island to its built chunk; the blog's renderer then lays the view and its assets over it.
 *
 * @returns The two middleware, in the order they must run.
 */
export function htmlRenderer() {
	return [
		render({ assets }),
		renderWith((ctx) => createHtmlRenderer(ctx.get(Renderer) as RenderFunction)),
	] as const;
}

/**
 * Creates the request-scoped renderer used by controllers via `ctx.render`, rendering a
 * view with its model inside the document's assets through the request's `render()`, which
 * leads the stream with `<!DOCTYPE html>` and keeps every page in standards mode.
 *
 * @param renderPage The renderer `render()` published for this request.
 */
function createHtmlRenderer(renderPage: RenderFunction): BlogRenderer {
	return async function renderView(ViewComponent, viewModel, options?: RenderOptions) {
		let View = ViewComponent();
		let pageAssets = await documentAssets();
		let headers = new Headers(options?.headers);
		headers.set("content-type", "text/html; charset=utf-8");

		return renderPage(
			<DocumentAssets value={pageAssets}>{View({ model: viewModel })}</DocumentAssets>,
			{ status: options?.status ?? 200, headers },
		);
	};
}
