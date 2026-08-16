/**
 * Tests the `/docs/*slug` controller: a real slug (sourced from the shimmed doc
 * content) renders its parsed Markdoc content inside the shared `DocsLayout` chrome
 * along with a canonical link and its frontmatter description in `<head>`, and an
 * unknown slug renders the same not-found page the router's `defaultHandler` uses —
 * with no canonical link, since a 404 is not an indexable document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { Renderer } from "remix/middleware/render";
import type { Middleware } from "remix/router";
import type { RemixNode } from "remix/ui";

import { ServiceContainer } from "@pkg/service-container";
import { plugin } from "bun";
import { Glob } from "bun";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { renderToString } from "remix/ui/server";

import i18n from "~/app/http/middleware/i18n";
import { SEO } from "~/app/lib/seo";
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

let { default: docsShow } = await import("./docs-show");

/** Renders through `renderToString` — this page renders no `<Frame>`, so no `resolveFrame` is needed. */
function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let html = await renderToString(node);
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/** Dispatches a real GET request to `/docs/*slug` as an anonymous visitor. */
async function getDocsShow(slug: string) {
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
	router.map(routes.docs.show, docsShow);

	let request = new Request(`https://uptime.test${routes.docs.show.href({ slug })}`);
	return container.scope(() => router.fetch(request));
}

describe("GET /docs/*slug", () => {
	test("renders a real doc's frontmatter and parsed content", async () => {
		let response = await getDocsShow("overview");

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("<title>Overview | Documentation - Uptime</title>");
		expect(body).toContain(">Overview</h1>");
		expect(body).toContain("Last updated: 2026-02-14");
		expect(body).toContain("Key Features");
	});

	test("emits the canonical URL and the doc's own frontmatter description in <head>", async () => {
		let response = await getDocsShow("overview");

		expect(response.status).toBe(200);
		let body = await response.text();
		// Canonical is normalized onto the product's own origin, not the request host.
		expect(body).toContain(
			`<link rel="canonical" href="${SEO.baseUrl}${routes.docs.show.href({ slug: "overview" })}" />`,
		);
		expect(body).toContain(
			'<meta name="description" content="Monitor your websites, APIs, servers, and scheduled tasks. Get alerted when something goes wrong and share status with your users." />',
		);
	});

	test("marks the current page's sidebar link active and builds a docs > ... breadcrumb", async () => {
		let response = await getDocsShow("concepts/http-monitors");

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain('href="/docs/concepts/http-monitors" aria-current="page"');
		expect(body).toContain(">docs<");
		expect(body).toContain(">concepts<");
		expect(body).toContain(">http monitors<");
	});

	test("only links the docs root breadcrumb — intermediate path segments have no real page", async () => {
		let response = await getDocsShow("api/resources/http-monitors");

		expect(response.status).toBe(200);
		let body = await response.text();

		// "docs" links to the docs index, since it's a real page.
		expect(body).toContain(`href="${routes.docs.index.href()}"`);
		// "api" and "resources" are directory groupings with no page of their own —
		// they must not be rendered as links to `/docs/api` or `/docs/api/resources`.
		expect(body).not.toContain('href="/docs/api"');
		expect(body).not.toContain('href="/docs/api/resources"');
	});

	test("renders the signed-out dashboard CTA as a sign-in button", async () => {
		let response = await getDocsShow("overview");

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("Start Monitoring");
	});

	test("renders the not-found page for an unknown slug", async () => {
		let response = await getDocsShow("does-not-exist");

		expect(response.status).toBe(404);
		let body = await response.text();
		expect(body).toContain("<title>Page Not Found | Documentation - Uptime</title>");
		expect(body).toContain("<h1>Page Not Found</h1>");
		expect(body).toContain("The documentation page you're looking for doesn't exist.");
		// A 404 must not advertise itself as a canonical, indexable document.
		expect(body).not.toContain('rel="canonical"');
	});
});
