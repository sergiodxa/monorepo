/**
 * Tests the `/sitemap.xml` controller: it responds with the `xml()` helper's
 * content type and includes the homepage, at least one real `/features`, `/for`,
 * and `/vs` marketing page (sourced from `resources/content/marketing.ts`), the
 * legal pages, and at least one real `/docs/*` page sourced from the shimmed doc
 * content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { plugin } from "bun";
import { Glob } from "bun";
import { createRouter } from "remix/router";

import routes from "~/routes/web";

/**
 * `import.meta.glob` is a Vite build-time feature with no plain-`bun test` equivalent,
 * so this shim patches the one call in `~/app/services/docs.ts` (reached transitively
 * through the sitemap controller) out for a plain object of thunks that resolve real
 * file content read via `node:fs`, before that module is ever imported.
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

let { default: sitemap } = await import("./sitemap");
let { audiences, comparisons, features } = await import("~/resources/content/marketing");

/** Dispatches a real GET request through the sitemap action, router, and route table. */
async function getSitemap() {
	let router = createRouter();
	router.map(routes.sitemap, sitemap);

	let request = new Request(`https://uptime.test${routes.sitemap.href()}`);
	return router.fetch(request);
}

describe("GET /sitemap.xml", () => {
	test("responds with the xml() helper's content type", async () => {
		let response = await getSitemap();

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("text/xml");
	});

	test("includes the homepage", async () => {
		let response = await getSitemap();
		let body = await response.text();

		expect(body).toContain(`<loc>https://uptime.test${routes.home.href()}</loc>`);
	});

	test("includes real /features, /for, and /vs marketing pages", async () => {
		let response = await getSitemap();
		let body = await response.text();

		let featureSlug = Object.keys(features)[0];
		let audienceSlug = Object.keys(audiences)[0];
		let comparisonSlug = Object.keys(comparisons)[0];
		if (!featureSlug || !audienceSlug || !comparisonSlug) {
			throw new Error("expected at least one feature, audience, and comparison page");
		}

		expect(body).toContain(
			`<loc>https://uptime.test${routes.marketing.feature.href({ slug: featureSlug })}</loc>`,
		);
		expect(body).toContain(
			`<loc>https://uptime.test${routes.marketing.audience.href({ slug: audienceSlug })}</loc>`,
		);
		expect(body).toContain(
			`<loc>https://uptime.test${routes.marketing.comparison.href({ slug: comparisonSlug })}</loc>`,
		);
	});

	test("includes the legal pages", async () => {
		let response = await getSitemap();
		let body = await response.text();

		expect(body).toContain(`<loc>https://uptime.test${routes.legal.privacy.href()}</loc>`);
		expect(body).toContain(`<loc>https://uptime.test${routes.legal.terms.href()}</loc>`);
	});

	test("includes a real /docs page sourced from the shimmed doc content", async () => {
		let response = await getSitemap();
		let body = await response.text();

		expect(body).toContain("<loc>https://uptime.test/docs/overview</loc>");
	});
});
