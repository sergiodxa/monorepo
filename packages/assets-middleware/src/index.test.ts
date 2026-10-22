/**
 * Tests for `assets()`, driven through a real `remix/router` over a stub resolver that records
 * every lookup, so what a handler reads off `ctx.assets` is what the resolver answered for the
 * paths the middleware was configured with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ScriptEntry } from "@pitlane/assets";

import { createRouter } from "remix/router";
import { describe, expect, expectTypeOf, test } from "vite-plus/test";

import type { DocumentAssets, DocumentAssetsResolver } from "./index.js";

import { Assets, assets } from "./index.js";

const SCRIPT: ScriptEntry = {
	href: "/assets/browser-abc.js",
	preloads: ["/assets/browser-abc.js", "/assets/chunk-def.js"],
	importMap: { imports: {} },
};

const OPTIONS = {
	stylesheets: "resources/layouts/document.tsx",
	script: "bootstrap/browser.ts",
};

/** A resolver answering fixed values and keeping the paths each lookup was asked for. */
function stubResolver() {
	let calls: { stylesheets: (string | readonly string[])[]; script: string[] } = {
		stylesheets: [],
		script: [],
	};
	let resolver: DocumentAssetsResolver = {
		async getStylesheets(path) {
			calls.stylesheets.push(path);
			return ["/assets/document-123.css"];
		},
		async getScriptEntry(path) {
			calls.script.push(path);
			return SCRIPT;
		},
	};
	return { resolver, calls };
}

describe(assets, () => {
	test("publishes the resolved assets as ctx.assets and under the Assets key", async () => {
		let { resolver } = stubResolver();
		let seen: DocumentAssets[] = [];
		let router = createRouter({ middleware: [assets(resolver, OPTIONS)] });
		router.get("/", (ctx) => {
			seen.push(ctx.assets);
			return new Response(String(ctx.get(Assets) === ctx.assets));
		});

		let response = await router.fetch("https://example.com/");

		expect(await response.text()).toBe("true");
		expect(seen).toEqual([{ stylesheets: ["/assets/document-123.css"], script: SCRIPT }]);
	});

	test("runs both lookups for the configured paths on every request", async () => {
		let { resolver, calls } = stubResolver();
		let router = createRouter({ middleware: [assets(resolver, OPTIONS)] });
		router.get("/", () => new Response("ok"));

		await router.fetch("https://example.com/");
		await router.fetch("https://example.com/");

		expect(calls).toEqual({
			stylesheets: [OPTIONS.stylesheets, OPTIONS.stylesheets],
			script: [OPTIONS.script, OPTIONS.script],
		});
	});

	test("includes the nonce the callback returns", async () => {
		let { resolver } = stubResolver();
		let router = createRouter({
			middleware: [assets(resolver, { ...OPTIONS, nonce: (ctx) => ctx.url.hostname })],
		});
		router.get("/", (ctx) => Response.json(ctx.assets));

		let response = await router.fetch("https://example.com/");

		expect(await response.json()).toMatchObject({ nonce: "example.com" });
	});

	test("reports no nonce when the callback returns none", async () => {
		let { resolver } = stubResolver();
		let router = createRouter({
			middleware: [assets(resolver, { ...OPTIONS, nonce: () => undefined })],
		});
		router.get("/", (ctx) => new Response(String(ctx.assets.nonce)));

		let response = await router.fetch("https://example.com/");

		expect(await response.text()).toBe("undefined");
	});

	/**
	 * A security-headers middleware generates its nonce on first read and advertises it only then,
	 * so a request whose response never renders a document must not read it.
	 */
	test("reads the nonce only when it is accessed, and only once", async () => {
		let { resolver } = stubResolver();
		let reads = 0;
		let router = createRouter({
			middleware: [
				assets(resolver, {
					...OPTIONS,
					nonce: () => {
						reads += 1;
						return "abc";
					},
				}),
			],
		});
		router.get("/json", () => Response.json({ ok: true }));
		router.get("/page", (ctx) => new Response(`${ctx.assets.nonce}:${ctx.assets.nonce}`));

		await router.fetch("https://example.com/json");
		expect(reads).toBe(0);

		let response = await router.fetch("https://example.com/page");
		expect(await response.text()).toBe("abc:abc");
		expect(reads).toBe(1);
	});

	test("types ctx.assets on a router derived from its middleware list", () => {
		let router = createRouter({ middleware: [assets(stubResolver().resolver, OPTIONS)] });
		router.get("/", (ctx) => {
			expectTypeOf(ctx.assets).toEqualTypeOf<DocumentAssets>();
			expectTypeOf(ctx.get(Assets)).toEqualTypeOf<DocumentAssets>();
			return new Response("ok");
		});
	});
});
