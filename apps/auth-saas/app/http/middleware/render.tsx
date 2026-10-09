/**
 * Installs a request-scoped `ctx.render(jsx)` helper, shared by the platform and
 * tenant routers, so controllers can return `remix/component` JSX documents as complete
 * HTML responses that link the build's hashed assets under the response's CSP nonce.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { Middleware, RequestContext } from "remix/router";

import { SecurityHeadersKey } from "@sdxc/security-headers/middleware";
import { render, renderWith } from "remix/middleware/render";

import type { DocumentContext } from "~/app/views/hosted/document";

import { assets, documentAssets } from "~/app/services/assets";
import { DocumentAssets } from "~/app/views/hosted/document";

/**
 * Streams a node as an HTML document whose islands resolve, through the asset manifest, to
 * the chunk the build emitted for each `clientEntry(import.meta.url, …)`.
 */
const renderDocument = render({ assets });

/**
 * Wraps every rendered node in the document's assets and the CSP nonce `securityHeaders()`
 * mints for this response, read only by a document that links scripts so a page without
 * any advertises no nonce.
 */
const provideDocumentAssets = renderWith(withDocumentAssets);

/**
 * Builds the request-scoped renderer over the one `renderDocument` installed, handing the
 * document its assets before the node is serialized.
 *
 * @param context - The router request context, read for its renderer and CSP nonce.
 * @returns The `render` function attached to the context as `ctx.render`.
 * @example
 * return ctx.render(<Document title="Dashboard">…</Document>);
 */
function withDocumentAssets(context: RequestContext) {
	let renderPage = context.render.bind(context);

	return async function renderWithAssets(node: RemixNode, init?: ResponseInit): Promise<Response> {
		let value: DocumentContext = {
			...(await documentAssets()),
			get nonce() {
				return context.has(SecurityHeadersKey) ? context.get(SecurityHeadersKey)?.nonce : undefined;
			},
		};
		return await renderPage(<DocumentAssets value={value}>{node}</DocumentAssets>, init);
	};
}

/**
 * Middleware that installs `ctx.render` for a request pipeline: the streaming renderer, then
 * the document-assets wrapper over it, as one step so every router mounts them in order.
 */
const renderMiddleware: Middleware = (context, next) =>
	renderDocument(context, async () => await provideDocumentAssets(context, next));

export default renderMiddleware;

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
