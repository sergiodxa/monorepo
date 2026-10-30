/**
 * Tests for the `/docs` tree. Every page here is rendered from files in the bundle,
 * so these assertions are what keep a guide whose frontmatter drifted, a package
 * whose README stopped parsing, or a link that stopped being rewritten from reaching
 * a reader as a blank section or a 500.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { listGuides, readGuide } from "~/app/services/docs";
import { listPackages } from "~/app/services/packages";
import { fetchApp } from "~/app/test/router";
import routes from "~/routes/web";

/**
 * Every guide's slug, read once so each guide becomes its own test: one test per guide keeps
 * each within the time limit however many guides the site holds, and names the guide that broke.
 */
const GUIDE_SLUGS = (await listGuides()).flatMap((section) =>
	section.guides.map((guide) => guide.slug),
);

/** Pages under `/docs` served by their own route, which a guide may link to like a guide. */
const ROUTED_DOCS_PAGES = [routes.docs.changelog.href()];

/** Rendered guides by slug, so the link checks render each target page once across tests. */
const RENDERED = new Map<string, Promise<{ status: number; body: string }>>();

/** The guide at `slug` as the router answers it, rendered on first use and shared after. */
function renderGuide(slug: string): Promise<{ status: number; body: string }> {
	let rendered = RENDERED.get(slug);
	if (rendered === undefined) {
		rendered = fetchApp(`/docs/${slug}`).then(async (response) => ({
			status: response.status,
			body: await response.text(),
		}));
		RENDERED.set(slug, rendered);
	}
	return rendered;
}

describe("GET /docs", () => {
	test("routes by intent, one card per guide section", async () => {
		let sections = await listGuides();
		let body = await (await fetchApp("/docs")).text();

		expect(sections.length).toBeGreaterThan(0);
		for (let section of sections) expect(body).toContain(section.title.replaceAll("&", "&amp;"));
		expect(body).toContain("Browse the packages");
	});

	test.each(GUIDE_SLUGS)("guide %s parses and renders", async (slug) => {
		expect((await renderGuide(slug)).status).toBe(200);
	});

	test.each(GUIDE_SLUGS)("guide %s ends with where to go next, linking on", async (slug) => {
		let source = (await readGuide(slug)) ?? "";
		let headings = [...source.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
		let last = source.slice(source.lastIndexOf("\n## "));

		expect(headings.at(-1)).toBe("Where to go next");
		expect(last).toMatch(/\]\(\/(docs|api)\//);
	});

	test.each(GUIDE_SLUGS)(
		"every link in guide %s reaches a guide and a heading on it",
		async (slug) => {
			let body = (await renderGuide(slug)).body;
			let article = body.slice(body.indexOf("<article"), body.indexOf("</article>"));
			let broken: string[] = [];
			for (let [, target = "", fragment] of article.matchAll(
				/href="\/docs\/([^"#?]+)(?:#([^"]+))?"/g,
			)) {
				if (target.endsWith(".md")) continue;
				if (ROUTED_DOCS_PAGES.includes(`/docs/${target}`)) continue;
				if (!GUIDE_SLUGS.includes(target)) broken.push(`/docs/${target}`);
				else if (fragment && !(await renderGuide(target)).body.includes(`id="${fragment}"`)) {
					broken.push(`/docs/${target}#${fragment}`);
				}
			}

			expect(broken).toEqual([]);
		},
	);

	test("every card leads somewhere that answers", async () => {
		let sections = await listGuides();

		for (let section of sections) {
			let first = section.guides.at(0);
			expect(first).toBeDefined();
			let response = await fetchApp(`/docs/${first?.slug}`);
			expect(response.status).toBe(200);
		}
	});
});

describe("GET /docs/*slug", () => {
	test("renders a guide with its own frontmatter as the page's chrome", async () => {
		let response = await fetchApp("/docs/getting-started/what-these-are");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("What these are");
		expect(body).toContain("On this page");
	});

	test("counts the collection rather than quoting a written-down number", async () => {
		let body = await (await fetchApp("/docs/getting-started/what-these-are")).text();

		expect(body).not.toContain("$packageCount");
		expect(body).toContain(`${listPackages().length} packages published under one npm scope`);
	});

	test("answers 404 for a slug no file owns", async () => {
		expect((await fetchApp("/docs/nothing/here")).status).toBe(404);
	});

	test("lists what a reader will know under the title, with its code spans set as code", async () => {
		let body = await (await fetchApp("/docs/sdxc/deploy")).text();

		expect(body).toContain("After reading this guide, you will know");
		expect(body).toContain("<code>sdxc deploy</code> builds, migrates and deploys");
	});

	test("draws a note and a warning alert as labelled asides rather than as a quote", async () => {
		let body = await (await fetchApp("/docs/sdxc/deploy")).text();

		expect(body).toContain('aria-label="Note"');
		expect(body).toContain('aria-label="Warning"');
		expect(body).not.toContain("[!WARNING]");
	});
});

describe("GET /api", () => {
	test("lists every published package", async () => {
		let body = await (await fetchApp("/api")).text();

		for (let entry of listPackages()) expect(body).toContain(entry.name);
	});
});

describe("GET /api/:name", () => {
	test("frames the README with what the manifest knows", async () => {
		let response = await fetchApp("/api/markdown");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("npm add @sdxc/markdown");
		expect(body).toContain("@sdxc/markdown/remix");
		expect(body).toContain("uptime");
	});

	test("installs a package by its own name with the peers it needs", async () => {
		let body = await (await fetchApp("/api/http")).text();

		expect(body).toContain("npm add @sdxc/http remix");
		expect(body).not.toContain("Through sdxc");
	});

	test("has no package page for a bare sdxc name", async () => {
		let page = await fetchApp("/api/sdxc");
		let index = await (await fetchApp("/api")).text();

		expect(page.status).toBe(404);
		expect(index).not.toContain('href="/api/sdxc"');
	});

	test("rewrites a sibling's npm link to its page here", async () => {
		let body = await (await fetchApp("/api/markdown")).text();

		expect(body).toContain('href="/api/result"');
		expect(body).not.toContain("npmjs.com/package/@sdxc/result");
	});

	test("leaves a link outside the collection alone", async () => {
		let body = await (await fetchApp("/api/markdown")).text();

		expect(body).toContain("npmjs.com/package/remix");
	});

	test("answers a catalogue package with its own index rather than its README", async () => {
		let response = await fetchApp("/api/u");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain('href="/api/u/p"');
		expect(body).toContain('href="/api/u/hover"');
	});

	test("answers 404 for a directory that publishes nothing", async () => {
		expect((await fetchApp("/api/blog-engine")).status).toBe(404);
	});

	test("indexes @sdxc/ui's subpaths beside its components", async () => {
		let body = await (await fetchApp("/api/ui")).text();

		expect(body).toContain('href="/api/ui/badge"');
		expect(body).toContain('href="/api/ui/mixins/hotkey"');
		expect(body).toContain('href="/api/ui/behaviors/toaster"');
		expect(body).toContain('href="/api/ui/animations/fade"');
		expect(body).toContain('href="/api/ui/styles/panel-chrome"');
	});
});

describe("GET /api/ui/:subpath/:slug", () => {
	test("renders an export with its signature and what it is used with", async () => {
		let response = await fetchApp("/api/ui/mixins/copy-to-clipboard");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("@sdxc/ui/mixins");
		expect(body).toContain('id="export-copyevent"');
	});

	test("answers 404 for a subpath or a slug the package does not publish", async () => {
		expect((await fetchApp("/api/ui/widgets/hotkey")).status).toBe(404);
		expect((await fetchApp("/api/ui/mixins/not-a-mixin")).status).toBe(404);
	});
});

describe("sidebars", () => {
	/** The hrefs the docked rail links to, which is the first of the two copies drawn. */
	function sidebarHrefs(body: string): string[] {
		let rail = body.slice(body.indexOf("<nav"), body.indexOf("</nav>"));
		return [...rail.matchAll(/href="([^"]+)"/g)].map((match) => match[1] ?? "");
	}

	test("draws only guides beside a guide", async () => {
		let body = await (await fetchApp("/docs/getting-started/what-these-are")).text();
		let hrefs = sidebarHrefs(body);

		expect(hrefs).toContain("/docs/releases/changelog");
		expect(hrefs.some((href) => href.startsWith("/api"))).toBe(false);
	});

	test("draws every package but the catalogues beside a package", async () => {
		let hrefs = sidebarHrefs(await (await fetchApp("/api/result")).text());

		expect(hrefs).toContain("/api/markdown");
		expect(hrefs).not.toContain("/api/u");
		expect(hrefs).not.toContain("/api/ui");
		expect(hrefs.some((href) => href.startsWith("/docs"))).toBe(false);
	});

	test("draws @sdxc/u's own tree beside a utility, and @sdxc/ui's beside a component", async () => {
		let utility = sidebarHrefs(await (await fetchApp("/api/u/p")).text());
		let component = sidebarHrefs(await (await fetchApp("/api/ui/theming")).text());
		let mixin = sidebarHrefs(await (await fetchApp("/api/ui/mixins/hotkey")).text());

		expect(utility.length).toBeGreaterThan(0);
		for (let href of utility) expect(href).toMatch(/^\/api\/u(\/|$)/);

		expect(component.length).toBeGreaterThan(0);
		for (let href of component) expect(href).toMatch(/^\/api\/ui(\/|$)/);
		expect(mixin).toEqual(component);
	});
});

describe("GET /docs/packages/*path", () => {
	test("sends the old package addresses to the same path under /api", async () => {
		for (let [from, to] of [
			["/docs/packages", "/api"],
			["/docs/packages/result", "/api/result"],
			["/docs/packages/result.md", "/api/result.md"],
			["/docs/packages/u/p", "/api/u/p"],
		]) {
			let response = await fetchApp(from ?? "");
			expect(response.status).toBe(301);
			expect(response.headers.get("Location")).toBe(to);
		}
	});
});

describe("caching", () => {
	test("answers a client whose copy is current with a 304", async () => {
		let first = await fetchApp("/docs");
		let tag = first.headers.get("ETag");

		expect(first.headers.get("Cache-Control")).toContain("public");
		expect(tag).not.toBeNull();

		let second = await fetchApp("/docs", { headers: { "If-None-Match": tag ?? "" } });
		expect(second.status).toBe(304);
	});
});
