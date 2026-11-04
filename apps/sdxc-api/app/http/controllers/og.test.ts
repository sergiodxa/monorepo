/**
 * `GET /og.png` draws the landing card with the bundled faces and, when the colo
 * cache is present, serves the next request for that revision from the stored copy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseFont } from "@sdxc/font";
import { decode } from "@sdxc/png";
import { success } from "@sdxc/result";
import { afterEach, describe, expect, test, vi } from "vitest";

import { OG_CACHE_CONTROL } from "~/app/http/caching";
import { OG_IMAGE_HEIGHT, OG_IMAGE_PATH, OG_IMAGE_WIDTH } from "~/config/site";

/** Reads one bundled face from disk, as the Worker receives it as a data module. */
function load(name: string) {
	let result = parseFont(readFileSync(join(import.meta.dirname, "../../../resources/fonts", name)));
	if (result.status === "failure") throw result.error;
	return result.data;
}

vi.doMock("~/app/initializers/og-fonts", () => ({
	ogFonts: () =>
		success({
			regular: load("inter-regular.ttf.bin"),
			semibold: load("inter-semibold.ttf.bin"),
			mono: load("jetbrains-mono-regular.ttf.bin"),
		}),
}));

const { createWebRouter } = await import("~/app/initializers/router");

/** A stand-in for `caches.default`, keyed by the request URL the route stores under. */
const store = new Map<string, Response>();

/** How many times the stand-in was written. A hit must leave this unchanged. */
let puts = 0;

/** Installs the stand-in where the route looks for the colo cache. */
function installCache(): void {
	let cache = {
		async match(request: RequestInfo): Promise<Response | undefined> {
			let url = request instanceof Request ? request.url : String(request);
			return store.get(url)?.clone();
		},
		async put(request: RequestInfo, response: Response): Promise<void> {
			puts += 1;
			let url = request instanceof Request ? request.url : String(request);
			store.set(url, response.clone());
		},
	};
	(globalThis as unknown as { caches?: { default: typeof cache } }).caches = { default: cache };
}

afterEach(() => {
	store.clear();
	puts = 0;
	Reflect.deleteProperty(globalThis, "caches");
});

/** Pixels whose channels sum below this are the dark code chip, not the paper. */
const DARK = 160;

describe("GET /og.png", () => {
	let router = createWebRouter();

	test("draws a 1200×630 PNG and lets shared caches keep that revision", async () => {
		let response = await router.fetch(new Request(`https://api.sdxc.dev${OG_IMAGE_PATH}`));
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(response.headers.get("cache-control")).toBe(OG_CACHE_CONTROL);

		let bytes = new Uint8Array(await response.arrayBuffer());
		expect(bytes[0]).toBe(0x89);
		let decoded = await decode(bytes);
		if (decoded.status === "failure") throw decoded.error;
		expect(decoded.data.width).toBe(OG_IMAGE_WIDTH);
		expect(decoded.data.height).toBe(OG_IMAGE_HEIGHT);

		let dark = 0;
		let { data } = decoded.data;
		for (let index = 0; index < data.length; index += 4) {
			let red = data[index] ?? 0;
			let green = data[index + 1] ?? 0;
			let blue = data[index + 2] ?? 0;
			if (red + green + blue < DARK) dark += 1;
		}
		expect(dark).toBeGreaterThan(2_000);
	});

	test("serves a repeat request from the colo cache", async () => {
		installCache();
		let url = `https://api.sdxc.dev${OG_IMAGE_PATH}`;
		let first = await router.fetch(new Request(url));
		expect(first.status).toBe(200);
		await first.arrayBuffer();
		await vi.waitFor(() => {
			expect(puts).toBe(1);
		});

		let key = store.keys().next().value;
		expect(key).toBe(`${url}`);
		store.set(
			key ?? url,
			new Response("stored-card", { headers: { "content-type": "image/png" } }),
		);

		let second = await router.fetch(new Request(url));
		expect(await second.text()).toBe("stored-card");
		expect(puts).toBe(1);
	});

	test("answers HEAD with the card's headers and no body", async () => {
		let response = await router.fetch(
			new Request(`https://api.sdxc.dev${OG_IMAGE_PATH}`, { method: "HEAD" }),
		);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(await response.text()).toBe("");
	});
});
