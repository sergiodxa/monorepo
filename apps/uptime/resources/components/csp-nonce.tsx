/**
 * Carries the response's Content Security Policy nonce down the rendered tree, so the
 * document can stamp it on the import map without every page passing it along. The
 * renderer provides it; a tree rendered without one reads `undefined`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

export namespace CspNonce {
	export interface Props {
		/** The nonce this response's policy names, or `undefined` when it names none. */
		nonce: string | undefined;
		children?: RemixNode;
	}

	/** What a descendant reads with `handle.context.get(CspNonce)`. */
	export interface Value {
		nonce: string | undefined;
	}
}

/**
 * Provides the nonce to every descendant and renders its children unchanged.
 *
 * @example <CspNonce nonce={ctx.securityHeaders.nonce}>{node}</CspNonce>
 */
export function CspNonce(handle: Handle<CspNonce.Props, CspNonce.Value>) {
	return () => {
		handle.context.set({ nonce: handle.props.nonce });
		return handle.props.children;
	};
}
