/**
 * Installs a request-scoped `ctx.render(jsx)` helper, shared by the platform and
 * tenant routers, so controllers can return `remix/component` JSX documents as complete
 * HTML responses that link the build's hashed assets under the response's CSP nonce.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { RequestContext } from "remix/router";

import { SecurityHeadersKey } from "@sdxc/security-headers/middleware";
import { renderToString } from "remix/component/server";
import { renderWith } from "remix/middleware/render";

import type { DocumentContext } from "~/app/views/hosted/document";

import { documentAssets } from "~/app/services/assets";
import { DocumentAssets } from "~/app/views/hosted/document";

/**
 * Builds the request-scoped renderer. It serializes a `remix/component` node to a full HTML
 * document (with the `<!doctype html>` prefix) and returns it as an HTML response, handing
 * the document its assets and the CSP nonce `securityHeaders()` mints for this response,
 * read only by a document that links scripts so a page without any advertises no nonce.
 *
 * @param context - The router request context, read for the response's CSP nonce.
 * @returns The `render` function attached to the context as `ctx.render`.
 * @example
 * return ctx.render(<Document title="Dashboard">…</Document>);
 */
function createHtmlRenderer(context: RequestContext) {
	return async function render(node: RemixNode, init?: ResponseInit): Promise<Response> {
		let value: DocumentContext = {
			...(await documentAssets()),
			get nonce() {
				return context.has(SecurityHeadersKey) ? context.get(SecurityHeadersKey)?.nonce : undefined;
			},
		};
		let page = <DocumentAssets value={value}>{node}</DocumentAssets>;
		let html = `<!doctype html>${await renderToString(page)}`;
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/** Middleware that installs `ctx.render` for a request pipeline. */
export default renderWith(createHtmlRenderer);

declare module "remix/router" {
	interface RequestContext {
		/**
		 * Renders a `remix/component` node as a complete HTML document response.
		 * @param node - The `remix/component` JSX tree to serialize.
		 * @param init - Optional response init (status, extra headers).
		 * @returns A `Response` with the serialized HTML and `text/html` content type.
		 */
		render(node: RemixNode, init?: ResponseInit): Promise<Response>;
	}
}
