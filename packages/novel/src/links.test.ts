/**
 * The prefetch specification: `novel.links()` preloads what the starting scene shows and
 * prefetches the files of the scenes its jumps reach, and `novel.reachable()` lists those scenes
 * with their files, both read from the scene arrays without playing a line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import { assets, cast, character, createNovel, createScene, lazy, scene, scenes } from "./index.js";

/** The story state every fixture in the package shares. */
const STATE = s.object({
	gold: s.defaulted(s.number(), 10),
	charm: s.defaulted(s.number(), 0),
	affection: s.defaulted(s.object({ mika: s.defaulted(s.number(), 0) }), { mika: 0 }),
	lastCatch: s.optional(s.object({ caught: s.number() })),
});

const SCENES = scenes({
	start: scene(),
	near: scene(),
	far: scene(),
	farther: scene(),
	unmapped: scene(),
});

const CAST = cast({
	mika: character({
		name: "cast.mika",
		sprites: { smile: "/mika/smile-a1b2c3d4.webp", neutral: "/mika/neutral-a1b2c3d4.webp" },
	}),
	ren: character({
		name: "cast.ren",
		layers: {
			body: { school: "/ren/body-school.webp", casual: "/ren/body-casual.webp" },
			face: { grin: "/ren/face-grin.webp" },
		},
	}),
});

const ASSETS = assets({
	backgrounds: {
		cafe: "/bg/cafe.webp",
		street: "/bg/street.webp",
		tiny: "data:image/png;base64,AA",
	},
	images: { letter: { en: "/cg/letter-en.webp", ja: "/cg/letter-ja.webp" } },
	music: { chill: "/music/chill.ogg" },
	sounds: { door: { src: "/sfx/door.ogg" } },
});

const START = createScene(SCENES.start, (ctx) => [
	ctx.show(ASSETS.backgrounds.cafe),
	ctx.show(ASSETS.backgrounds.tiny),
	ctx.play(ASSETS.music.chill),
	ctx.enter(CAST.mika, { at: "left" }),
	ctx.enter(CAST.ren, { at: "right", layers: { body: "school", face: "grin" } }),
	ctx.say(CAST.mika, "opening.welcome"),
	ctx.play(ASSETS.sounds.door),
	ctx.choose({
		"cafe.stay": [ctx.goto(SCENES.near)],
		"cafe.leave": [ctx.call(SCENES.unmapped), ctx.goto(SCENES.start)],
	}),
]);

const NEAR = createScene(SCENES.near, (ctx) => [
	ctx.express(CAST.mika, { expression: "neutral" }),
	ctx.when(() => true, [ctx.show(ASSETS.images.letter)], [ctx.show(ASSETS.backgrounds.cafe)]),
	ctx.narrate("opening.lucky"),
	ctx.goto(SCENES.far),
]);

const FAR = createScene(SCENES.far, (ctx) => [
	ctx.show(ASSETS.backgrounds.street),
	ctx.narrate("opening.unlucky"),
	ctx.goto(SCENES.farther),
]);

const FARTHER = createScene(SCENES.farther, (ctx) => [ctx.narrate("opening.done")]);

/** A novel over the fixture, with `far` loaded lazily and counted. */
function fixture() {
	let imports = { far: 0 };
	let novel = createNovel({
		scenes: SCENES,
		cast: CAST,
		assets: ASSETS,
		state: STATE,
		initial: SCENES.start,
		locales: ["en", "ja"],
		voice: ({ speaker, key, locale }) => `/voice/${locale}/${speaker}/${key}.ogg`,
	});
	novel.map(SCENES.start, START);
	novel.map(SCENES.near, NEAR);
	novel.map(
		SCENES.far,
		lazy(async () => {
			imports.far += 1;
			return { default: FAR };
		}),
	);
	novel.map(SCENES.farther, FARTHER);
	return { novel, imports };
}

describe("novel.links()", () => {
	test("preloads the starting scene's images and sounds and prefetches the rest", async () => {
		let { novel } = fixture();
		expect(await novel.links(SCENES.start, { depth: 0, locale: "en" })).toEqual([
			{ rel: "preload", href: "/bg/cafe.webp", as: "image" },
			{ rel: "preload", href: "/mika/smile-a1b2c3d4.webp", as: "image" },
			{ rel: "preload", href: "/ren/body-school.webp", as: "image" },
			{ rel: "preload", href: "/ren/face-grin.webp", as: "image" },
			{ rel: "preload", href: "/sfx/door.ogg", as: "fetch", crossorigin: "anonymous" },
			{ rel: "prefetch", href: "/music/chill.ogg" },
			{ rel: "prefetch", href: "/voice/en/mika/opening.welcome.ogg" },
		]);
	});

	test("prefetches the files of scenes one jump away, once each", async () => {
		let { novel } = fixture();
		let links = await novel.links(SCENES.start, { locale: "ja" });
		expect(links.filter((link) => link.rel === "prefetch").map((link) => link.href)).toEqual([
			"/music/chill.ogg",
			"/voice/ja/mika/opening.welcome.ogg",
			"/mika/neutral-a1b2c3d4.webp",
			"/cg/letter-ja.webp",
		]);
	});

	test("lists every locale of a localized file without a locale", async () => {
		let { novel } = fixture();
		let hrefs = (await novel.links(SCENES.near, { depth: 0 })).map((link) => link.href);
		expect(hrefs).toContain("/cg/letter-en.webp");
		expect(hrefs).toContain("/cg/letter-ja.webp");
	});

	test("leaves out inlined data: URLs", async () => {
		let { novel } = fixture();
		let hrefs = (await novel.links(SCENES.start, { depth: 0 })).map((link) => link.href);
		expect(hrefs.some((href) => href.startsWith("data:"))).toBe(false);
	});

	test("prefers a localized file's language when the exact locale is missing", async () => {
		let { novel } = fixture();
		let hrefs = (await novel.links(SCENES.near, { depth: 0, locale: "ja-JP" })).map(
			(link) => link.href,
		);
		expect(hrefs).toContain("/cg/letter-ja.webp");
		expect(hrefs).not.toContain("/cg/letter-en.webp");
	});
});

describe("novel.reachable()", () => {
	test("walks jumps breadth-first to the given depth, importing lazy modules", async () => {
		let { novel, imports } = fixture();
		let reached = await novel.reachable(SCENES.start, { depth: 2, locale: "en" });
		expect(reached.map((entry) => [entry.scene, entry.depth])).toEqual([
			["start", 0],
			["near", 1],
			["unmapped", 1],
			["far", 2],
		]);
		expect(imports.far).toBe(1);
		expect(reached.find((entry) => entry.scene === "unmapped")?.assets).toEqual([]);
		expect(reached.find((entry) => entry.scene === "far")?.assets).toEqual([
			{ kind: "background", id: "backgrounds.street", url: "/bg/street.webp" },
		]);
	});

	test("stops before a lazy scene beyond the depth", async () => {
		let { novel, imports } = fixture();
		let reached = await novel.reachable(SCENES.start);
		expect(reached.map((entry) => entry.scene)).toEqual(["start", "near", "unmapped"]);
		expect(imports.far).toBe(0);
	});

	test("lists each scene's files by kind and id in document order", async () => {
		let { novel } = fixture();
		let [start] = await novel.reachable(SCENES.start, { depth: 0, locale: "en" });
		expect(start?.assets.map((asset) => `${asset.kind} ${asset.id}`)).toEqual([
			"background backgrounds.cafe",
			"music music.chill",
			"character cast.mika",
			"character cast.ren",
			"character cast.ren",
			"voice voice:mika:opening.welcome",
			"sound sounds.door",
		]);
	});

	test("lists a scene reached twice once, at its shortest depth", async () => {
		let { novel } = fixture();
		let reached = await novel.reachable(SCENES.start, { depth: 3 });
		expect(reached.filter((entry) => entry.scene === "start")).toHaveLength(1);
	});
});
