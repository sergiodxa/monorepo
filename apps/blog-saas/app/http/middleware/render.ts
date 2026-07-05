/**
 * The HTML render middleware for the dashboard pipeline: installs `ctx.render`, a
 * request-scoped helper that server-renders a `remix/ui` tree to a full HTML document
 * response so controllers can `return ctx.render(<Page/>)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { RequestContext } from "remix/fetch-router";
import type { RemixNode } from "remix/ui";

import { renderWith } from "remix/render-middleware";
import { renderToString } from "remix/ui/server";

/**
 * Builds the request-scoped `render` function that controllers call as
 * `ctx.render(jsx)`: it server-renders the node, prepends the doctype, and sets the
 * HTML content type.
 *
 * @param _context The request context (unused; the renderer is request-scoped).
 * @returns A `render(node, init?)` function producing an HTML `Response`.
 */
function createHtmlRenderer(_context: RequestContext) {
	return async function render(node: RemixNode, init?: ResponseInit): Promise<Response> {
		let html = `<!doctype html>${await renderToString(node)}`;
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/** Middleware that installs `ctx.render` for the dashboard request pipeline. */
export default renderWith(createHtmlRenderer);

declare module "remix/fetch-router" {
	interface RequestContext {
		render(node: RemixNode, init?: ResponseInit): Promise<Response>;
	}
}
