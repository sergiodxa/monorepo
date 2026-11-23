/**
 * Tests the showcase through the real router: the index and its `?kind=` filters, a case
 * study for every kind of item, every demo answering under `/showcase/:slug/demo`, and each
 * old `/demo` address answering a `308` to its new home with its query kept.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { parseDocument } from "@sdxc/html/document";
import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { listShowcase } from "~/app/services/showcase";
import { fetchApp } from "~/app/test/router";

/** The links in a page's `<main>`, as their `href` attributes. */
async function hrefsIn(path: string): Promise<string[]> {
	let page = unwrap(parseDocument(await (await fetchApp(path)).text()));
	return Array.from(page.querySelectorAll("main a"), (link) => link.getAttribute("href") ?? "");
}

describe("GET /showcase", () => {
	test("leads with every application in production, each with its own package count", async () => {
		let response = await fetchApp("/showcase");
		let body = await response.text();
		let production = body.slice(body.indexOf('id="production"'), body.indexOf('id="items"'));

		expect(response.status).toBe(200);
		for (let entry of listShowcase()) {
			expect(production).toContain(`href="/showcase/${entry.directory}"`);
			expect(production).toContain(`${entry.packageCount} packages`);
		}
		expect(production).not.toContain(">Demo<");
	});

	test("lists the product landings an application serves beside the applications", async () => {
		let body = await (await fetchApp("/showcase?kind=production")).text();
		let production = body.slice(body.indexOf('id="production"'), body.indexOf('id="items"'));

		expect(production).toContain('href="/showcase/wakaba"');
		expect(production).toContain('href="/showcase/encore"');
		expect(body).not.toMatch(/id="items"[\s\S]*href="\/showcase\/wakaba"/);
	});

	test("shows each screenshot in the reader's color scheme", async () => {
		let body = await (await fetchApp("/showcase")).text();

		expect(body).toMatch(
			/<source media="\(prefers-color-scheme: dark\)" srcset="\/showcase\/keel\/[\w-]+-dark\.webp"/,
		);
	});

	test("marks every demo as a demo, so none reads as a product", async () => {
		let body = await (await fetchApp("/showcase?kind=demo")).text();
		let grid = body.slice(body.indexOf('id="items"'));
		let tiles = grid.split("<article").slice(1);

		expect(tiles.length).toBeGreaterThan(20);
		for (let tile of tiles) expect(tile).toContain(">Demo<");
		expect(body).not.toContain('id="production"');
	});

	test("narrows to one kind of demo, with the current filter marked", async () => {
		let hrefs = await hrefsIn("/showcase?kind=landing");
		let body = await (await fetchApp("/showcase?kind=landing")).text();

		expect(hrefs).toContain("/showcase/keel");
		expect(hrefs).not.toContain("/showcase/wayfern");
		expect(hrefs).not.toContain("/showcase/driftwood");
		expect(body).toMatch(/href="\/showcase\?kind=landing#items"[^>]*aria-current="page"/);
	});

	test("shows everything for a filter it does not know", async () => {
		let hrefs = await hrefsIn("/showcase?kind=nonsense");

		expect(hrefs).toContain("/showcase/uptime");
		expect(hrefs).toContain("/showcase/wayfern");
	});

	test("closes on where to start", async () => {
		let body = await (await fetchApp("/showcase")).text();
		let closing = body.slice(body.indexOf('id="build"'));

		expect(closing).toContain("Build your own.");
		expect(closing).toContain('href="/docs/getting-started/install-and-pin"');
	});

	test("may be indexed", async () => {
		let body = await (await fetchApp("/showcase")).text();

		expect(body).not.toMatch(/<meta name="robots" content="[^"]*noindex/);
	});
});

describe("GET /showcase/:slug", () => {
	test.each([
		["uptime", "https://uptime.sergiodxa.com", "apps/uptime"],
		["wayfern", "/showcase/wayfern/demo", "apps/sdxc-site/resources/views/demo-apps/wayfern"],
		["keel", "/showcase/keel/demo", "apps/sdxc-site/resources/views/demos/keel"],
		["driftwood", "/showcase/driftwood/demo", "apps/sdxc-site/resources/views/demo-docs/driftwood"],
	])(
		"%s links where it runs and its source, with linkable sections",
		async (slug, live, source) => {
			let response = await fetchApp(`/showcase/${slug}`);
			let body = await response.text();

			expect(response.status).toBe(200);
			expect(body).toContain(`href="${live}"`);
			expect(body).toContain(`href="https://github.com/sergiodxa/monorepo/tree/main/${source}"`);
			for (let id of ["cover", "the-brief", "case-study", "built-with", "packages"]) {
				expect(body, id).toContain(`id="${id}"`);
			}
			expect(body).not.toMatch(/<meta name="robots" content="[^"]*noindex/);
		},
	);

	test("describes its share image to Open Graph and to X", async () => {
		let body = await (await fetchApp("/showcase/wayfern")).text();

		expect(body).toMatch(
			/<meta property="og:image:alt" content="Wayfern \(App demo\): Stays, flights/,
		);
		expect(body).toMatch(
			/<meta name="twitter:image:alt" content="Wayfern \(App demo\): Stays, flights/,
		);
	});

	test("names what an item is, kind and category together", async () => {
		let uptime = await (await fetchApp("/showcase/uptime")).text();
		let wakaba = await (await fetchApp("/showcase/wakaba")).text();
		let keel = await (await fetchApp("/showcase/keel")).text();

		expect(uptime).toContain("Production app");
		expect(wakaba).toContain("Production landing");
		expect(wakaba).toContain('href="https://sergiodxa.com/apps/wakaba"');
		expect(wakaba).toContain(">Open the page");
		expect(keel).toContain("Landing demo");
	});

	test.each(["wayfern", "wakaba", "books"])(
		"%s reserves every screenshot's box, so nothing shifts as the shots load",
		async (slug) => {
			let page = unwrap(parseDocument(await (await fetchApp(`/showcase/${slug}`)).text()));
			let images = Array.from(page.querySelectorAll("main img"));

			expect(images.length).toBeGreaterThanOrEqual(6);
			for (let image of images) {
				let src = image.getAttribute("src") ?? "";
				expect(Number(image.getAttribute("width")), src).toBeGreaterThan(0);
				expect(Number(image.getAttribute("height")), src).toBeGreaterThan(0);
			}
		},
	);

	test("preloads the cover from the head, one capture per color scheme", async () => {
		let response = await fetchApp("/showcase/wayfern");
		let page = unwrap(parseDocument(await response.text()));
		let preloads = Array.from(
			page.querySelectorAll('head link[rel="preload"][as="image"]'),
			(link) => [link.getAttribute("href"), link.getAttribute("media")],
		);
		let cover = page.querySelector("img#cover")?.getAttribute("src") ?? "";

		expect(preloads).toEqual([
			[cover, "not all and (prefers-color-scheme: dark)"],
			[cover.replace(/\.webp$/, "-dark.webp"), "(prefers-color-scheme: dark)"],
		]);
		expect(response.headers.get("Link")).toBe(
			[
				`<${cover}>; rel=preload; as=image; media="not all and (prefers-color-scheme: dark)"; fetchpriority=high`,
				`<${cover.replace(/\.webp$/, "-dark.webp")}>; rel=preload; as=image; media="(prefers-color-scheme: dark)"; fetchpriority=high`,
			].join(", "),
		);
	});

	test("names a demo's real-world inspirations and links its components to the catalogue", async () => {
		let body = await (await fetchApp("/showcase/wayfern")).text();

		expect(body).toContain('id="takes-after"');
		expect(body).toContain('href="/api/ui/map"');
		expect(body).toContain('href="/api/facets"');
	});

	test("answers the site's 404 for a slug with no case study", async () => {
		expect((await fetchApp("/showcase/no-such-thing")).status).toBe(404);
	});
});

describe("GET /showcase/:slug/demo", () => {
	test.each([
		["/showcase/keel/demo", "landing"],
		["/showcase/driftwood/demo", "docs hub"],
		["/showcase/driftwood/demo/search?q=install", "docs search"],
		["/showcase/pulse/demo", "app home"],
		["/showcase/pulse/demo/services?status=down", "app screen"],
	])("%s answers its %s, kept out of search engines", async (path) => {
		let response = await fetchApp(path);

		expect(response.status).toBe(200);
		expect(await response.text()).toMatch(/<meta name="robots" content="noindex, nofollow"/);
	});

	test("serves a docs page's Markdown twin and keeps an app's .md path a screen", async () => {
		let twin = await fetchApp("/showcase/driftwood/demo/start/quickstart.md");
		let file = await fetchApp("/showcase/delta/demo/delta/blob/main/README.md");

		expect(twin.headers.get("Content-Type")).toContain("text/markdown");
		expect(file.status).toBe(200);
		expect(file.headers.get("Content-Type")).toContain("text/html");
	});

	test("answers 404 for an application in production, which has no demo", async () => {
		expect((await fetchApp("/showcase/uptime/demo")).status).toBe(404);
		expect((await fetchApp("/showcase/keel/demo/anything")).status).toBe(404);
	});

	test("refuses a post to a landing and to a docs page other than its vote", async () => {
		let post = (path: string) => fetchApp(path, { method: "POST", body: new FormData() });

		expect((await post("/showcase/keel/demo")).status).toBe(404);
		expect((await post("/showcase/driftwood/demo/start/quickstart")).status).toBe(404);
	});
});

describe("old /demo addresses", () => {
	test.each([
		["/demo", "/showcase?kind=demo"],
		["/demo/apps", "/showcase?kind=demo"],
		["/demo?ref=docs", "/showcase?ref=docs&kind=demo"],
		["/demo/apps/pulse", "/showcase/pulse/demo"],
		["/demo/apps/pulse/services?status=down", "/showcase/pulse/demo/services?status=down"],
		[
			"/demo/apps/pulse/frames/overview/stats?range=7d",
			"/showcase/pulse/demo/frames/overview/stats?range=7d",
		],
		["/demo/apps/delta/streams/runs/815/job/4", "/showcase/delta/demo/streams/runs/815/job/4"],
		[
			"/demo/apps/sundial/files/calendars/work.ics",
			"/showcase/sundial/demo/files/calendars/work.ics",
		],
		["/demo/docs/driftwood", "/showcase/driftwood/demo"],
		["/demo/docs/driftwood/start/quickstart.md", "/showcase/driftwood/demo/start/quickstart.md"],
		[
			"/demo/frames/docs/driftwood/feedback/start/quickstart",
			"/showcase/driftwood/demo/frames/feedback/start/quickstart",
		],
		["/demo/media/video/lesson.webm", "/showcase/media/video/lesson.webm"],
		["/demo/saas", "/showcase/keel/demo"],
		["/demo/ai?seats=4", "/showcase/margin/demo?seats=4"],
		["/demo/library", "/showcase/plumb/demo"],
	])("%s answers 308 to %s", async (from, to) => {
		let response = await fetchApp(from);

		expect(response.status).toBe(308);
		expect(response.headers.get("Location")).toBe(to);
	});

	test("keeps a form post's method across the move", async () => {
		let response = await fetchApp("/demo/apps/pulse/services", {
			method: "POST",
			body: new FormData(),
		});

		expect(response.status).toBe(308);
		expect(response.headers.get("Location")).toBe("/showcase/pulse/demo/services");
	});

	test("answers 404 for a landing name no demo ever had", async () => {
		expect((await fetchApp("/demo/no-such-demo")).status).toBe(404);
	});
});
