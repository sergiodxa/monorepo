/**
 * The offline cache's policy as pure functions: which requests the worker answers and how, the
 * hashed-URL rule, versioned cache names and their cleanup, budget eviction and the files a new
 * declaration leaves behind.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import { assets, cast, character, createNovel, scene, scenes } from "../index.js";

import type { PolicyInput, PolicyRequest } from "./policy.js";

import {
	ASSETS_MESSAGE,
	cacheName,
	evict,
	isHashed,
	staleCaches,
	strategyFor,
	undeclared,
} from "./policy.js";
import { offlineAssets } from "./register.js";
import { declaredUrls } from "./worker.js";

/** The story state every fixture in the package shares. */
const STATE = s.object({
	gold: s.defaulted(s.number(), 10),
	charm: s.defaulted(s.number(), 0),
	affection: s.defaulted(s.object({ mika: s.defaulted(s.number(), 0) }), { mika: 0 }),
	lastCatch: s.optional(s.object({ caught: s.number() })),
});

/** The worker's view of a game at `https://game.test`. */
const INPUT: PolicyInput = {
	declared: new Set([
		"https://game.test/assets/cafe-a1b2c3d4.webp",
		"https://game.test/music/theme.ogg",
	]),
	modules: (url) => url.pathname.startsWith("/assets/scenes/"),
	immutable: isHashed,
};

/** A plain `GET` from a script or an image, as most of a game's requests are. */
function request(url: string, init: Partial<PolicyRequest> = {}): PolicyRequest {
	return { url, method: "GET", mode: "cors", destination: "", ...init };
}

describe("strategyFor()", () => {
	test("serves a declared hashed file cache-first", () => {
		expect(strategyFor(request("https://game.test/assets/cafe-a1b2c3d4.webp"), INPUT)).toBe(
			"cache-first",
		);
	});

	test("revalidates a declared file without a hash", () => {
		expect(strategyFor(request("https://game.test/music/theme.ogg"), INPUT)).toBe("revalidate");
	});

	test("serves a scene module chunk by the app's rule", () => {
		expect(strategyFor(request("https://game.test/assets/scenes/cafe-Zz9_-x0Y.js"), INPUT)).toBe(
			"cache-first",
		);
	});

	test("passes anything undeclared, every navigation and document, and every non-GET", () => {
		expect(strategyFor(request("https://game.test/assets/app-a1b2c3d4.js"), INPUT)).toBe("pass");
		expect(
			strategyFor(request("https://game.test/music/theme.ogg", { mode: "navigate" }), INPUT),
		).toBe("pass");
		expect(
			strategyFor(
				request("https://game.test/assets/scenes/x-a1b2c3d4.js", { destination: "document" }),
				INPUT,
			),
		).toBe("pass");
		expect(
			strategyFor(request("https://game.test/music/theme.ogg", { method: "POST" }), INPUT),
		).toBe("pass");
	});

	test("ignores a URL's fragment", () => {
		expect(strategyFor(request("https://game.test/music/theme.ogg#t=10"), INPUT)).toBe(
			"revalidate",
		);
	});
});

describe("isHashed()", () => {
	test.each([
		["/assets/cafe-a1b2c3d4.webp", true],
		["/assets/bg/cafe-A1_b2-C3.webp", true],
		["/assets/background.webp", false],
		["/assets/my-background.webp", false],
		["/bg/cafe-a1b2c3d4.webp", false],
		["/assets/cafe-a1b2c3d4e.webp", false],
	])("%s is %s", (path, hashed) => {
		expect(isHashed(new URL(path, "https://game.test"))).toBe(hashed);
	});
});

describe("versions", () => {
	test("names a cache by version and clears every other version's on activation", () => {
		expect(cacheName("2026.11.19")).toBe("sdxc-novel:2026.11.19");
		expect(staleCaches(["sdxc-novel:1", "sdxc-novel:2", "app-shell", "sdxc-novel:3"], "2")).toEqual(
			["sdxc-novel:1", "sdxc-novel:3"],
		);
	});
});

describe("evict()", () => {
	let entries = [
		{ url: "/a", size: 40, used: 3 },
		{ url: "/b", size: 40, used: 1 },
		{ url: "/c", size: 40, used: 2 },
	];

	test("deletes the least recently used files until the cache fits", () => {
		expect(evict(entries, 80)).toEqual(["/b"]);
		expect(evict(entries, 40)).toEqual(["/b", "/c"]);
	});

	test("keeps the file just stored and keeps everything without a budget", () => {
		expect(evict(entries, 10, "/b")).toEqual(["/c", "/a"]);
		expect(evict(entries, undefined)).toEqual([]);
	});
});

describe("undeclared()", () => {
	test("lists cached files no longer declared, keeping module chunks", () => {
		let entries = [
			{ url: "https://game.test/assets/cafe-a1b2c3d4.webp", size: 1, used: 1 },
			{ url: "https://game.test/assets/cafe-00000000.webp", size: 1, used: 2 },
			{ url: "https://game.test/assets/scenes/old-a1b2c3d4.js", size: 1, used: 3 },
		];
		expect(undeclared(entries, INPUT.declared, INPUT.modules)).toEqual([
			"https://game.test/assets/cafe-00000000.webp",
		]);
	});
});

describe("the page's message", () => {
	test("lists every declared file once, in every locale, without inlined ones", () => {
		let declared = scenes({ only: scene() });
		let novel = createNovel({
			scenes: declared,
			cast: cast({
				mika: character({ name: "cast.mika", sprites: { smile: "/mika/smile.webp" } }),
				ren: character({
					name: "cast.ren",
					layers: { face: { grin: "/ren/grin.webp" }, body: { school: "/mika/smile.webp" } },
				}),
			}),
			assets: assets({
				backgrounds: { cafe: "/bg/cafe.webp", dot: "data:image/png;base64,AA" },
				images: { letter: { en: "/cg/letter-en.webp", ja: "/cg/letter-ja.webp" } },
				sounds: { door: { src: "/sfx/door.ogg" } },
			}),
			state: STATE,
			initial: declared.only,
		});
		expect(offlineAssets(novel, ["/voice/mika/hello.ogg"])).toEqual([
			"/bg/cafe.webp",
			"/cg/letter-en.webp",
			"/cg/letter-ja.webp",
			"/sfx/door.ogg",
			"/mika/smile.webp",
			"/ren/grin.webp",
			"/voice/mika/hello.ogg",
		]);
	});

	test("reads only the assets message", () => {
		expect(declaredUrls({ type: ASSETS_MESSAGE, urls: ["/a", 1, "/b"] })).toEqual(["/a", "/b"]);
		expect(declaredUrls({ type: "other", urls: ["/a"] })).toBeUndefined();
		expect(declaredUrls("hello")).toBeUndefined();
	});
});
