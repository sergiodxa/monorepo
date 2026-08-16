/**
 * Installs a request-scoped `ctx.render(jsx)` helper for the platform dashboard so
 * controllers can return `remix/ui` JSX documents instead of hand-built HTML strings.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";
import type { RemixNode } from "remix/ui";

import { renderWith } from "remix/middleware/render";
import { renderToString } from "remix/ui/server";

/**
 * Builds the request-scoped renderer. It serializes a `remix/ui` node to a full HTML
 * document (with the `<!doctype html>` prefix) and returns it as an HTML response.
 *
 * @param _context - The router request context (unused; the renderer is stateless).
 * @returns The `render` function attached to the context as `ctx.render`.
 * @example
 * return ctx.render(<Document title="Dashboard">…</Document>);
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

declare module "remix/router" {
	interface RequestContext {
		/**
		 * Renders a `remix/ui` node as a complete HTML document response.
		 * @param node - The `remix/ui` JSX tree to serialize.
		 * @param init - Optional response init (status, extra headers).
		 * @returns A `Response` with the serialized HTML and `text/html` content type.
		 */
		render(node: RemixNode, init?: ResponseInit): Promise<Response>;
	}
}
