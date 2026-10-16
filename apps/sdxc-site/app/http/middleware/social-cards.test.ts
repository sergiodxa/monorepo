/**
 * Drives `<page>.png` requests through the real router: a page advertises its card URL,
 * the middleware renders that card from the page's own tags and keeps it in storage, a guide
 * under a wildcard route still reaches its card, and a path that is not a page has none. Storage is in memory and the fonts are read from disk.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseFont } from "@sdxc/font";
import { success } from "@sdxc/result";
import { createMemoryFileStorage } from "remix/file-storage/memory";
import { beforeAll, describe, expect, test, vi } from "vitest";

import { socialCardKey } from "~/app/services/social-card";

/** The one store every request in this file shares, so a second request can find the first's card. */
const STORAGE = createMemoryFileStorage();

/** Reads one bundled face from disk, as the Worker receives it as a data module. */
function load(name: string) {
	let result = parseFont(readFileSync(join(import.meta.dirname, "../../../resources/fonts", name)));
	if (result.status === "failure") throw result.error;
	return result.data;
}

let fetchApp: (path: string) => Promise<Response>;

beforeAll(async () => {
	vi.doMock("~/app/models/social-cards", () => ({ socialCards: () => STORAGE }));
	vi.doMock("~/app/initializers/social-card-fonts", () => {
		let fonts = success({
			regular: load("inter-regular.ttf.bin"),
			semibold: load("inter-semibold.ttf.bin"),
			mono: load("jetbrains-mono-regular.ttf.bin"),
		});
		return { socialCardFonts: () => fonts };
	});
	({ fetchApp } = await import("~/app/test/router"));
}, 30_000);

/** The card URL a page advertises in its `og:image` tag, as a path on this site. */
async function advertisedCard(path: string): Promise<string> {
	let html = await (await fetchApp(path)).text();
	let image = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1];
	expect(image).toBeDefined();
	let url = new URL((image ?? "").replaceAll("&amp;", "&"));
	return `${url.pathname}${url.search}`;
}

describe("GET <page>.png", () => {
	test("a package page's advertised card renders, is stored, and is cached for good", async () => {
		let card = await advertisedCard("/api/jwt");
		expect(card).toMatch(/^\/api\/jwt\.png\?v=[0-9a-z]+$/);

		let response = await fetchApp(card);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(response.headers.get("cache-control")).toContain("immutable");
		let bytes = new Uint8Array(await response.arrayBuffer());
		expect(Array.from(bytes.slice(1, 4))).toEqual([80, 78, 71]);

		await vi.waitFor(async () => expect((await STORAGE.list()).files.length).toBeGreaterThan(0));
		let again = await fetchApp(card);
		expect(new Uint8Array(await again.arrayBuffer())).toEqual(bytes);
	});

	test("a page states its card's size", async () => {
		let html = await (await fetchApp("/api/jwt")).text();
		expect(html).toContain('<meta property="og:image:width" content="1200" />');
		expect(html).toContain('<meta property="og:image:height" content="630" />');
	});

	test("the home page's card lives under index", async () => {
		let card = await advertisedCard("/");
		expect(card).toMatch(/^\/index\.png\?v=/);
		expect((await fetchApp(card)).status).toBe(200);
	});

	test("a guide's card wins over the docs wildcard that would claim its path", async () => {
		let card = await advertisedCard("/docs/building-remix-apps/seo-sitemaps-and-robots");
		expect(card).toMatch(/^\/docs\/building-remix-apps\/seo-sitemaps-and-robots\.png\?v=/);
		let response = await fetchApp(card);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
	});

	test("a page's markdown twin still answers as markdown", async () => {
		let response = await fetchApp("/api/jwt.md");
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("markdown");
	});

	test("a card asked for without its hash is cached briefly", async () => {
		let response = await fetchApp("/docs.png");
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
	});

	test("a stored card named by its hash is served without rendering the page", async () => {
		await STORAGE.set(
			socialCardKey("storedonly"),
			new File([new Uint8Array([137, 80, 78, 71])], "stored.png", { type: "image/png" }),
		);
		let response = await fetchApp("/api/not-a-package.png?v=storedonly");
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toContain("immutable");
		expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([137, 80, 78, 71]);
	});

	test("a path that is not a page has no card", async () => {
		expect((await fetchApp("/api/not-a-package.png")).status).toBe(404);
		expect((await fetchApp("/index.png.png")).status).toBe(404);
	});
});
