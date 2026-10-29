/**
 * Tests the import map hash: the `sha256-…` source joined to the Report-Only `script-src`
 * matches the bytes `remix/component` renders inside the import map `<script>`, so a browser
 * admits the inline script without a nonce.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { assets } from "@sdxc/assets-middleware";
import { Base64, sha256 } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";
import { securityHeaders } from "@sdxc/security-headers/middleware";
import { ImportMap, renderToString } from "remix/component/server";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import importMapHash from "~/app/http/middleware/import-map-hash";
import { SECURITY_POLICY } from "~/config/security-policy";

/** An import map whose address holds a `<`, which the renderer escapes before writing it. */
const IMPORT_MAP = { imports: { "/assets/a<b.js": "/assets/a<b-123.js" } };

/** Answers `/` with a document rendering {@link IMPORT_MAP} through the hash middleware. */
function createTestRouter() {
	let router = createRouter({
		middleware: [
			securityHeaders(SECURITY_POLICY),
			assets(
				{
					getStylesheets: async () => [],
					getScriptEntry: async () => ({
						href: "/assets/browser.js",
						preloads: [],
						importMap: IMPORT_MAP,
					}),
				},
				{ stylesheets: "resources/layouts/document.tsx", script: "bootstrap/browser.ts" },
			),
			importMapHash(),
		],
	});
	router.get("/", async (ctx) => {
		let html = await renderToString(
			<html lang="en">
				<head>
					<ImportMap value={ctx.assets.script.importMap} />
				</head>
				<body />
			</html>,
		);
		return new Response(html, { headers: { "content-type": "text/html" } });
	});
	return router;
}

describe("importMapHash", () => {
	test("joins the hash of the rendered import map to the Report-Only script-src", async () => {
		let response = await createTestRouter().fetch("https://sdxc.dev/");
		let html = await response.text();
		let script = /<script data-rmx-import-map type="importmap">([^<]*)<\/script>/.exec(html)?.[1];
		expect(script).toBeDefined();

		let hash = Base64.encode(unwrap(await sha256(script ?? "")));
		let policy = response.headers.get("content-security-policy-report-only");
		let scriptSrc = policy
			?.split(";")
			.find((directive) => directive.trim().startsWith("script-src"));
		expect(scriptSrc).toContain(`'sha256-${hash}'`);
	});

	test("leaves the enforced policy unsent", async () => {
		let response = await createTestRouter().fetch("https://sdxc.dev/");

		expect(response.headers.get("content-security-policy")).toBeNull();
	});
});
