/**
 * The developer tools' library helpers and the methods built on them, without a browser: the
 * unlock catalog, the unlocked and locked records a preview reads, the edited-record check, why
 * each character counts as met, and the samples a linked player's toasts imitate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import type { Play, StartOptions } from "../index.js";

import {
	assets,
	cast,
	chapter,
	character,
	createNovel,
	createScene,
	encyclopedia,
	entry,
	scene,
	scenes,
	topic,
} from "../index.js";
import { INTERNALS } from "../novel.js";
import { emptyPersistent } from "../persistent.js";
import { DEFAULT_LABELS } from "../ui.js";

import { createDevTools } from "./devtools.js";
import { lockedPersistent, persistentProblem, unlockedPersistent } from "./library.js";
import { sampleNotification } from "./samples.js";

/** The story state every fixture in the package shares. */
const STATE = s.object({
	gold: s.defaulted(s.number(), 10),
	charm: s.defaulted(s.number(), 0),
	affection: s.defaulted(s.object({ mika: s.defaulted(s.number(), 0) }), { mika: 0 }),
	lastCatch: s.optional(s.object({ caught: s.number() })),
});

const SCENES = scenes({
	prologue: chapter({ title: "chapters.prologue", scenes: { opening: scene(), cafe: scene() } }),
});

const CAST = cast({
	mika: character({
		name: "cast.mika",
		sprites: { smile: "/mika-smile.webp", laugh: "/mika-laugh.webp" },
		bio: { past: { title: "cast.mikaPast", body: "cast.mikaPastBody" } },
	}),
	ren: character({
		name: "cast.ren",
		layers: { body: { school: "/ren-school.webp" }, face: { grin: "/g.webp", calm: "/c.webp" } },
	}),
	kai: character({ name: "cast.kai" }),
});

const ASSETS = assets({
	images: { letter: "/letter.webp" },
	music: { chill: "/chill.ogg" },
	sounds: { tick: "/tick.ogg" },
});

const LORE = encyclopedia({
	places: topic({ name: "lore.places", entries: { pier: entry({ title: "lore.pier" }) } }),
});

const OPENING = createScene(SCENES.prologue.opening, (ctx) => [
	ctx.narrate("opening.welcome"),
	ctx.say(CAST.mika, "opening.both"),
	ctx.notify("opening.lucky"),
	ctx.goto(SCENES.prologue.cafe),
]);

const CAFE = createScene(SCENES.prologue.cafe, (ctx) => [
	ctx.narrate("opening.done"),
	ctx.ending("endings.good"),
]);

/** The fixture novel with its connected tools and the starts they hand the app. */
function fixture() {
	let novel = createNovel({
		scenes: SCENES,
		cast: CAST,
		assets: ASSETS,
		encyclopedia: LORE,
		state: STATE,
		initial: SCENES.prologue.opening,
	});
	novel.map(SCENES.prologue.opening, OPENING);
	novel.map(SCENES.prologue.cafe, CAFE);
	let starts: StartOptions[] = [];
	let devtools = createDevTools(novel, { restart: (start) => starts.push(start) });
	return { novel, devtools, starts };
}

/** Advances a fresh play through its first `count` lines. */
async function playLines(play: Play, count: number): Promise<void> {
	let step = await play.next();
	for (let index = 1; index < count && !step.done; index += 1) {
		let frame = step.value;
		if (frame.type !== "line") throw new Error(`Expected a line, got ${frame.type}`);
		step = await play.next(frame.advance());
	}
}

describe("the unlock catalog", () => {
	test("lists every id persistent data can hold", async () => {
		let { devtools } = fixture();
		expect(await devtools.catalog()).toEqual({
			images: ["images.letter"],
			music: ["music.chill"],
			sprites: [
				"mika:smile",
				"mika:laugh",
				"ren:body=school,face=grin",
				"ren:body=school,face=calm",
			],
			entries: ["places.pier"],
			bios: ["mika:past"],
			characters: ["mika", "ren", "kai"],
			endings: ["endings.good"],
			chapters: ["prologue"],
			lines: [
				"prologue.opening:opening.welcome",
				"prologue.opening:opening.both",
				"prologue.cafe:opening.done",
			],
		});
	});

	test("unlocks everything or nothing, keeping the record's message values", async () => {
		let { devtools } = fixture();
		let base = {
			...emptyPersistent(),
			seen: { "prologue.opening:opening.both": { name: "Ada" } },
		};
		let unlocked = unlockedPersistent(await devtools.catalog(), base);
		expect(unlocked.unlocked.images).toEqual(["images.letter"]);
		expect(unlocked.introduced).toEqual(["mika", "ren", "kai"]);
		expect(unlocked.seen["prologue.opening:opening.both"]).toEqual({ name: "Ada" });
		expect(unlocked.seen["prologue.cafe:opening.done"]).toEqual({});
		expect(lockedPersistent(unlocked)).toEqual(emptyPersistent());
	});
});

describe("persistentProblem", () => {
	test("accepts a partial record and names the field a malformed one gets wrong", () => {
		expect(persistentProblem({ introduced: ["mika"] })).toBeUndefined();
		expect(persistentProblem([])).toBe("Persistent data must be an object.");
		expect(persistentProblem({ endings: "all" })).toContain("`endings`");
		expect(persistentProblem({ unlocked: { images: [1] } })).toContain("`unlocked.images`");
	});
});

describe("editing persistent data", () => {
	test("restarts the play on its line with the edited record", async () => {
		let { novel, devtools, starts } = fixture();
		await playLines(unwrap(novel.start()), 2);
		let edited = devtools.edit({ introduced: ["kai"], unlocked: { images: ["images.letter"] } });
		expect(isFailure(edited)).toBe(false);
		expect(starts).toHaveLength(1);
		expect(starts[0]?.from).toMatchObject({ position: { line: "opening.both" } });
		expect(starts[0]?.persistent).toMatchObject({
			introduced: ["kai"],
			unlocked: { images: ["images.letter"], music: [] },
		});
	});

	test("refuses a malformed record and starts nothing", async () => {
		let { novel, devtools, starts } = fixture();
		await playLines(unwrap(novel.start()), 1);
		let edited = devtools.edit({ chosen: "everything" });
		expect(isFailure(edited) && edited.error.code).toBe("invalid-state");
		expect(starts).toEqual([]);
	});
});

describe("previewing a screen", () => {
	test("reads the play's record, everything, or nothing, and leaves the play alone", async () => {
		let { novel, devtools, starts } = fixture();
		await playLines(unwrap(novel.start()), 1);
		let current = await devtools.previewScreen("gallery", "current");
		expect(current.persistent).toEqual(devtools.persistent);
		let unlocked = await devtools.previewScreen("gallery", "unlocked");
		expect(unlocked.persistent.unlocked.images).toEqual(["images.letter"]);
		expect(devtools.preview).toBe(unlocked);
		let locked = await devtools.previewScreen("characters", "locked");
		expect(locked.persistent.seen).toEqual({});
		devtools.closePreview();
		expect(devtools.preview).toBeUndefined();
		expect(starts).toEqual([]);
	});
});

describe("explaining the cast", () => {
	test("names why each character counts as met", async () => {
		let { devtools } = fixture();
		let report = await devtools.cast({
			seen: { "prologue.opening:opening.both": {} },
			unlocked: { sprites: ["ren:body=school,face=grin"] },
			introduced: ["kai"],
		});
		expect(
			report.map(({ id, met, introduced, lines, looks }) => ({
				id,
				met,
				introduced,
				lines,
				looks,
			})),
		).toEqual([
			{
				id: "mika",
				met: true,
				introduced: false,
				lines: ["prologue.opening:opening.both"],
				looks: [],
			},
			{ id: "ren", met: true, introduced: false, lines: [], looks: ["ren:body=school,face=grin"] },
			{ id: "kai", met: true, introduced: true, lines: [], looks: [] },
		]);
		let empty = await devtools.cast({});
		expect(empty.every((character) => !character.met)).toBe(true);
	});
});

describe("sample notifications", () => {
	test("word each toast the way the player does", async () => {
		let { novel } = fixture();
		let internals = novel[INTERNALS]();
		let source = { labels: DEFAULT_LABELS, t: (key: string) => `<${key}>` };
		expect(await sampleNotification(internals, "entry", source)).toEqual({
			text: "New entry: <lore.pier>",
			kind: "entry",
			opens: { entry: "places.pier" },
		});
		expect(await sampleNotification(internals, "bio", source)).toMatchObject({
			opens: { character: "mika" },
		});
		expect(await sampleNotification(internals, "ending", source)).toEqual({
			text: "Ending 1/1",
			kind: "ending",
		});
		expect(await sampleNotification(internals, "notify", source)).toEqual({
			key: "opening.lucky",
			kind: "notify",
		});
	});

	test("lists no interface sound before a player or title links", async () => {
		let { devtools } = fixture();
		expect(devtools.sounds).toEqual([]);
		expect(await devtools.playSound("select")).toBe(false);
	});
});
