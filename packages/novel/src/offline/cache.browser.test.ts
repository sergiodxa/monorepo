/**
 * The offline cache against Chromium's own Cache Storage, with the network mocked by MSW: files
 * stored as first fetched, hashed files cache-first, other files revalidated and served from the
 * cache only offline, undeclared requests passed, the budget, and version cleanup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { http, HttpResponse } from "msw";
import { setupWorker } from "msw/browser";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { OfflineCache } from "./cache.js";
import { cacheName, CACHE_PREFIX } from "./policy.js";

/** How many times the network served each path, and what it serves now. */
let served = new Map<string, number>();
let bodies = new Map<string, string>();
let offline = false;

const WORKER = setupWorker(
	http.get("*/game/*", ({ request }) => {
		let path = new URL(request.url).pathname;
		if (offline) return HttpResponse.error();
		let body = bodies.get(path);
		if (body === undefined) return new HttpResponse(null, { status: 404 });
		served.set(path, (served.get(path) ?? 0) + 1);
		return new HttpResponse(body, { headers: { "content-type": "application/octet-stream" } });
	}),
);

/** The declared paths of the fixture game. */
const HASHED = "/game/assets/cafe-a1b2c3d4.webp";
const PLAIN = "/game/music/theme.ogg";

beforeAll(() => WORKER.start({ onUnhandledRequest: "bypass", quiet: true }));
afterAll(() => WORKER.stop());

afterEach(async () => {
	served = new Map();
	bodies = new Map();
	offline = false;
	for (let name of await caches.keys()) {
		if (name.startsWith(CACHE_PREFIX)) await caches.delete(name);
	}
});

/** A cache over the page's origin with its bookkeeping awaited on request. */
function setup(options: { version?: string; budget?: number } = {}) {
	let cache = new OfflineCache(caches, location.origin, {
		version: options.version ?? "1",
		budget: options.budget,
		modules: (url) => url.pathname.startsWith("/game/assets/scenes/"),
		immutable: (url) => url.pathname.startsWith("/game/assets/"),
	});
	let pending: Promise<unknown>[] = [];
	/** Answers a request the way the worker's fetch listener does. */
	async function get(path: string, init?: RequestInit): Promise<Response | undefined> {
		let answer = cache.handle(new Request(new URL(path, location.origin), init), (work) =>
			pending.push(work),
		);
		let response = await answer;
		await Promise.all(pending);
		return response;
	}
	return { cache, get };
}

describe("OfflineCache", () => {
	test("stores a hashed file as first fetched and serves it from the cache after", async () => {
		bodies.set(HASHED, "cafe");
		let { cache, get } = setup();
		await cache.declare([HASHED, PLAIN]);
		expect(await (await get(HASHED))?.text()).toBe("cafe");
		bodies.set(HASHED, "changed");
		expect(await (await get(HASHED))?.text()).toBe("cafe");
		expect(served.get(HASHED)).toBe(1);
		expect(await cache.entries()).toEqual([
			{ url: new URL(HASHED, location.origin).href, size: 4, used: expect.any(Number) },
		]);
	});

	test("revalidates an unhashed file and falls back to the cache offline", async () => {
		bodies.set(PLAIN, "v1");
		let { cache, get } = setup();
		await cache.declare([PLAIN]);
		expect(await (await get(PLAIN))?.text()).toBe("v1");
		bodies.set(PLAIN, "v2");
		expect(await (await get(PLAIN))?.text()).toBe("v2");
		offline = true;
		expect(await (await get(PLAIN))?.text()).toBe("v2");
		expect(served.get(PLAIN)).toBe(2);
	});

	test("passes undeclared requests and stores no failed or partial response", async () => {
		let { cache, get } = setup();
		await cache.declare([HASHED, "/game/assets/missing-a1b2c3d4.webp"]);
		expect(await get("/game/other.webp")).toBeUndefined();
		expect((await get("/game/assets/missing-a1b2c3d4.webp"))?.status).toBe(404);
		bodies.set(HASHED, "cafe");
		await get(HASHED, { headers: { range: "bytes=0-1" } });
		expect(await cache.entries()).toEqual([]);
	});

	test("caches a scene module chunk by the app's rule without a declaration", async () => {
		bodies.set("/game/assets/scenes/cafe-a1b2c3d4.js", "export default 1;");
		let { cache, get } = setup();
		await get("/game/assets/scenes/cafe-a1b2c3d4.js");
		expect((await cache.entries()).map((entry) => new URL(entry.url).pathname)).toEqual([
			"/game/assets/scenes/cafe-a1b2c3d4.js",
		]);
	});

	test("evicts the least recently used file past the budget", async () => {
		let paths = ["/game/assets/a-a1b2c3d4.webp", "/game/assets/b-a1b2c3d4.webp"];
		for (let path of paths) bodies.set(path, "123456");
		let { cache, get } = setup({ budget: 10 });
		await cache.declare(paths);
		for (let path of paths) await get(path);
		expect((await cache.entries()).map((entry) => new URL(entry.url).pathname)).toEqual([
			"/game/assets/b-a1b2c3d4.webp",
		]);
		let stored = await caches.open(cacheName("1"));
		expect(await stored.match(new URL(paths[0] as string, location.origin).href)).toBeUndefined();
	});

	test("reads its declared files back after the worker restarts", async () => {
		bodies.set(PLAIN, "theme");
		await setup().cache.declare([PLAIN]);
		let restarted = setup();
		expect(await (await restarted.get(PLAIN))?.text()).toBe("theme");
		expect(await restarted.get("/game/other.webp")).toBeUndefined();
	});

	test("drops files a new declaration leaves out", async () => {
		bodies.set(HASHED, "cafe");
		let { cache, get } = setup();
		await cache.declare([HASHED]);
		await get(HASHED);
		await cache.declare(["/game/assets/cafe-e5f6a7b8.webp"]);
		expect(await cache.entries()).toEqual([]);
	});

	test("deletes every other version's cache on activation", async () => {
		bodies.set(HASHED, "cafe");
		let old = setup({ version: "1" });
		await old.cache.declare([HASHED]);
		await old.get(HASHED);
		await caches.open("app-shell");
		let next = setup({ version: "2" });
		expect(await next.cache.activate()).toEqual(["sdxc-novel:1"]);
		expect(await caches.has("sdxc-novel:1")).toBe(false);
		expect(await caches.has("app-shell")).toBe(true);
		await caches.delete("app-shell");
	});
});
