/**
 * The unlockables specification for `check`: every sprite, CG, track, encyclopedia entry and
 * character the extras screens list must be one some scene can show, play, teach or introduce,
 * or the reader finds it locked forever. Any branch of any mapped scene counts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import { check } from "./test.js";

import {
	assets,
	cast,
	character,
	createNovel,
	createScene,
	encyclopedia,
	entry,
	lazy,
	scene,
	scenes,
	topic,
} from "./index.js";

/** The story state every fixture in the package shares. */
const STATE = s.object({
	gold: s.defaulted(s.number(), 10),
	charm: s.defaulted(s.number(), 0),
	affection: s.defaulted(s.object({ mika: s.defaulted(s.number(), 0) }), { mika: 0 }),
	lastCatch: s.optional(s.object({ caught: s.number() })),
});

const SCENES = scenes({ start: scene(), side: scene(), broken: scene() });

const CAST = cast({
	mika: character({
		name: "cast.mika",
		sprites: {
			smile: "/mika/smile.webp",
			neutral: "/mika/neutral.webp",
			laugh: "/mika/laugh.webp",
		},
	}),
	ren: character({
		name: "cast.ren",
		layers: {
			body: { school: "/ren/body-school.webp", casual: "/ren/body-casual.webp" },
			face: { neutral: "/ren/face-neutral.webp", grin: "/ren/face-grin.webp" },
		},
	}),
	kai: character({ name: "cast.kai" }),
	guard: character({ name: "cast.prefect" }),
	sora: character({ name: "cast.sora", sprites: { calm: "/sora/calm.webp" } }),
	prefect: character({
		name: "cast.prefect",
		lore: { listed: false },
		sprites: { stern: "/prefect/stern.webp" },
	}),
	player: character({ name: "cast.player", lore: { known: true } }),
});

const ASSETS = assets({
	backgrounds: { cafe: "/bg/cafe.webp", pier: "/bg/pier.webp" },
	images: { letter: "/cg/letter.webp", photo: "/cg/photo.webp" },
	music: { chill: "/music/chill.ogg", storm: "/music/storm.ogg" },
	ambience: { rain: "/ambience/rain.ogg" },
	sounds: { door: "/sfx/door.ogg" },
});

const LORE = encyclopedia({
	places: topic({
		name: "lore.places",
		entries: {
			cafe: entry({ title: "lore.cafe", known: true }),
			pier: entry({ title: "lore.pier" }),
		},
	}),
	terms: topic({ name: "lore.terms", entries: { secret: entry({ title: "lore.secret" }) } }),
});

/**
 * Shows, plays and teaches most of what the fixture declares, much of it on one branch only:
 * Mika's neutral sprite in a condition's `otherwise`, the letter and the pier in a menu option,
 * the chill track in a scene only the menu reaches.
 */
const START = createScene(SCENES.start, (ctx) => [
	ctx.show(ASSETS.backgrounds.cafe),
	ctx.introduce(CAST.mika),
	ctx.introduce(CAST.kai),
	ctx.enter(CAST.mika, { at: "left" }),
	ctx.enter(CAST.ren, { at: "right", layers: { body: "school", face: "grin" } }),
	ctx.say(CAST.guard, "opening.welcome"),
	ctx.when(
		(state) => state.gold > 10,
		[ctx.narrate("opening.lucky")],
		[ctx.express(CAST.mika, { expression: "neutral" }), ctx.narrate("opening.unlucky")],
	),
	ctx.choose({
		"opening.askName": [
			ctx.show(ASSETS.images.letter),
			ctx.learn(LORE.places.entries.pier),
			ctx.goto(SCENES.side),
		],
		"opening.done": [ctx.ending("endings.bad")],
	}),
]);

const SIDE = createScene(SCENES.side, (ctx) => [
	ctx.play(ASSETS.music.chill),
	ctx.narrate("flashback.memory"),
	ctx.ending("endings.good"),
]);

/** A novel over the fixture with the start and side scenes mapped, and nothing else. */
function fixture() {
	let novel = createNovel({
		scenes: SCENES,
		cast: CAST,
		assets: ASSETS,
		encyclopedia: LORE,
		state: STATE,
		initial: SCENES.start,
	});
	novel.map(SCENES.start, START);
	novel.map(SCENES.side, SIDE);
	return novel;
}

describe("check reports what the reader can never unlock", () => {
	test("names each locked sprite, CG, track, entry and unmet character as a warning", async () => {
		let report = await check(fixture());
		expect(report.ok).toBe(true);
		expect(report.problems).toEqual([
			{ code: "unreachable-scene", severity: "warning", scene: "broken" },
			{ code: "unshown-sprite", severity: "warning", character: "mika", sprite: "laugh" },
			{ code: "unmet-character", severity: "warning", character: "sora" },
			{ code: "unshown-sprite", severity: "warning", character: "sora", sprite: "calm" },
			{ code: "unshown-image", severity: "warning", asset: "images.photo" },
			{ code: "unplayed-music", severity: "warning", asset: "music.storm" },
			{ code: "unlearned-entry", severity: "warning", entry: "terms.secret" },
		]);
	});

	test("counts a sprite, CG, track or entry used anywhere, a scene nothing jumps to included", async () => {
		let novel = fixture();
		novel.map(
			SCENES.broken,
			createScene(SCENES.broken, (ctx) => [
				ctx.enter(CAST.mika, { at: "left", expression: "laugh" }),
				ctx.enter(CAST.sora, { at: "right" }),
				ctx.show(ASSETS.images.photo),
				ctx.play(ASSETS.music.storm),
				ctx.learn(LORE.terms.entries.secret),
				ctx.narrate("opening.welcome"),
			]),
		);
		let report = await check(novel);
		expect(report.problems).toEqual([
			{ code: "unreachable-scene", severity: "warning", scene: "broken" },
		]);
	});

	test("reads an expression the character lacks as the first sprite, as the stage draws it", async () => {
		let novel = fixture();
		novel.map(
			SCENES.broken,
			createScene(SCENES.broken, (ctx) => [
				ctx.enter(CAST.sora, { at: "left", expression: "missing" as "calm" }),
				ctx.express(CAST.mika, { expression: "laugh" }),
				ctx.narrate("opening.welcome"),
			]),
		);
		let report = await check(novel);
		expect(report.problems.map((problem) => problem.code)).not.toContain("unshown-sprite");
		expect(report.problems.map((problem) => problem.code)).not.toContain("unmet-character");
	});

	test("reports nothing locked while a scene fails to load, since its content is unknown", async () => {
		let novel = fixture();
		novel.map(
			SCENES.broken,
			lazy(async () => {
				throw new Error("network down");
			}),
		);
		let report = await check(novel);
		expect(report.problems).toEqual([
			{
				code: "load-failed",
				severity: "error",
				scene: "broken",
				message: 'Scene "broken" failed to load.',
			},
			{ code: "unreachable-scene", severity: "warning", scene: "broken" },
		]);
	});
});
