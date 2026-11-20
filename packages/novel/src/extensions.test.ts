/**
 * The story extension specification: an extension's directives change its slice through the
 * play, conditions read the slice, saves, loads and rollback carry it, its listeners fire, and
 * `createTestPlay` and `explore` see it like the rest of the state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, expectTypeOf, test } from "vitest";

import { createTestPlay, explore } from "./test.js";

import type {
	CharacterDeclaration,
	ChoiceEvent,
	Directive,
	ExtensionDirective,
	GameState,
	NovelState,
	Play,
	SceneDeclaration,
} from "./index.js";

import { cast, character, createNovel, createScene, extension, scene, scenes } from "./index.js";

/** The story state every fixture in the package shares. */
const STATE = s.object({
	gold: s.defaulted(s.number(), 10),
	charm: s.defaulted(s.number(), 0),
	affection: s.defaulted(s.object({ mika: s.defaulted(s.number(), 0) }), { mika: 0 }),
	lastCatch: s.optional(s.object({ caught: s.number() })),
});

/** Choices the `choice` listener of {@link BOND} saw, in order. */
const CHOSEN: ChoiceEvent[] = [];

/** How close the reader is to each character, by character id. */
const BOND = extension("bond", {
	state: s.record(s.string(), s.number()),
	initial: {},
	directives: (ctx) => ({
		raise: (character: CharacterDeclaration, amount: number) =>
			ctx.update((value) => ({ ...value, [character.id]: (value[character.id] ?? 0) + amount })),
		reset: () => [ctx.update({}), ctx.set("charm", 0)],
		whenClose: (character: CharacterDeclaration, directives: Directive[]) =>
			ctx.when((state) => (state.bond[character.id] ?? 0) >= 30, directives),
		cheer: (character: CharacterDeclaration) => [
			ctx.update((value) => ({ ...value, [character.id]: (value[character.id] ?? 0) + 1 })),
			ctx.notify("opening.lucky"),
		],
		date: (...candidates: SceneDeclaration[]) =>
			ctx.goto.oneOf(candidates, (_candidate, state) => (state.bond.mika ?? 0) >= 10),
	}),
	on: {
		choice(event) {
			CHOSEN.push(event);
		},
	},
});

/** Flags the story has raised; an extension with a slice and no directives. */
const FLAGS = extension("flags", {
	state: s.defaulted(s.array(s.string()), []),
	initial: [],
});

/** The extensions the fixture novel passes and `NovelTypes` declares. */
const EXTENSIONS = [BOND, FLAGS] as const;

declare module "./types.js" {
	interface NovelTypes {
		extensions: typeof EXTENSIONS;
	}
}

const SCENES = scenes({ opening: scene(), cafe: scene(), stray: scene(), outing: scene() });

const CAST = cast({ mika: character({ name: "cast.mika" }) });

const OPENING = createScene(SCENES.opening, (ctx) => [
	ctx.narrate("opening.welcome"),
	ctx.bond.raise(CAST.mika, 10),
	ctx.narrate("opening.thinking"),
	ctx.choose({
		"opening.flirt": [ctx.bond.raise(CAST.mika, 20), ctx.set("flags", ["flirted"])],
		"opening.done": [],
	}),
	ctx.when(
		(state) => (state.bond.mika ?? 0) >= 30,
		[ctx.ending("endings.good")],
		[ctx.goto(SCENES.cafe)],
	),
]);

const CAFE = createScene(SCENES.cafe, (ctx) => [
	ctx.narrate("opening.done"),
	ctx.bond.whenClose(CAST.mika, [ctx.narrate("opening.lucky")]),
	ctx.bond.reset(),
	ctx.ending("endings.bad"),
]);

const OUTING = createScene(SCENES.outing, (ctx) => [
	ctx.bond.cheer(CAST.mika),
	ctx.bond.date(SCENES.cafe),
	ctx.narrate("opening.thinking"),
]);

const STRAY = createScene(SCENES.stray, (ctx) => [
	// @ts-expect-error -- no extension is named "missing"
	ctx.missing.call(),
	ctx.narrate("opening.done"),
]);

/** A novel with both extensions and every scene mapped. */
function fixture(
	extensions: NonNullable<Parameters<typeof createNovel>[0]["extensions"]> = EXTENSIONS,
) {
	let novel = createNovel({
		scenes: SCENES,
		cast: CAST,
		state: STATE,
		initial: SCENES.opening,
		extensions,
	});
	novel.map(SCENES.opening, OPENING);
	novel.map(SCENES.cafe, CAFE);
	novel.map(SCENES.stray, STRAY);
	novel.map(SCENES.outing, OUTING);
	return novel;
}

/** Starts the play and answers its line frames until it stops at something else. */
async function advanceLines(play: Play): Promise<void> {
	let step = await play.next();
	while (!step.done && step.value.type === "line") step = await play.next(step.value.advance());
}

describe("scenes", () => {
	test("record extension calls as data until the novel loads the scene", () => {
		expect(OPENING.directives[1]).toEqual({
			type: "extension",
			extension: "bond",
			method: "raise",
			args: [CAST.mika, 10],
		});
	});

	test("change the extension's slice through the play", async () => {
		let play = createTestPlay(fixture(), { seed: "bond" });
		await play.advance();
		expect(play.state.bond).toEqual({});
		await play.advance();
		expect(play.state.bond).toEqual({ mika: 10 });
		await play.advanceUntil("choice");
		await play.choose("opening.flirt");
		expect(play.ending?.key).toBe("endings.good");
		expect(play.state).toMatchObject({ bond: { mika: 30 }, flags: ["flirted"] });
	});

	test("expand a method that answers several directives", async () => {
		let play = createTestPlay(fixture(), { state: { charm: 5, bond: { mika: 3 } } });
		await play.advanceUntil("choice");
		await play.choose("opening.done");
		await play.advance();
		expect(play.transcript.map((entry) => entry.type === "line" && entry.key)).not.toContain(
			"opening.lucky",
		);
		expect(play.ending?.key).toBe("endings.bad");
		expect(play.state).toMatchObject({ charm: 0, bond: {} });
	});

	test("pick a scene at runtime from what a method answers", async () => {
		let close = createTestPlay(fixture(), { scene: SCENES.outing, state: { bond: { mika: 9 } } });
		await close.advance();
		expect(close.scene).toBe(SCENES.cafe);

		let distant = createTestPlay(fixture(), { scene: SCENES.outing });
		await distant.advance();
		expect(distant.scene).toBe(SCENES.outing);
		expect(distant.frame).toMatchObject({ type: "line", key: "opening.thinking" });
	});

	test("notify from a method beside the change to the slice", async () => {
		let play = createTestPlay(fixture(), { scene: SCENES.outing });
		await play.advance();
		expect(play.state.bond).toEqual({ mika: 1 });
		expect(play.events.filter((event) => event.type === "notify")).toEqual([
			{ type: "notify", payload: { scene: "outing", key: "opening.lucky", values: undefined } },
		]);
	});

	test("fail to load a scene that calls an extension the novel lacks", async () => {
		let play = unwrap(fixture().start({ scene: SCENES.stray }));
		let frame = await play.next();
		expect(!frame.done && frame.value.type === "error" && frame.value.error).toMatchObject({
			code: "load-failed",
			subject: "stray",
		});
	});

	test("fail to load a scene when the novel was built without the extension", async () => {
		let play = unwrap(fixture([FLAGS]).start());
		let frame = await play.next();
		expect(!frame.done && frame.value.type === "error" && frame.value.error.message).toContain(
			'extension "bond"',
		);
	});
});

describe("state", () => {
	test("starts each slice from its initial value, or from the starting state", () => {
		let fresh = unwrap(fixture().start());
		expect(fresh.state.state).toEqual({
			gold: 10,
			charm: 0,
			affection: { mika: 0 },
			bond: {},
			flags: [],
		});
		let given = unwrap(fixture().start({ state: { bond: { mika: 7 } } }));
		expect(given.state.state.bond).toEqual({ mika: 7 });
	});

	test("refuses a slice its schema rejects", () => {
		let started = fixture().start({ state: { bond: { mika: "close" } } as never });
		expect(isFailure(started) && started.error).toMatchObject({ code: "invalid-state" });
		expect(isFailure(started) && started.error.message).toContain("bond");
	});

	test("saves the slice with the play and loads it back", async () => {
		let play = unwrap(fixture().start());
		await advanceLines(play);
		let saved = JSON.parse(JSON.stringify(play.state)) as GameState;
		expect(saved.state.bond).toEqual({ mika: 10 });

		let resumed = unwrap(fixture().start({ from: saved }));
		expect(resumed.state.state.bond).toEqual({ mika: 10 });
	});

	test("loads a save made before the extension existed with its initial value", async () => {
		let play = unwrap(fixture().start());
		await advanceLines(play);
		let saved = JSON.parse(JSON.stringify(play.state)) as GameState;
		let { bond: _bond, flags: _flags, ...older } = saved.state as Record<string, unknown>;

		let resumed = unwrap(fixture().start({ from: { ...saved, state: older } }));
		expect(resumed.state.state).toMatchObject({ bond: {}, flags: [] });

		let invalid = fixture().start({ from: { ...saved, state: { ...older, bond: [] } } });
		expect(isFailure(invalid) && invalid.error.code).toBe("invalid-state");
	});

	test("rolls the slice back with the stop", async () => {
		let play = unwrap(fixture().start());
		let welcome = await play.next();
		if (welcome.done || welcome.value.type !== "line") throw new Error("Expected a line");
		await play.next(welcome.value.advance());
		expect(play.state.state.bond).toEqual({ mika: 10 });
		await play.rollback();
		expect(play.state.state.bond).toEqual({});
	});
});

describe("listeners", () => {
	test("fire with the novel's other listeners", async () => {
		CHOSEN.length = 0;
		let play = createTestPlay(fixture());
		await play.advanceUntil("choice");
		await play.choose("opening.done");
		expect(CHOSEN).toEqual([{ scene: "opening", option: "opening.done" }]);
	});
});

describe("tools", () => {
	test("explore branches on extension state", async () => {
		let report = await explore(fixture());
		expect(report.endings.map((ending) => String(ending.key)).sort()).toEqual([
			"endings.bad",
			"endings.good",
		]);
		let good = report.endings.find((ending) => ending.key === "endings.good");
		expect(good?.steps).toEqual([{ type: "choice", option: "opening.flirt" }]);
		expect(report.errors.map((error) => error.code)).toEqual([]);
	});

	test("explore starts from a slice in the starting state", async () => {
		let report = await explore(fixture(), { state: { bond: { mika: 25 } } });
		expect(report.endings.map((ending) => ending.key)).toEqual(["endings.good"]);
	});
});

describe("novel options", () => {
	test("refuses extensions sharing a name or named like a directive", () => {
		expect(() => fixture([BOND, BOND])).toThrow('"bond" is passed more than once');
		let shadowing = extension("say", { state: s.number(), initial: 0 });
		expect(() => fixture([shadowing])).toThrow('"say"');
		let dotted = extension("a.b", { state: s.number(), initial: 0 });
		expect(() => fixture([dotted])).toThrow('"a.b"');
	});
});

describe("types", () => {
	test("types extension calls and slices from NovelTypes", () => {
		createScene(SCENES.stray, (ctx) => {
			expectTypeOf(ctx.bond.raise).parameters.toEqualTypeOf<
				[character: CharacterDeclaration, amount: number]
			>();
			expectTypeOf(ctx.bond.raise(CAST.mika, 1)).toEqualTypeOf<ExtensionDirective>();
			return [
				// @ts-expect-error -- the amount is a number
				ctx.bond.raise(CAST.mika, "lots"),
				// @ts-expect-error -- bond has no such method
				ctx.bond.lower(CAST.mika, 1),
				// @ts-expect-error -- flags declares no directives
				ctx.flags.raise(),
				ctx.set("bond.mika", 3),
				ctx.set("flags", ["met"]),
				// @ts-expect-error -- flags holds strings
				ctx.set("flags", [1]),
				ctx.when((state) => state.flags.includes("met"), []),
			];
		});
		expectTypeOf<NovelState["bond"]>().toEqualTypeOf<Record<string, number>>();
		expectTypeOf<NovelState["flags"]>().toEqualTypeOf<string[]>();
		expect(isSuccess(fixture().start())).toBe(true);
	});
});
