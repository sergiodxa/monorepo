import type { RequestContext } from "remix/fetch-router";
import type { RemixNode } from "remix/ui";

import { renderWith } from "remix/render-middleware";
import { renderToString } from "remix/ui/server";

/**
 * Request-scoped HTML renderer installed by {@link renderWith}: turns a `remix/ui`
 * node into a full HTML-document `Response` (with a leading `<!doctype html>`,
 * which `renderToString` does not emit). Controllers call it as `ctx.render(jsx)`.
 */
function createHtmlRenderer(_context: RequestContext) {
	return async function render(node: RemixNode, init?: ResponseInit): Promise<Response> {
		let html = `<!doctype html>${await renderToString(node)}`;
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/** Middleware that installs `ctx.render` for the request. */
export default renderWith(createHtmlRenderer);

declare module "remix/fetch-router" {
	interface RequestContext {
		/** Renders a `remix/ui` node to a full HTML-document response. */
		render(node: RemixNode, init?: ResponseInit): Promise<Response>;
	}
}
