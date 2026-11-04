/**
 * Admits the document's inline import map under the Content-Security-Policy by its SHA-256
 * hash. The edge cache replays a stored page to every visitor byte for byte, so the script
 * carries no nonce; the build's import map is the same on every page, which keeps the hash stable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ScriptEntry } from "@pitlane/assets";
import type { Middleware } from "remix/router";

import { Base64, sha256 } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { patchCsp } from "@sdxc/security-headers/csp-patch";

import { CONTENT_SECURITY_POLICY } from "~/config/security-policy";

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
 * Appends the import map's `sha256-…` source to the Report-Only `script-src` Remix already
 * wrote, once `assets()` has published the import map. A policy without a `script-src` keeps
 * its `default-src` fallback as written.
 */
export default function importMapHash(): Middleware {
	return async (ctx, next) => {
		let digest = await sha256(serializeImportMap(ctx.assets.script.importMap));
		if (isFailure(digest)) return next();

		let source = `sha256-${Base64.encode(digest.data)}` as const;
		patchCsp(ctx, {
			reportOnlyPolicy: {
				scriptSrc: [...(CONTENT_SECURITY_POLICY.scriptSrc ?? []), source],
			},
		});

		return next();
	};
}
