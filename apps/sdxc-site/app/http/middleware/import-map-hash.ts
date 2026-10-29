/**
 * Admits the document's inline import map under the Content-Security-Policy by its SHA-256
 * hash. A page is stored by shared caches and revalidated by tag, so one copy reaches many
 * readers byte for byte and its script carries no nonce; the build's import map keeps the hash stable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ScriptEntry } from "@pitlane/assets";
import type { SecurityHeaders } from "@sdxc/security-headers";
import type { Middleware } from "remix/router";

import { Base64, sha256 } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";

/** The CSP headers whose `script-src` the hash joins. */
const POLICY_HEADERS = ["contentSecurityPolicy", "contentSecurityPolicyReportOnly"] as const;

/**
 * The import map's text exactly as `remix/component` writes it into the `<script>`, where a `<`
 * is escaped so the JSON cannot close the tag early; the hash covers these bytes.
 *
 * @param importMap The client import map the document renders.
 */
export function serializeImportMap(importMap: ScriptEntry["importMap"]): string {
	return JSON.stringify(importMap).replace(/</g, "\\u003c");
}

/**
 * Appends the import map's `sha256-…` source to `script-src` in each CSP the response carries,
 * once `assets()` and `securityHeaders()` have published their state. A policy without a
 * `script-src` keeps its `default-src` fallback as written.
 */
export default function importMapHash(): Middleware {
	return async (ctx, next) => {
		let digest = await sha256(serializeImportMap(ctx.assets.script.importMap));
		if (isFailure(digest)) return next();

		let source = `sha256-${Base64.encode(digest.data)}` as const;
		let policy = ctx.securityHeaders.policy;
		let patch: SecurityHeaders.Override = {};
		for (let header of POLICY_HEADERS) {
			let scriptSrc = policy[header]?.scriptSrc;
			if (scriptSrc) patch[header] = { scriptSrc: [...scriptSrc, source] };
		}
		ctx.securityHeaders.override(patch);

		return next();
	};
}
