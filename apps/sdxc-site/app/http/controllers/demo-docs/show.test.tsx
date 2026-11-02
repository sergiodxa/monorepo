/**
 * Tests `GET /demo/docs/:site(/*page)` through the real router over every docs demo: each
 * hub and page answers `noindex`, every heading the rail lists exists on its page, search
 * finds a page by a heading's word, and a missing page answers the site's own 404.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parseDocument } from "@sdxc/html/document";
import { unwrap } from "@sdxc/result";
import { afterEach, describe, expect, test, vi } from "vitest";

import * as caching from "~/app/http/caching";
import { fetchApp } from "~/app/test/router";
import { demoDocsHref, findDemoDocsSite, listDemoDocsSlugs } from "~/resources/views/demo-docs";

/** Every demo's slug with its site, loaded once for the table-driven tests below. */
let sites = await Promise.all(
	listDemoDocsSlugs().map(async (slug) => ({ slug, site: (await findDemoDocsSite(slug))! })),
);

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
});

describe("GET /demo/docs/:site", () => {
	test("reuses a stored docs response through the streaming cache", async () => {
		vi.spyOn(caching, "withStreamCache").mockResolvedValue(new Response("cached docs"));
		let response = await fetchApp("/demo/docs/driftwood");

		expect(await response.text()).toBe("cached docs");
	});

	test.each(["", "/start/quickstart", "/search?q=deploy"])(
		"gives %s the shared cache policy and a working validator",
		async (path) => {
			vi.stubEnv("PROD", true);
			let href = `/demo/docs/driftwood${path}`;
			let response = await fetchApp(href);
			let tag = response.headers.get("ETag");

			expect(response.headers.get("Cache-Control")).toContain("public");
			expect(response.headers.get("Cache-Control")).toContain("s-maxage=3600");
			expect(tag).toBeTruthy();
			expect((await fetchApp(href, { headers: { "If-None-Match": tag! } })).status).toBe(304);
		},
	);

	test("keeps search, feedback and remembered-tab cache variants distinct", async () => {
		let edge = vi.spyOn(caching, "withStreamCache");
		let paths = [
			"/demo/docs/driftwood/search?q=deploy",
			"/demo/docs/driftwood/search?q=domain",
			"/demo/docs/driftwood/start/quickstart",
			"/demo/docs/driftwood/start/quickstart?feedback=sent",
		];
		let tags = [];
		for (let path of paths) tags.push((await fetchApp(path)).headers.get("ETag"));

		let picked = await fetchApp(paths[2]!, {
			headers: { Cookie: "ui-code-tabs.package-manager=bun" },
		});
		tags.push(picked.headers.get("ETag"));

		expect(tags.every(Boolean)).toBe(true);
		expect(new Set(tags).size).toBe(paths.length + 1);
		let variants = edge.mock.calls
			.filter(([request]) => new URL(request.url).pathname.startsWith("/demo/docs/"))
			.map(([, variant]) => variant);
		expect(new Set(variants).size).toBe(paths.length + 1);
	});

	test("keeps remembered package-manager HTML private", async () => {
		vi.stubEnv("PROD", true);
		let response = await fetchApp("/demo/docs/driftwood/start/quickstart", {
			headers: { Cookie: "ui-code-tabs.package-manager=bun" },
		});

		expect(response.headers.get("Cache-Control")).toContain("private");
		expect(response.headers.get("Cache-Control")).not.toContain("s-maxage");
		expect(response.headers.get("Vary")?.toLowerCase()).toContain("cookie");
		let page = unwrap(parseDocument(await response.text()));
		expect(page.querySelector('input[value="bun"]')?.hasAttribute("checked")).toBe(true);
	});
	test.each(sites)(
		"$slug's hub renders its start links and stays out of search",
		async ({ slug, site }) => {
			let response = await fetchApp(demoDocsHref(slug)());
			let body = await response.text();

			expect(response.status).toBe(200);
			expect(body).toMatch(/<meta name="robots" content="noindex, nofollow"/);
			for (let item of site.hub.start) expect(body).toContain(`href="${item.href}"`);
		},
	);

	test.each(sites)(
		"$slug's pages answer, and each rail heading exists on its page",
		async ({ slug, site }) => {
			for (let [path, page] of Object.entries(site.pages)) {
				let response = await fetchApp(demoDocsHref(slug)(path));
				let body = await response.text();

				expect(response.status, path).toBe(200);
				for (let item of page.toc) expect(body, `${path}#${item.id}`).toContain(`id="${item.id}"`);
			}
		},
	);

	test.each(sites)("every link in $slug's tree and next steps answers", async ({ slug, site }) => {
		let links = [
			...site.tree.sections.flatMap((section) => section.items.map((item) => item.href)),
			...Object.values(site.pages).flatMap((page) => (page.next ?? []).map((step) => step.href)),
			...site.hub.sections.map((section) => section.href),
		].filter((link): link is string => link !== undefined);

		for (let link of new Set(links.map((link) => link.split("#")[0]!))) {
			expect((await fetchApp(link)).status, link).toBe(200);
		}
		expect(links.every((link) => link.startsWith(demoDocsHref(slug)()))).toBe(true);
	});

	test.each(sites)("$slug's search finds a page by its title", async ({ slug, site }) => {
		let page = Object.values(site.pages)[0]!;
		let word = page.title.split(" ").find((part) => part.length > 3) ?? page.title;
		let body = await (
			await fetchApp(`${demoDocsHref(slug)("search")}?q=${encodeURIComponent(word)}`)
		).text();

		expect(body).toContain("result");
		expect(body).toContain(page.title.split(" ")[0]!);
	});

	test("a missing page answers 404 inside the site, with the search pre-filled", async () => {
		let response = await fetchApp("/demo/docs/driftwood/guides/custom-domain-setup");
		let body = await response.text();

		expect(response.status).toBe(404);
		expect(response.headers.get("Cache-Control")).toBeNull();
		expect(response.headers.get("ETag")).toBeNull();
		expect(body).toContain('value="custom domain setup"');
		expect(body).toContain("Driftwood");
	});

	test("an unknown site answers the site's 404", async () => {
		expect((await fetchApp("/demo/docs/no-such-site")).status).toBe(404);
		expect((await fetchApp("/demo/docs/constructor")).status).toBe(404);
	});
});
