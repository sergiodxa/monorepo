/**
 * Patches Content-Security-Policy headers Remix's `csp()` already wrote, so a handler can still
 * widen `frame-src` for front-channel logout or admit an import-map hash after the policy was
 * serialized. Place `cspPatch()` *before* `csp()` in the middleware stack so it wraps the
 * response after Remix appends the headers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ContentSecurityPolicyInit } from "remix/headers/content-security-policy";
import type { Middleware } from "remix/router";

import { isSuccess } from "@sdxc/result";
import { createContextKey } from "remix/router";

import type { CSP } from "./lib/types.js";

import { merge, parse, stringify } from "./csp.js";

/**
 * Directives merged into a Remix CSP header: this package's unquoted override, Remix's quoted
 * `ContentSecurityPolicyInit` (e.g. from `remixCsp`), or either with `null` removals.
 */
export type CspHeaderPatch =
	| CSP.Override
	| ContentSecurityPolicyInit
	| { [K in keyof ContentSecurityPolicyInit]?: ContentSecurityPolicyInit[K] | null };

/** A patch against the enforced and/or Report-Only header Remix sent. */
export interface CspPatch {
	/** Merged into `Content-Security-Policy`; `null` removes that header. */
	policy?: CspHeaderPatch | null;
	/** Merged into `Content-Security-Policy-Report-Only`; `null` removes that header. */
	reportOnlyPolicy?: CspHeaderPatch | null;
}

/** Accumulated patches for this response. */
interface CspPatchState {
	patch: CspPatch;
}

/** Context key holding CSP header patches applied after Remix `csp()`. */
export const CspPatchKey: { defaultValue?: CspPatchState } = createContextKey<CspPatchState>();

/**
 * The slice of a request context `patchCsp` reads: every router flavor carries `has`/`get`
 * whatever entries its middleware chain has added.
 */
export interface CspPatchContext {
	/**
	 * Whether `cspPatch()` installed the patch bag on this request.
	 *
	 * @param key - {@link CspPatchKey}
	 */
	has(key: typeof CspPatchKey): boolean;
	/**
	 * The patch bag `cspPatch()` published, when installed.
	 *
	 * @param key - {@link CspPatchKey}
	 */
	get(key: typeof CspPatchKey): { patch: CspPatch } | undefined;
}

/**
 * Rewrites Remix CSP headers using every `patchCsp` call made during the request. Install it
 * before `csp()` so the response it sees already carries those headers.
 *
 * @returns The middleware
 * @example createRouter({ middleware: [cspPatch(), csp({ policy: … }), securityHeaders(…), render()] })
 */
export function cspPatch(): Middleware {
	return async (ctx, next) => {
		ctx.set(CspPatchKey, { patch: {} });
		let response = await next();
		let state = ctx.get(CspPatchKey);
		if (!state) return response;

		let { policy, reportOnlyPolicy } = state.patch;
		if (policy === undefined && reportOnlyPolicy === undefined) return response;

		let headers = new Headers(response.headers);
		applyHeaderPatch(headers, "content-security-policy", policy);
		applyHeaderPatch(headers, "content-security-policy-report-only", reportOnlyPolicy);
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	};
}

/**
 * Queues a CSP header patch for this response. No-op when `cspPatch()` is not installed.
 *
 * @param ctx - The request context
 * @param patch - Directives to merge, or `null` to drop that header
 */
export function patchCsp(ctx: CspPatchContext, patch: CspPatch): void {
	if (!ctx.has(CspPatchKey)) return;
	let state = ctx.get(CspPatchKey);
	if (!state) return;

	state.patch = {
		policy: combine(state.patch.policy, patch.policy),
		reportOnlyPolicy: combine(state.patch.reportOnlyPolicy, patch.reportOnlyPolicy),
	};
}

/**
 * Merges two patch layers: a later `null` clears, a later object merges into the earlier one.
 */
function combine(
	current: CspHeaderPatch | null | undefined,
	next: CspHeaderPatch | null | undefined,
): CspHeaderPatch | null | undefined {
	if (next === undefined) return current;
	if (next === null) return null;
	if (current === undefined || current === null) return next;
	return { ...current, ...next } as CspHeaderPatch;
}

/**
 * Applies one patch to one CSP header on the response.
 */
function applyHeaderPatch(
	headers: Headers,
	name: string,
	patch: CspHeaderPatch | null | undefined,
): void {
	if (patch === undefined) return;
	if (patch === null) {
		headers.delete(name);
		return;
	}

	let existing = headers.get(name) ?? "";
	let parsed = parse(existing);
	let base: CSP.Directives = {};
	if (isSuccess(parsed) && parsed.data[0]) {
		base = parsed.data[0].directives;
	}
	let merged = merge(base, patch as CSP.Override);
	let value = stringify(merged);
	if (value === "") headers.delete(name);
	else headers.set(name, value);
}
