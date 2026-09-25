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
		for (let section of sections) expect(body).toContain(section.title);
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

describe("GET /docs/packages", () => {
	test("lists every published package", async () => {
		let body = await (await fetchApp("/docs/packages")).text();

		for (let entry of listPackages()) expect(body).toContain(entry.name);
	});
});

describe("GET /docs/packages/:name", () => {
	test("frames the README with what the manifest knows", async () => {
		let response = await fetchApp("/docs/packages/markdown");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain("npm add @sdxc/markdown");
		expect(body).toContain("@sdxc/markdown/remix");
		expect(body).toContain("uptime");
	});

	test("rewrites a sibling's npm link to its page here", async () => {
		let body = await (await fetchApp("/docs/packages/markdown")).text();

		expect(body).toContain('href="/docs/packages/result"');
		expect(body).not.toContain("npmjs.com/package/@sdxc/result");
	});

	test("leaves a link outside the collection alone", async () => {
		let body = await (await fetchApp("/docs/packages/markdown")).text();

		expect(body).toContain("npmjs.com/package/remix");
	});

	test("answers a catalogue package with its own index rather than its README", async () => {
		let response = await fetchApp("/docs/packages/u");
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain('href="/docs/packages/u/p"');
		expect(body).toContain('href="/docs/packages/u/hover"');
	});

	test("answers 404 for a directory that publishes nothing", async () => {
		expect((await fetchApp("/docs/packages/blog-engine")).status).toBe(404);
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
