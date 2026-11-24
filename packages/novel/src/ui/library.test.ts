/**
 * Reads a novel's library the way the extras screens do: the lines and endings a scene holds,
 * found statically, and the reached scenes, read lines, unlocks and endings built from the
 * declarations and a stored `Persistent` value, with a scene that fails to load listed empty.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import {
	arc,
	assets,
	cast,
	chapter,
	character,
	createNovel,
	createScene,
	lazy,
	scene,
	scenes,
} from "../index.js";

import { endingKeys, readLibrary, sceneLines } from "./library.js";

const STATE = s.object({
	gold: s.defaulted(s.number(), 10),
	charm: s.defaulted(s.number(), 0),
	affection: s.defaulted(s.object({ mika: s.defaulted(s.number(), 0) }), { mika: 0 }),
	lastCatch: s.optional(s.object({ caught: s.number() })),
});

const SCENES = scenes({
	prologue: chapter({
		title: "chapters.prologue",
		scenes: { opening: scene({ title: "titles.opening" }), flashback: scene() },
	}),
	spring: chapter({ title: "titles.cafe", scenes: { cafe: scene({ title: "titles.cafe" }) } }),
	epilogue: scene(),
});

const CAST = cast({
	mika: character({ name: "cast.mika", color: "#e86a92", sprites: { smile: "/mika.webp" } }),
	ren: character({ name: "cast.ren" }),
});

const ASSETS = assets({
	backgrounds: { cafe: "/bg/cafe.webp" },
	images: { letter: { en: "/cg/letter-en.webp", ja: "/cg/letter-ja.webp" }, kiss: "/cg/kiss.webp" },
	music: { chill: "/music/chill.ogg", theme: "/music/theme.ogg" },
});

const OPENING = createScene(SCENES.prologue.opening, (ctx) => [
	ctx.narrate("opening.welcome"),
	ctx.say(CAST.mika, "opening.hello", { name: "Ada" }),
	ctx.when(
		(state) => state.gold > 5,
		[ctx.say(CAST.mika, "opening.lucky")],
		[ctx.narrate("opening.unlucky")],
	),
	ctx.choose({
		"cafe.stay": [ctx.goto(SCENES.spring.cafe)],
		"cafe.leave": [ctx.narrate("opening.done"), ctx.ending("endings.bad")],
	}),
]);

const CAFE = createScene(SCENES.spring.cafe, (ctx) => [
	ctx.say([CAST.mika, CAST.ren], "opening.both"),
	ctx.ending("endings.good"),
]);

const EPILOGUE = createScene(SCENES.epilogue, (ctx) => [ctx.narrate("opening.thinking")]);

/** The library's novel, with the flashback's module failing to load. */
function fixture() {
	let novel = createNovel({
		scenes: SCENES,
		cast: CAST,
		assets: ASSETS,
		state: STATE,
		initial: SCENES.prologue.opening,
		voice: ({ speaker, key }) => (speaker === "mika" ? `/voice/${key}.ogg` : undefined),
	});
	novel.map(SCENES.prologue.opening, OPENING);
	novel.map(
		SCENES.prologue.flashback,
		lazy(() => Promise.reject(new Error("offline"))),
	);
	novel.map(SCENES.spring.cafe, CAFE);
	novel.map(SCENES.epilogue, EPILOGUE);
	return novel;
}

describe(sceneLines, () => {
	test("lists every line in document order with its speakers, branches included", () => {
		expect(sceneLines(OPENING.directives)).toEqual([
			{ key: "opening.welcome", speakers: [] },
			{ key: "opening.hello", speakers: [{ id: "mika", name: "cast.mika", color: "#e86a92" }] },
			{ key: "opening.lucky", speakers: [{ id: "mika", name: "cast.mika", color: "#e86a92" }] },
			{ key: "opening.unlucky", speakers: [] },
			{ key: "opening.done", speakers: [] },
		]);
		expect(sceneLines(CAFE.directives)[0]?.speakers.map((speaker) => speaker.id)).toEqual([
			"mika",
			"ren",
		]);
	});
});

describe(endingKeys, () => {
	test("collects the endings a scene can reach, inside menu options too", () => {
		expect(endingKeys(OPENING.directives)).toEqual(["endings.bad"]);
		expect(endingKeys(EPILOGUE.directives)).toEqual([]);
	});
});

describe(readLibrary, () => {
	let persistent = {
		seen: {
			"prologue.opening:opening.hello": { name: "Ada" },
			"prologue.opening:opening.welcome": {},
		},
		chosen: [],
		endings: ["endings.bad", "endings.removed"],
		chapters: ["prologue"],
		unlocked: { images: ["images.letter"], music: ["music.theme"] },
	};

	test("groups mapped scenes by chapter with their read lines in scene order", async () => {
		let library = await readLibrary(fixture(), persistent, "en");
		expect(
			library.chapters.map((group) => ({
				chapter: group.chapter?.name ?? null,
				reached: group.reached,
				scenes: group.scenes.map((entry) => [entry.scene.name, entry.reached, entry.loaded]),
			})),
		).toEqual([
			{
				chapter: "prologue",
				reached: true,
				scenes: [
					["prologue.opening", true, true],
					["prologue.flashback", false, false],
				],
			},
			{ chapter: "spring", reached: false, scenes: [["spring.cafe", false, true]] },
			{ chapter: null, reached: false, scenes: [["epilogue", false, true]] },
		]);
		expect(library.chapters[0]?.scenes[0]?.lines).toEqual([
			{ key: "opening.welcome", speakers: [], values: {}, voice: null },
			{
				key: "opening.hello",
				speakers: [{ id: "mika", name: "cast.mika", color: "#e86a92" }],
				values: { name: "Ada" },
				voice: "/voice/opening.hello.ogg",
			},
		]);
	});

	test("groups chapters by arc, an arc reached once one of its chapters is", async () => {
		let story = scenes({
			y1: arc({
				title: "chapters.prologue",
				chapters: {
					ch01: chapter({ title: "titles.opening", scenes: { s1: scene() } }),
					ch02: chapter({ scenes: { s1: scene() } }),
				},
			}),
			y2: arc({
				title: "titles.cafe",
				chapters: { ch03: chapter({ scenes: { s1: scene() } }) },
			}),
			epilogue: scene(),
		});
		let novel = createNovel({ scenes: story, cast: CAST, state: STATE, initial: story.y1.ch01.s1 });
		for (let declared of [story.y1.ch01.s1, story.y1.ch02.s1, story.y2.ch03.s1, story.epilogue]) {
			novel.map(
				declared,
				createScene(declared, (ctx) => [ctx.narrate("opening.welcome")]),
			);
		}
		let library = await readLibrary(
			novel,
			{ ...persistent, seen: { "y1.ch02.s1:opening.welcome": {} }, chapters: ["y1.ch02"] },
			"en",
		);
		expect(
			library.arcs.map((group) => ({
				arc: group.arc,
				reached: group.reached,
				chapters: group.chapters.map((entry) => [entry.chapter?.name ?? null, entry.reached]),
			})),
		).toEqual([
			{
				arc: { name: "y1", title: "chapters.prologue" },
				reached: true,
				chapters: [
					["y1.ch01", false],
					["y1.ch02", true],
				],
			},
			{ arc: { name: "y2", title: "titles.cafe" }, reached: false, chapters: [["y2.ch03", false]] },
			{ arc: null, reached: false, chapters: [[null, false]] },
		]);
		expect(library.arcs.flatMap((group) => group.chapters)).toEqual(library.chapters);
	});

	test("puts every chapter of a story without arcs in one arc-less group", async () => {
		let library = await readLibrary(fixture(), persistent, "en");
		expect(library.arcs).toEqual([{ arc: null, reached: true, chapters: library.chapters }]);
	});

	test("marks unlocked images and tracks, and every known ending reached or not", async () => {
		let library = await readLibrary(fixture(), persistent, "ja-JP");
		expect(library.images).toEqual([
			{
				id: "images.letter",
				src: { en: "/cg/letter-en.webp", ja: "/cg/letter-ja.webp" },
				unlocked: true,
			},
			{ id: "images.kiss", src: "/cg/kiss.webp", unlocked: false },
		]);
		expect(library.music.map((track) => [track.id, track.unlocked])).toEqual([
			["music.chill", false],
			["music.theme", true],
		]);
		expect(library.endings).toEqual([
			{ key: "endings.bad", reached: true },
			{ key: "endings.good", reached: false },
			{ key: "endings.removed", reached: true },
		]);
	});

	test("reads stored data it cannot parse as a first playthrough", async () => {
		let library = await readLibrary(fixture(), "corrupt", "en");
		expect(library.persistent.seen).toEqual({});
		expect(library.chapters.every((group) => !group.reached)).toBe(true);
	});

	test("picks the reader's voice file when the novel declares locales", async () => {
		let novel = createNovel({
			scenes: SCENES,
			cast: CAST,
			state: STATE,
			initial: SCENES.prologue.opening,
			locales: ["en", "ja"],
			voice: ({ key, locale }) => `/voice/${locale}/${key}.ogg`,
		});
		novel.map(SCENES.prologue.opening, OPENING);
		let library = await readLibrary(novel, persistent, "ja-JP");
		expect(library.chapters[0]?.scenes[0]?.lines[1]?.voice).toBe("/voice/ja/opening.hello.ogg");
	});
});
