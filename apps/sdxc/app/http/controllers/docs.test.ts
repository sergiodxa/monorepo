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

import { fetchApp } from "~/app/lib/test/router";
import { listGuides } from "~/app/services/docs";
import { listPackages } from "~/app/services/packages";

describe("GET /docs", () => {
	test("routes by intent, one card per guide section", async () => {
		let sections = await listGuides();
		let body = await (await fetchApp("/docs")).text();

		expect(sections.length).toBeGreaterThan(0);
		for (let section of sections) expect(body).toContain(section.title.replaceAll("&", "&amp;"));
		expect(body).toContain("Browse the packages");
	});

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
