/**
 * Tests for the `sdxc-sitemap` command line: what `list` and `validate` print on each stream
 * and the exit code they answer for a file, piped stdin, a fetched URL, a sitemap index and
 * input that cannot be read, driven through `invoke()` with every request answered by MSW.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { cli } from "./cli.js";

const URLSET = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
	<url><loc>https://example.com/</loc><lastmod>2026-09-11</lastmod></url>
	<url><loc>https://example.com/blog</loc></url>
</urlset>`;

const BROKEN = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
	<url><loc>/relative</loc></url>
	<url><loc>https://example.com/a</loc><priority>2</priority></url>
	<url><loc>https://other.com/b</loc></url>
</urlset>`;

const INDEX = `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
	<sitemap><loc>https://example.com/pages.xml</loc></sitemap>
	<sitemap><loc>https://example.com/posts.xml</loc></sitemap>
</sitemapindex>`;

/** The directory each test runs in, holding `sitemap.xml`, `broken.xml` and `index.xml`. */
const FIXTURE = { dir: "" };

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
	FIXTURE.dir = await mkdtemp(join(tmpdir(), "sdxc-sitemap-"));
	await writeFile(join(FIXTURE.dir, "sitemap.xml"), URLSET, "utf8");
	await writeFile(join(FIXTURE.dir, "broken.xml"), BROKEN, "utf8");
	await writeFile(join(FIXTURE.dir, "index.xml"), INDEX, "utf8");
});

afterEach(async () => {
	await rm(FIXTURE.dir, { recursive: true, force: true });
});

/** Runs `sdxc-sitemap` in the fixture directory with no terminal attached. */
function run(argv: string[], stdin?: string) {
	return invoke(cli, argv, { cwd: FIXTURE.dir, stdin, interactive: false });
}

/** Serves `INDEX`'s two children, one page each. */
function serveChildren() {
	server.use(
		http.get("https://example.com/pages.xml", () =>
			HttpResponse.xml(
				'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/about</loc></url></urlset>',
			),
		),
		http.get("https://example.com/posts.xml", () =>
			HttpResponse.xml(
				'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/blog/hello</loc><lastmod>2026-10-01T12:00:00Z</lastmod></url></urlset>',
			),
		),
	);
}

describe("sdxc-sitemap list", () => {
	test("prints every URL in a file, one per line", async () => {
		let { code, stdout, stderr } = await run(["list", "sitemap.xml"]);

		expect(code).toBe(0);
		expect(stdout).toBe("https://example.com/\nhttps://example.com/blog\n");
		expect(stderr).toBe("");
	});

	test("prints loc and lastmod with --json", async () => {
		let { code, stdout } = await run(["list", "sitemap.xml", "--json"]);

		expect(code).toBe(0);
		expect(JSON.parse(stdout)).toEqual([
			{ loc: "https://example.com/", lastmod: "2026-09-11T00:00:00.000Z" },
			{ loc: "https://example.com/blog", lastmod: null },
		]);
	});

	test("reads stdin when the source is absent or -", async () => {
		let absent = await run(["list"], URLSET);
		let dash = await run(["list", "-"], URLSET);

		expect(absent.code).toBe(0);
		expect(absent.stdout).toBe("https://example.com/\nhttps://example.com/blog\n");
		expect(dash.stdout).toBe(absent.stdout);
	});

	test("fetches a URL and follows its index to every child", async () => {
		server.use(http.get("https://example.com/sitemap.xml", () => HttpResponse.xml(INDEX)));
		serveChildren();

		let { code, stdout } = await run(["list", "https://example.com/sitemap.xml"]);

		expect(code).toBe(0);
		expect(stdout).toBe("https://example.com/about\nhttps://example.com/blog/hello\n");
	});

	test("follows an index read from a file", async () => {
		serveChildren();

		let { code, stdout } = await run(["list", "index.xml", "--json"]);

		expect(code).toBe(0);
		expect(JSON.parse(stdout)).toEqual([
			{ loc: "https://example.com/about", lastmod: null },
			{ loc: "https://example.com/blog/hello", lastmod: "2026-10-01T12:00:00.000Z" },
		]);
	});

	test("exits 2 naming a child of the index that cannot be fetched", async () => {
		server.use(
			http.get("https://example.com/pages.xml", () => new HttpResponse(null, { status: 500 })),
		);

		let { code, stdout, stderr } = await run(["list", "index.xml"]);

		expect(code).toBe(2);
		expect(stdout).toBe("");
		expect(stderr).toContain("https://example.com/pages.xml: Failed to fetch the sitemap: 500");
	});

	test("exits 2 for a document that is not a sitemap", async () => {
		let { code, stderr } = await run(["list"], "<html><body/></html>");

		expect(code).toBe(2);
		expect(stderr).toContain(
			"<stdin>: Expected a <urlset> or <sitemapindex> root, received <html>.",
		);
	});

	test("exits 2 for a missing file", async () => {
		let { code, stderr } = await run(["list", "missing.xml"]);

		expect(code).toBe(2);
		expect(stderr).toContain("Cannot read missing.xml");
	});

	test("exits 2 for a URL answering an error status", async () => {
		server.use(
			http.get("https://example.com/sitemap.xml", () => new HttpResponse(null, { status: 404 })),
		);

		let { code, stderr } = await run(["list", "https://example.com/sitemap.xml"]);

		expect(code).toBe(2);
		expect(stderr).toContain("Cannot fetch https://example.com/sitemap.xml: 404");
	});
});

describe("sdxc-sitemap validate", () => {
	test("prints ok and exits 0 for a conforming sitemap", async () => {
		let { code, stdout, stderr } = await run(["validate", "sitemap.xml"]);

		expect(code).toBe(0);
		expect(stdout).toBe("sitemap.xml: ok\n");
		expect(stderr).toBe("");
	});

	test("prints each problem on stderr and exits 1", async () => {
		let { code, stdout, stderr } = await run(["validate", "broken.xml"]);

		expect(code).toBe(1);
		expect(stdout).toBe("");
		expect(stderr).toBe(
			[
				'broken.xml: Row 1: <loc> "/relative" is not an absolute URL.\n',
				'broken.xml: Row 2: <priority> "2" is not a number from 0.0 to 1.0.\n',
				"broken.xml: Row 3: https://other.com/b is on other.com, but the first URL is on example.com.\n",
			].join(""),
		);
	});

	test("prints the problems as JSON with --json", async () => {
		let { code, stdout } = await run(["validate", "broken.xml", "--json"]);

		expect(code).toBe(1);
		expect(JSON.parse(stdout)).toEqual({
			valid: false,
			problems: [
				expect.objectContaining({ rule: "loc", row: 1 }),
				expect.objectContaining({ rule: "priority", row: 2 }),
				expect.objectContaining({ rule: "host", row: 3 }),
			],
		});
	});

	test("prints { valid: true, problems: [] } with --json for a conforming sitemap", async () => {
		let { code, stdout } = await run(["validate", "-", "--json"], URLSET);

		expect(code).toBe(0);
		expect(JSON.parse(stdout)).toEqual({ valid: true, problems: [] });
	});

	test("checks a fetched sitemap's URLs against the host it is served from", async () => {
		server.use(http.get("https://www.example.com/sitemap.xml", () => HttpResponse.xml(URLSET)));

		let { code, stderr } = await run(["validate", "https://www.example.com/sitemap.xml"]);

		expect(code).toBe(1);
		expect(stderr).toContain("is on example.com, but the sitemap is served from www.example.com.");
	});

	test("exits 1 for a document that is not a sitemap", async () => {
		let { code, stderr } = await run(["validate"], "<html/>");

		expect(code).toBe(1);
		expect(stderr).toContain("<stdin>: Expected a <urlset> or <sitemapindex> root");
	});

	test("exits 2 for a missing file", async () => {
		let { code, stderr } = await run(["validate", "missing.xml"]);

		expect(code).toBe(2);
		expect(stderr).toContain("Cannot read missing.xml");
	});
});
