/**
 * The renderer wrapper the platform and tenant routers install as `ctx.render(jsx)`, so a
 * controller returns a `remix/component` document as a complete HTML response that links
 * the build's hashed assets under the response's CSP nonce.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { RequestContext } from "remix/router";

import { SecurityHeadersKey } from "@sdxc/security-headers/middleware";
import { render, renderWith } from "remix/middleware/render";

import type { DocumentContext } from "~/resources/views/hosted/document";

import { assets, documentAssets } from "~/app/initializers/assets";
import { DocumentAssets } from "~/resources/views/hosted/document";

/**
 * Builds the request-scoped renderer over the one `render()` installed, handing the
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
 * Installs `ctx.render` for a router: `render()` streams the document and maps every island
 * to the chunk the build emitted for its `clientEntry(import.meta.url, …)`, then the
 * document-assets wrapper hands each page its assets and the response's CSP nonce.
 *
 * @returns The two middleware, in the order they must run.
 * @example
 * createRouter({ middleware: [securityHeaders(policy), ...htmlRenderer(), formData()] });
 */
export function htmlRenderer() {
	return [render({ assets }), renderWith(withDocumentAssets)] as const;
}

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
