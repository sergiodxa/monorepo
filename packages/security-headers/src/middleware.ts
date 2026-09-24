/**
 * Router middleware that applies a security header policy to every response, publishing
 * `ctx.securityHeaders` so a handler reads the response's nonce and patches the policy, and a
 * route-level middleware that declares a route's exceptions where the route is defined.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Middleware } from "remix/router";

import { createContextKey } from "remix/router";

import type { SecurityHeaders } from "./lib/types.js";

import { generateNonce } from "./csp.js";

import { apply, override as overridePolicy } from "./index.js";

/**
 * Declared in an imported module, so a project types `ctx.securityHeaders` by importing this
 * middleware.
 */
declare module "remix/router" {
	interface RequestContext {
		/** This response's nonce and policy, published by `securityHeaders(policy)`. */
		securityHeaders: SecurityHeadersContext;
	}
}

/** What a handler reads and changes about the headers its response will be sent with. */
export interface SecurityHeadersContext {
	/**
	 * This response's nonce, generated on first read. A response that never reads it gets a
	 * policy with every `"nonce"` source removed, so an unused nonce is never advertised. Read it
	 * before the handler returns: the headers are written once the chain resolves, ahead of a
	 * streamed body.
	 */
	readonly nonce: string;
	/** The policy this response will be sent with, including every patch applied so far. */
	readonly policy: SecurityHeaders.Policy;
	/**
	 * Patches this response's policy; a CSP patch merges directive by directive.
	 *
	 * @param patch - Headers to change (a value) or leave unsent (`null`)
	 */
	override(patch: SecurityHeaders.Override): void;
}

/**
 * The request's security header state, for code that reads it by key rather than through the
 * installed `securityHeaders` property. The type is written out because an exported key needs a
 * nameable type to reach a published declaration file.
 */
export const SecurityHeadersKey: { defaultValue?: SecurityHeadersContext } =
	createContextKey<SecurityHeadersContext>();

/** Installs the state as `ctx.securityHeaders` besides the key. */
const SECURITY_HEADERS_PROPERTY = { property: "securityHeaders" } as const;

/** Switching Protocols carries a live connection (a WebSocket) that rebuilding would detach. */
const SWITCHING_PROTOCOLS = 101;

/**
 * Publishes `ctx.securityHeaders` and applies the resulting policy to the response the
 * chain returns, keeping any header the response set itself. Place it immediately before the
 * renderer, so the response it decorates is the one the renderer produced.
 *
 * @param policy - The app's policy, shared by every request and never mutated
 * @returns The middleware
 * @example createRouter({ middleware: [securityHeaders(SECURITY_POLICY), renderWith(render)] })
 */
export function securityHeaders(policy: SecurityHeaders.Policy): Middleware<{
	key: typeof SecurityHeadersKey;
	value: SecurityHeadersContext;
	property: "securityHeaders";
}> {
	return async (ctx, next) => {
		let current = policy;
		let nonce: string | undefined;
		let state: SecurityHeadersContext = {
			get nonce() {
				nonce ??= generateNonce();
				return nonce;
			},
			get policy() {
				return current;
			},
			override(patch) {
				current = overridePolicy(current, patch);
			},
		};
		ctx.set(SecurityHeadersKey, state, SECURITY_HEADERS_PROPERTY);

		let response = await next();
		if (response.status === SWITCHING_PROTOCOLS) return response;

		let headers = new Headers(response.headers);
		apply(headers, current, nonce === undefined ? { url: ctx.url } : { url: ctx.url, nonce });
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	};
}

/**
 * Controller or action middleware applying `patch` for the routes it guards, so a route states
 * its own exception (`frameAncestors: ["*"]` for an embeddable page) next to its handler. It
 * passes through untouched when `securityHeaders` is not installed.
 *
 * @param patch - Headers to change (a value) or leave unsent (`null`) on these routes
 * @returns The middleware
 * @example createAction(route, { middleware: [securityHeadersOverride({ contentSecurityPolicy: { frameAncestors: ["*"] } })], handler })
 */
export function securityHeadersOverride(patch: SecurityHeaders.Override): Middleware {
	return (ctx, next) => {
		if (ctx.has(SecurityHeadersKey)) ctx.get(SecurityHeadersKey)?.override(patch);
		return next();
	};
}
