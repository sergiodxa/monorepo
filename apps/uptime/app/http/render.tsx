/**
 * The app's HTML rendering chain: Remix's renderer, given the asset resolver so every island
 * hydrates from the chunk the build emitted for it, wrapped to hand each document its CSP nonce
 * and asset links, then the guard that turns a failed frame sub-request into a visible marker.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { Middleware, RequestContext } from "remix/router";

import { currentLog } from "@sdxc/logger";
import { SecurityHeadersKey } from "@sdxc/security-headers/middleware";
import { render, renderWith } from "remix/middleware/render";

import { frameFailures } from "~/app/http/middleware/frame-failures";
import { assets, documentAssets } from "~/app/lib/assets";
import { CspNonce } from "~/resources/components/csp-nonce";
import { DocumentAssets } from "~/resources/layouts/document";

/**
 * The renderer middleware, in order, for the end of the global chain. Frames resolve back
 * through the router rendering the document, so a fragment shares the request's cookies and
 * middleware; render failures go to the request's log, since a Worker discards the console.
 */
export function htmlRendering(): Middleware[] {
	return [
		render({
			assets,
			onError(error) {
				currentLog()?.fail(error, { render: { failed: true } });
			},
		}) as Middleware,
		renderWith(withDocument) as Middleware,
		frameFailures(),
	];
}

/**
 * Wraps the request's renderer so every tree carries the CSP nonce the response's policy names
 * and the document's assets. The nonce is read while the handler runs, before the stream
 * starts; the assets are looked up per render, since a Worker may not await at module scope.
 */
export function withDocument(ctx: RequestContext) {
	let renderPage = ctx.render;

	return async function renderDocument(node: RemixNode, init?: ResponseInit) {
		let nonce = ctx.has(SecurityHeadersKey) ? ctx.get(SecurityHeadersKey)?.nonce : undefined;
		let value = await documentAssets();

		return await renderPage(
			<CspNonce nonce={nonce}>
				<DocumentAssets value={value}>{node}</DocumentAssets>
			</CspNonce>,
			init,
		);
	};
}
