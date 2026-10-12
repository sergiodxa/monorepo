/**
 * Router middleware resolving the stylesheets and client entry a document shell links, once per
 * request, and publishing them on the request context as `ctx.assets`, so every route hands its
 * document the same lookup and a test installs its own by passing a different resolver.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ScriptEntry } from "@pitlane/assets";
import type { Middleware, RequestContext } from "remix/router";

import { createContextKey } from "remix/router";

declare module "remix/router" {
	interface RequestContext {
		/** The document assets the `assets()` middleware resolved for this request. */
		assets: DocumentAssets;
	}
}

/** What a document shell links for the request being answered. */
export interface DocumentAssets {
	/** Stylesheet URLs, in the order the modules import them, which is the cascade order. */
	stylesheets: string[];
	/** The client entry's URL, the chunks it preloads, and the import map they resolve by. */
	script: ScriptEntry;
	/**
	 * The CSP nonce the inline import map carries, or `undefined` when the app supplied none. It
	 * is read on first access, so a response that renders no document never asks for one.
	 */
	readonly nonce?: string;
}

/**
 * The lookups the middleware makes, which an `@pitlane/assets` resolver built from the app's own
 * manifest satisfies, so the app constructs it once over the manifest its build provides.
 */
export interface DocumentAssetsResolver {
	/** Stylesheets the given modules need, in import order. */
	getStylesheets(path: string | readonly string[]): Promise<string[]>;
	/** The browser entry's URL, its preloads, and the client import map. */
	getScriptEntry(path: string): Promise<ScriptEntry>;
}

/** Which modules the document links, as source paths relative to the app's root. */
export interface AssetsOptions {
	/** The module, or modules, whose stylesheets every document links. */
	stylesheets: string | readonly string[];
	/** The browser entry the document loads. */
	script: string;
	/**
	 * Reads the nonce the inline import map needs under the app's Content-Security-Policy. It runs
	 * the first time `ctx.assets.nonce` is read, at most once per request, so a response that
	 * renders no document leaves a lazily generated nonce unrequested.
	 */
	nonce?: (ctx: RequestContext) => string | undefined;
}

/**
 * Reads the published assets by key, for code holding a context whose middleware chain is not
 * known. The type is written out because an exported key needs a nameable type to reach a
 * published declaration file.
 */
export const Assets: { defaultValue?: DocumentAssets } = createContextKey<DocumentAssets>();

/** How `assets()` installs the value on the context. */
const ASSETS_PROPERTY = { property: "assets" } as const;

/**
 * Creates middleware that resolves the document's stylesheets and script entry, both lookups in
 * parallel, before the rest of the chain runs, and publishes them as `ctx.assets` and under the
 * {@link Assets} key. A resolver rejection rejects the request.
 *
 * @param resolver The app's asset resolver, usually `createAssetResolver(manifest)`.
 * @param options The source paths to resolve and the optional nonce reader.
 * @returns Middleware whose context transform types `ctx.assets` on a router built from it.
 * @example assets(resolver, { stylesheets: "resources/layouts/document.tsx", script: "bootstrap/browser.ts" })
 */
export function assets(
	resolver: DocumentAssetsResolver,
	options: AssetsOptions,
): Middleware<{ key: typeof Assets; value: DocumentAssets; property: "assets" }> {
	return async (ctx, next) => {
		let [stylesheets, script] = await Promise.all([
			resolver.getStylesheets(options.stylesheets),
			resolver.getScriptEntry(options.script),
		]);
		let readNonce = options.nonce;
		let nonce: { value: string | undefined } | undefined;
		let value: DocumentAssets = {
			stylesheets,
			script,
			get nonce() {
				nonce ??= { value: readNonce?.(ctx) };
				return nonce.value;
			},
		};

		ctx.set(Assets, value, ASSETS_PROPERTY);
		return next();
	};
}
