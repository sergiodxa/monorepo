/**
 * Tests the `/docs` controller: it lists every doc section (sourced from the shimmed
 * doc content) inside the shared `DocsLayout` chrome, with a link to at least one real
 * doc page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { Middleware } from "remix/fetch-router";
import type { Renderer } from "remix/render-middleware";
import type { RemixNode } from "remix/ui";

import { ServiceContainer } from "@pkg/service-container";
import { plugin } from "bun";
import { Glob } from "bun";
import { asyncContext } from "remix/async-context-middleware";
import { Auth } from "remix/auth-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { renderWith } from "remix/render-middleware";
import { renderToString } from "remix/ui/server";

import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import routes from "~/routes/web";

/**
 * `import.meta.glob` is a Vite build-time feature with no plain-`bun test` equivalent,
 * so this shim patches the one call in `~/app/services/docs.ts` (reached transitively
 * through this controller) out for a plain object of thunks that resolve real file
 * content read via `node:fs`, before that module is ever imported.
 */
plugin({
	name: "docs-glob-shim",
	setup(build) {
		build.onLoad({ filter: /app\/services\/docs\.ts$/ }, (args) => {
			let source = readFileSync(args.path, "utf8");
			let docsDir = join(dirname(args.path), "../../resources/docs");
			let glob = new Glob("**/*.md");
			let entries: string[] = [];
			for (let file of glob.scanSync({ cwd: docsDir })) entries.push(file);
			let objectEntries = entries.map((rel) => {
				let content = readFileSync(join(docsDir, rel), "utf8");
				let key = `../../resources/docs/${rel}`;
				return `${JSON.stringify(key)}: () => Promise.resolve(${JSON.stringify(content)})`;
			});
			let replacement = `const docFileLoaders = {${objectEntries.join(",")}};`;
			let patched = source.replace(
				/const docFileLoaders = import\.meta\.glob<string>\(\s*"\.\.\/\.\.\/resources\/docs\/\*\*\/\*\.md",\s*\{[\s\S]*?\}\s*\);/,
				replacement,
			);
			if (patched === source) {
				throw new Error(
					"glob shim: replacement pattern did not match — check docs.ts hasn't changed shape",
				);
			}
			return { contents: patched, loader: "tsx" };
		});
	},
});

let { default: docsIndex } = await import("./docs-index");

/** Renders through `renderToString` — this page renders no `<Frame>`, so no `resolveFrame` is needed. */
function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let html = await renderToString(node);
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/** Dispatches a real GET request to `/docs` as an anonymous visitor. */
async function getDocsIndex() {
	let { db } = createTestDatabase();
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [
			asyncContext(),
			(ctx, next) => {
				ctx.set(Auth, { ok: false });
				return next();
			},
			i18n as Middleware,
			renderWith(createTestRenderer) as Middleware,
		],
	});
	router.map(routes.docs.index, docsIndex);

	let request = new Request(`https://uptime.test${routes.docs.index.href()}`);
	return container.scope(() => router.fetch(request));
}

describe("GET /docs", () => {
	test("renders the docs index with a link to a real doc page", async () => {
		let response = await getDocsIndex();

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("<title>Documentation | Uptime</title>");
		expect(body).toContain("<h1>Documentation</h1>");
		expect(body).toContain('href="/docs/overview"');
	});
});
