/**
 * The playthrough specification: a small novel with every directive, played through the
 * generator and through `createTestPlay`, asserting what each frame shows, what each reply
 * does, and that saves, rollback and seeded draws replay exactly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StandardSchemaV1 } from "@standard-schema/spec";

import { createRandom } from "@sdxc/random";
import { failure, isFailure, isSuccess, success, unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, expectTypeOf, test } from "vitest";

import { check, createTestPlay, explore } from "./test.js";

import type {
	ChoiceFrame,
	Frame,
	GameState,
	LineFrame,
	NovelEventName,
	NovelEvents,
	NovelOptions,
	Persistent,
	Play,
	Reply,
} from "./index.js";

import {
	assets,
	cast,
	chapter,
	character,
	createNovel,
	createScene,
	interaction,
	interactions,
	lazy,
	scene,
	scenes,
} from "./index.js";

/** The fixture's story state; every field has a default, so a new play starts from `{}`. */
const STATE = s.object({
	gold: s.defaulted(s.number(), 10),
	charm: s.defaulted(s.number(), 0),
	affection: s.defaulted(s.object({ mika: s.defaulted(s.number(), 0) }), { mika: 0 }),
	lastCatch: s.optional(s.object({ caught: s.number() })),
});

/** The fixture's English bundle, whose literal text types every key and its values. */
const EN = {
	cast: { mika: "Mika", ren: "Ren", player: "You" },
	chapters: { prologue: "Prologue" },
	titles: { opening: "Opening", cafe: "The café" },
	opening: {
		welcome: "Welcome to the café.",
		hello: "Hello, {$name}!",
		gold: "You have {$gold} gold.",
		both: "Together!",
		thinking: "I should say something.",
		lucky: "Lucky day.",
		unlucky: "Not my day.",
		back: "Back to now, with {$gold} gold.",
		ask: "What do you ask?",
		askName: "Your name?",
		answerName: "Mika.",
		askJob: "Your job?",
		answerJob: "I bake.",
		flirt: "Nice smile.",
		needCharm: "You need more charm.",
		secret: "Tell me a secret.",
		answerSecret: "I like you.",
		done: "That's all.",
	},
	flashback: { memory: "A letter, years ago." },
	cafe: { impressed: "Wow, {$caught} fish!", stay: "Stay", leave: "Leave" },
	endings: { good: "Good ending", bad: "Bad ending" },
	unwritten: { jump: "Jump." },
} as const;

declare module "./types.js" {
	interface NovelTypes {
		state: StandardSchemaV1.InferOutput<typeof STATE>;
		messages: typeof EN;
		interactions: typeof INTERACTIONS;
	}
}

const SCENES = scenes({
	prologue: chapter({
		title: "chapters.prologue",
		scenes: {
			opening: scene({ title: "titles.opening" }),
			flashback: scene(),
			cafe: scene({ title: "titles.cafe" }),
			unwritten: scene(),
			jump: scene(),
		},
	}),
});

const CAST = cast({
	mika: character({
		name: "cast.mika",
		color: "#e86a92",
		sprites: { smile: "/mika/smile.webp", neutral: "/mika/neutral.webp" },
	}),
	ren: character({
		name: "cast.ren",
		layers: {
			body: { school: "/ren/body-school.webp", casual: "/ren/body-casual.webp" },
			face: { neutral: "/ren/face-neutral.webp", grin: "/ren/face-grin.webp" },
		},
	}),
	player: character({ name: "cast.player" }),
});

const ASSETS = assets({
	backgrounds: { cafe: "/bg/cafe.webp" },
	images: { letter: { en: "/cg/letter-en.webp", ja: "/cg/letter-ja.webp" } },
	music: { chill: "/music/chill.ogg" },
	sounds: { door: { src: "/sfx/door.ogg", caption: "cafe.stay" } },
});

const INTERACTIONS = interactions({
	fishing: interaction({
		input: s.object({ difficulty: s.number() }),
		output: s.object({ caught: s.number() }),
	}),
});

const OPENING = createScene(SCENES.prologue.opening, (ctx) => [
	ctx.show(ASSETS.backgrounds.cafe, { transition: "fade" }),
	ctx.play(ASSETS.music.chill),
	ctx.enter(CAST.mika, { at: "left", expression: "smile" }),
	ctx.enter(CAST.ren, { at: "3/3", layers: { body: "school", face: "grin" } }),
	ctx.narrate("opening.welcome"),
	ctx.say(CAST.mika, "opening.hello", { name: "Ada" }),
	ctx.say(CAST.mika, "opening.gold", (state) => ({ gold: state.gold })),
	ctx.say([CAST.mika, CAST.ren], "opening.both"),
	ctx.say(CAST.player, "opening.thinking"),
	ctx.when(
		(_state, { random }) => random.bool(),
		[ctx.narrate("opening.lucky")],
		[ctx.narrate("opening.unlucky")],
	),
	ctx.set("gold", (gold) => gold + 5),
	ctx.call(SCENES.prologue.flashback),
	ctx.say(CAST.mika, "opening.back", (state) => ({ gold: state.gold })),
	ctx.wait(500),
	ctx.play(ASSETS.sounds.door),
	ctx.choose(
		{
			"opening.askName": { once: true, do: [ctx.say(CAST.mika, "opening.answerName")] },
			"opening.askJob": { once: true, do: [ctx.say(CAST.mika, "opening.answerJob")] },
			"opening.flirt": {
				when: (state) => state.charm >= 50,
				visibility: "disabled",
				reason: "opening.needCharm",
				do: [ctx.set("affection.mika", (value) => value + 10)],
			},
			"opening.secret": {
				when: (state) => state.affection.mika >= 40,
				once: true,
				do: [ctx.say(CAST.mika, "opening.answerSecret")],
			},
			"opening.done": { done: true, do: [] },
		},
		{ prompt: "opening.ask", repeat: true },
	),
	ctx.goto(SCENES.prologue.cafe),
]);

const FLASHBACK = createScene(SCENES.prologue.flashback, (ctx) => [
	ctx.show(ASSETS.images.letter, { transition: "dissolve" }),
	ctx.narrate("flashback.memory"),
	ctx.hide(ASSETS.images.letter),
	ctx.back(),
	ctx.narrate("unwritten.jump"),
]);

const CAFE = createScene(SCENES.prologue.cafe, (ctx) => [
	ctx.express(CAST.mika, { expression: "neutral" }),
	ctx.move(CAST.ren, { at: "2/3", transition: "slide" }),
	ctx.exit(CAST.ren),
	ctx.custom(INTERACTIONS.fishing, { input: { difficulty: 2 }, into: "lastCatch" }),
	ctx.when(
		(state) => (state.lastCatch?.caught ?? 0) >= 3,
		[ctx.say(CAST.mika, "cafe.impressed", (state) => ({ caught: state.lastCatch?.caught ?? 0 }))],
	),
	ctx.choose({
		"cafe.stay": [ctx.set("affection.mika", (value) => value + 5), ctx.ending("endings.good")],
		"cafe.leave": [ctx.ending("endings.bad")],
	}),
]);

const JUMP = createScene(SCENES.prologue.jump, (ctx) => [
	ctx.narrate("unwritten.jump"),
	ctx.goto(SCENES.prologue.unwritten),
]);

/** A novel over the fixture, with the flashback loaded lazily the way an app maps its scenes. */
function fixture(options: Partial<NovelOptions> = {}) {
	let novel = createNovel({
		scenes: SCENES,
		cast: CAST,
		assets: ASSETS,
		interactions: INTERACTIONS,
		state: STATE,
		initial: SCENES.prologue.opening,
		voice: ({ speaker, key }) => (speaker === "mika" ? `/voice/mika/${key}.ogg` : undefined),
		...options,
	});
	novel.map(SCENES.prologue.opening, OPENING);
	novel.map(
		SCENES.prologue.flashback,
		lazy(async () => ({ default: FLASHBACK })),
	);
	novel.map(SCENES.prologue.cafe, CAFE);
	novel.map(SCENES.prologue.jump, JUMP);
	return novel;
}

/** Starts a play over the fixture. */
function start(seed = "fixture") {
	return unwrap(fixture().start({ seed }));
}

/** Reads the frame a step yielded, failing the test when the play finished instead. */
function frameOf(step: IteratorResult<Frame, unknown>): Frame {
	if (step.done) throw new Error("Expected a frame, the play finished");
	return step.value;
}

/** Advances a line or pause frame, failing the test on any other frame. */
async function advance(play: Play, frame: Frame): Promise<Frame> {
	if (frame.type !== "line" && frame.type !== "pause") {
		throw new Error(`Expected a line or pause, got ${frame.type}`);
	}
	return frameOf(await play.next(frame.advance()));
}

/** Narrows a frame to a line. */
function line(frame: Frame): LineFrame {
	if (frame.type !== "line") throw new Error(`Expected a line, got ${frame.type}`);
	return frame;
}

/** Narrows a frame to a menu. */
function choice(frame: Frame): ChoiceFrame {
	if (frame.type !== "choice") throw new Error(`Expected a choice, got ${frame.type}`);
	return frame;
}

/** Advances through lines and pauses until a frame of `type`. */
async function until(play: Play, frame: Frame, type: Frame["type"]): Promise<Frame> {
	let current = frame;
	while (current.type !== type) current = await advance(play, current);
	return current;
}

describe("declarations", () => {
	test("names scenes by their path and carries their chapter", () => {
		expect(SCENES.prologue.opening.name).toBe("prologue.opening");
		expect(SCENES.prologue.opening.title).toBe("titles.opening");
		expect(SCENES.prologue.opening.chapter).toEqual({
			name: "prologue",
			title: "chapters.prologue",
		});
		expectTypeOf(SCENES.prologue.cafe.name).toEqualTypeOf<"prologue.cafe">();
	});

	test("names characters and assets by their keys", () => {
		expect(CAST.mika.id).toBe("mika");
		expect(CAST.player.image).toEqual({ kind: "none" });
		expect(ASSETS.backgrounds.cafe).toMatchObject({ kind: "background", id: "backgrounds.cafe" });
		expect(ASSETS.sounds.door).toMatchObject({ src: "/sfx/door.ogg", caption: "cafe.stay" });
		expect(INTERACTIONS.fishing.name).toBe("fishing");
	});

	test("builds a scene once into plain directives", () => {
		expect(OPENING.scene).toBe(SCENES.prologue.opening);
		expect(OPENING.directives[0]).toEqual({
			type: "show",
			asset: ASSETS.backgrounds.cafe,
			transition: "fade",
		});
		expect(OPENING.directives[5]).toEqual({
			type: "say",
			speakers: [CAST.mika],
			key: "opening.hello",
			values: { name: "Ada" },
		});
	});

	test("types keys, values, state paths, expressions and interactions", () => {
		createScene(SCENES.prologue.unwritten, (ctx) => [
			// @ts-expect-error -- the message declares $name
			ctx.say(CAST.mika, "opening.hello"),
			// @ts-expect-error -- the message declares $name, not $gold
			ctx.say(CAST.mika, "opening.hello", { gold: 1 }),
			// @ts-expect-error -- no such key in the bundle
			ctx.narrate("opening.missing"),
			// @ts-expect-error -- Mika has no angry sprite
			ctx.enter(CAST.mika, { at: "1/3", expression: "angry" }),
			// @ts-expect-error -- Ren names a variant for every layer
			ctx.enter(CAST.ren, { at: "1/3", layers: { body: "school" } }),
			// @ts-expect-error -- the player has no image to put on stage
			ctx.enter(CAST.player, { at: "1/3" }),
			// @ts-expect-error -- gold is a number
			ctx.set("gold", "lots"),
			// @ts-expect-error -- no such state path
			ctx.set("silver", 1),
			// @ts-expect-error -- the input needs a difficulty
			ctx.custom(INTERACTIONS.fishing, { input: {} }),
			// @ts-expect-error -- gold cannot hold a catch
			ctx.custom(INTERACTIONS.fishing, { input: { difficulty: 1 }, into: "gold" }),
			ctx.express(CAST.ren, { layers: { face: "neutral" } }),
			ctx.set("affection.mika", 3),
		]);
		expectTypeOf<Parameters<LineFrame["advance"]>>().toEqualTypeOf<[]>();
	});
});

describe("playing through the generator", () => {
	test("shows lines over a complete stage, with speaker focus and voices", async () => {
		let play = start();
		let welcome = line(frameOf(await play.next()));

		expect(welcome).toMatchObject({ key: "opening.welcome", speakers: [], voice: null });
		expect(welcome.scene).toBe("prologue.opening");
		expect(welcome.stage.background).toEqual({
			id: "backgrounds.cafe",
			src: "/bg/cafe.webp",
			transition: "fade",
		});
		expect(welcome.stage.characters).toEqual([
			{
				id: "mika",
				at: "1/3",
				expression: "smile",
				images: ["/mika/smile.webp"],
				speaking: false,
			},
			{
				id: "ren",
				at: "3/3",
				layers: { body: "school", face: "grin" },
				images: ["/ren/body-school.webp", "/ren/face-grin.webp"],
				speaking: false,
			},
		]);
		expect(welcome.audio.music).toEqual({ id: "music.chill", src: "/music/chill.ogg" });

		let hello = line(await advance(play, welcome));
		expect(hello.speakers).toEqual([{ id: "mika", name: "cast.mika", color: "#e86a92" }]);
		expect(hello.values).toEqual({ name: "Ada" });
		expect(hello.voice).toBe("/voice/mika/opening.hello.ogg");
		expect(hello.audio.voice).toBe("/voice/mika/opening.hello.ogg");
		expect(hello.stage.background?.transition).toBeUndefined();
		expect(hello.stage.characters.map((entry) => entry.speaking)).toEqual([true, false]);

		let gold = line(await advance(play, hello));
		expect(gold.values).toEqual({ gold: 10 });

		let both = line(await advance(play, gold));
		expect(both.stage.characters.map((entry) => entry.speaking)).toEqual([true, true]);

		let thinking = line(await advance(play, both));
		expect(thinking.speakers.map((speaker) => speaker.id)).toEqual(["player"]);
		expect(thinking.stage.characters.map((entry) => entry.speaking)).toEqual([false, false]);
	});

	test("draws from the play's seeded stream in callbacks", async () => {
		let expected = createRandom("fixture").bool() ? "opening.lucky" : "opening.unlucky";
		let play = start();
		let frame = frameOf(await play.next());
		for (let index = 0; index < 5; index++) frame = await advance(play, frame);
		expect(line(frame).key).toBe(expected);
	});

	test("calls a scene, returns, and evaluates values once from the state they read", async () => {
		let play = start();
		let frame = frameOf(await play.next());
		for (let index = 0; index < 6; index++) frame = await advance(play, frame);

		let memory = line(frame);
		expect(memory.key).toBe("flashback.memory");
		expect(memory.scene).toBe("prologue.flashback");
		expect(memory.stage.image).toEqual({
			id: "images.letter",
			src: { en: "/cg/letter-en.webp", ja: "/cg/letter-ja.webp" },
			transition: "dissolve",
		});

		let back = line(await advance(play, memory));
		expect(back.key).toBe("opening.back");
		expect(back.scene).toBe("prologue.opening");
		expect(back.stage.image).toBeNull();
		expect(back.values).toEqual({ gold: 15 });
		expect(play.state.stack).toEqual([]);
	});

	test("pauses, plays a sound once, and runs a question hub", async () => {
		let play = start();
		let frame = await until(play, frameOf(await play.next()), "pause");
		expect(frame).toMatchObject({ type: "pause", duration: 500 });

		let menu = choice(await advance(play, frame));
		expect(menu.prompt).toBe("opening.ask");
		expect(menu.audio.sounds).toEqual([
			expect.objectContaining({ id: "sounds.door", src: "/sfx/door.ogg", caption: "cafe.stay" }),
		]);
		expect(menu.options).toEqual([
			{ id: "opening.askName", label: "opening.askName", disabled: false, chosen: false },
			{ id: "opening.askJob", label: "opening.askJob", disabled: false, chosen: false },
			{
				id: "opening.flirt",
				label: "opening.flirt",
				disabled: true,
				reason: "opening.needCharm",
				chosen: false,
			},
			{ id: "opening.done", label: "opening.done", disabled: false, chosen: false },
		]);

		let locked = frameOf(await play.next(menu.choose("opening.flirt")));
		expect(locked).toMatchObject({ type: "error", frame: menu });
		if (locked.type !== "error") throw new Error("Expected an error frame");
		expect(locked.error.code).toBe("unavailable-option");

		let answer = line(frameOf(await play.next(menu.choose("opening.askName"))));
		expect(answer.key).toBe("opening.answerName");
		expect(answer.audio.sounds).toEqual([]);

		let again = choice(await advance(play, answer));
		expect(again.options.map((option) => option.id)).toEqual([
			"opening.askJob",
			"opening.flirt",
			"opening.done",
		]);

		let cafe = frameOf(await play.next(again.choose("opening.done")));
		expect(cafe).toMatchObject({
			type: "custom",
			interaction: "fishing",
			input: { difficulty: 2 },
		});
		expect(cafe.type === "custom" && cafe.scene).toBe("prologue.cafe");
		expect(play.state.taken).toEqual([
			"prologue.opening:opening.askName",
			"prologue.opening:opening.done",
		]);
	});

	test("validates an interaction's output, stores it, and finishes at an ending", async () => {
		let play = start();
		let frame = frameOf(await play.next());
		frame = await until(play, frame, "choice");
		frame = frameOf(await play.next(choice(frame).choose("opening.done")));
		if (frame.type !== "custom") throw new Error("Expected the fishing interaction");

		expect(frame.stage.characters).toEqual([
			{
				id: "mika",
				at: "1/3",
				expression: "neutral",
				images: ["/mika/neutral.webp"],
				speaking: false,
			},
		]);
		expectTypeOf(frame.input).toEqualTypeOf<{ difficulty: number }>();

		let refused = frameOf(await play.next(frame.complete({ caught: "many" } as never)));
		expect(refused).toMatchObject({ type: "error", frame });
		expect(refused.type === "error" && refused.error.code).toBe("invalid-output");

		let impressed = line(frameOf(await play.next(frame.complete({ caught: 4 }))));
		expect(impressed.values).toEqual({ caught: 4 });
		expect(play.state.state.lastCatch).toEqual({ caught: 4 });

		let menu = choice(await advance(play, impressed));
		let finished = await play.next(menu.choose("cafe.stay"));
		expect(finished).toEqual({
			done: true,
			value: { key: "endings.good", scene: "prologue.cafe" },
		});
		expect(play.state.state.affection.mika).toBe(5);
	});

	test("refuses a reply from a frame that is no longer current, and a missing reply", async () => {
		let play = start();
		let welcome = line(frameOf(await play.next()));
		let stale: Reply = welcome.advance();
		let hello = line(frameOf(await play.next(stale)));

		let refused = frameOf(await play.next(stale));
		expect(refused).toMatchObject({ type: "error", frame: hello });
		expect(refused.type === "error" && refused.error.code).toBe("stale-reply");

		let missing = frameOf(await play.next());
		expect(missing.type === "error" && missing.error.code).toBe("invalid-reply");
		expect(line(frameOf(await play.next(hello.advance()))).key).toBe("opening.gold");
	});

	test("reports a jump to an unmapped scene on the frame to retry", async () => {
		let play = unwrap(fixture().start({ scene: SCENES.prologue.jump }));
		let jump = line(frameOf(await play.next()));
		let failed = frameOf(await play.next(jump.advance()));
		expect(failed).toMatchObject({ type: "error", frame: jump });
		expect(failed.type === "error" && failed.error.code).toBe("unmapped-scene");
	});

	test("refuses to start in a scene with no module", () => {
		let started = fixture().start({ scene: SCENES.prologue.unwritten });
		expect(isFailure(started) && started.error.code).toBe("unmapped-scene");
	});
});

describe("rollback", () => {
	test("restores the previous stop with the values it showed", async () => {
		let play = start();
		let welcome = line(frameOf(await play.next()));
		let hello = line(await advance(play, welcome));
		await advance(play, hello);

		let previous = await play.rollback();
		expect(previous).toMatchObject({ type: "line", key: "opening.hello", values: { name: "Ada" } });
		if (previous?.type !== "line") throw new Error("Expected the previous line");

		expect(line(frameOf(await play.next(previous.advance()))).values).toEqual({ gold: 10 });
	});

	test("undoes state changes and replays the same draws", async () => {
		let play = start();
		let frame = frameOf(await play.next());
		for (let index = 0; index < 5; index++) frame = await advance(play, frame);
		let drawn = line(frame).key;
		await until(play, frame, "pause");

		expect(await play.rollback()).toMatchObject({ key: "opening.back", values: { gold: 15 } });
		await play.rollback();
		let thinking = await play.rollback();
		thinking = await play.rollback();
		expect(thinking).toMatchObject({ key: "opening.thinking" });
		expect(play.state.state.gold).toBe(10);

		if (thinking?.type !== "line") throw new Error("Expected the line before the draw");
		let redrawn = line(frameOf(await play.next(thinking.advance())));
		expect(redrawn.key).toBe(drawn);
	});

	test("keeps only as many stops as the novel allows", async () => {
		let play = unwrap(fixture({ rollback: 1 }).start({ seed: "fixture" }));
		let welcome = line(frameOf(await play.next()));
		let hello = line(await advance(play, welcome));
		await advance(play, hello);

		expect(await play.rollback()).toMatchObject({ key: "opening.hello" });
		expect(await play.rollback()).toBeNull();
	});
});

describe("game state", () => {
	test("anchors the position on the message key and round-trips as JSON", async () => {
		let play = start();
		let frame = frameOf(await play.next());
		for (let index = 0; index < 4; index++) frame = await advance(play, frame);

		let saved = JSON.parse(JSON.stringify(play.state)) as GameState;
		expect(saved.position).toEqual({ scene: "prologue.opening", line: "opening.thinking" });
		expect(saved.meta.scene).toBe("titles.opening");
		expect(saved.stage.characters).toHaveLength(2);
		expect(saved.state).toEqual({ gold: 10, charm: 0, affection: { mika: 0 } });

		let original = line(await advance(play, frame));

		let resumed = unwrap(fixture().start({ from: saved }));
		let thinking = line(frameOf(await resumed.next()));
		expect(thinking.key).toBe("opening.thinking");
		expect(thinking.stage).toEqual(line(frame).stage);

		let drawn = line(await advance(resumed, thinking));
		expect(drawn.key).toBe(original.key);
	});

	test("anchors a call's return and resumes inside the called scene", async () => {
		let play = start();
		let frame = await until(play, frameOf(await play.next()), "line");
		while (line(frame).key !== "flashback.memory") frame = await advance(play, frame);

		let saved = JSON.parse(JSON.stringify(play.state)) as GameState;
		expect(saved.position).toEqual({ scene: "prologue.flashback", line: "flashback.memory" });
		expect(saved.stack).toEqual([{ scene: "prologue.opening", line: "opening.unlucky+1" }]);

		let resumed = unwrap(fixture().start({ from: saved }));
		let memory = line(frameOf(await resumed.next()));
		expect(line(await advance(resumed, memory)).key).toBe("opening.back");
	});

	test("resumes at the start of the scene when the saved line is gone", async () => {
		let play = start();
		let saved = { ...play.state, position: { scene: "prologue.opening", line: "opening.removed" } };
		let resumed = unwrap(fixture().start({ from: saved }));
		expect(line(frameOf(await resumed.next())).key).toBe("opening.welcome");
	});

	test("refuses a save the schemas reject", () => {
		let play = start();
		let started = fixture().start({ from: { ...play.state, state: { gold: "lots" } } });
		expect(isFailure(started) && started.error.code).toBe("invalid-state");
		let garbage = fixture().start({ from: { position: 3 } });
		expect(isFailure(garbage) && garbage.error.code).toBe("invalid-state");
		let unknown = fixture().start({
			from: { ...play.state, position: { scene: "nowhere", line: "" } },
		});
		expect(isFailure(unknown) && unknown.error.code).toBe("invalid-state");
	});

	test("starts from a partial state filled with its defaults", () => {
		let play = fixture().start({ state: { affection: { mika: 40 } } });
		expect(isSuccess(play) && play.data.state.state).toEqual({
			gold: 10,
			charm: 0,
			affection: { mika: 40 },
		});
	});
});

describe("createTestPlay", () => {
	test("advances to a menu, chooses, and reads state and scene", async () => {
		let play = createTestPlay(fixture(), {
			seed: "mika",
			state: { affection: { mika: 40 } },
			scene: SCENES.prologue.opening,
		});

		let menu = await play.advanceUntil("choice");
		expect(menu.options.map((option) => option.id)).toContain("opening.secret");

		await play.choose("opening.secret");
		expect(play.frame).toMatchObject({ type: "line", key: "opening.answerSecret" });

		await play.advanceUntil("choice");
		await play.choose("opening.done");
		expect(play.scene).toBe(SCENES.prologue.cafe);

		await play.complete({ caught: 1 });
		expect(play.state.lastCatch).toEqual({ caught: 1 });
		await play.choose("cafe.leave");
		expect(play.ending).toEqual({ key: "endings.bad", scene: "prologue.cafe" });

		expect(play.transcript.slice(0, 3)).toEqual([
			{ type: "line", speakers: [], key: "opening.welcome", values: undefined },
			{ type: "line", speakers: ["mika"], key: "opening.hello", values: { name: "Ada" } },
			{ type: "line", speakers: ["mika"], key: "opening.gold", values: { gold: 10 } },
		]);
		expect(play.transcript).toContainEqual({ type: "choice", option: "opening.secret" });
		expect(play.transcript).toContainEqual({
			type: "custom",
			interaction: "fishing",
			output: { caught: 1 },
		});
	});

	test("fails the test when a reply does not fit the frame", async () => {
		let play = createTestPlay(fixture(), { seed: "mika" });
		await expect(play.choose("opening.done")).rejects.toThrow(/choice frame/);
		await play.advanceUntil("choice");
		await expect(play.choose("opening.flirt")).rejects.toMatchObject({
			code: "unavailable-option",
		});
		await expect(play.advance()).rejects.toThrow(/choice/);
	});
});

/** Every event a novel emitted, in order, with the play each one fired for. */
function record(novel: ReturnType<typeof fixture>) {
	let log: { name: NovelEventName; payload: unknown; play: Play }[] = [];
	let names: NovelEventName[] = [
		"scene",
		"line",
		"choice",
		"ending",
		"unlock",
		"chapter",
		"save",
		"persist",
		"error",
	];
	for (let name of names) {
		novel.on(name, (payload, play) => {
			log.push({ name, payload, play });
		});
	}
	return log;
}

/** Plays the fixture to its good ending through `createTestPlay`. */
async function playToTheEnd(novel = fixture(), persistent?: unknown) {
	let play = createTestPlay(novel, { seed: "mika", persistent });
	await play.advanceUntil("choice");
	await play.choose("opening.askName");
	await play.advanceUntil("choice");
	await play.choose("opening.done");
	await play.complete({ caught: 4 });
	await play.advanceUntil("choice");
	await play.choose("cafe.stay");
	return play;
}

/** A one-scene novel over the fixture's declarations, starting at `prologue.unwritten`. */
function oneScene(
	directives: Parameters<typeof createScene>[1],
	options: Partial<NovelOptions> = {},
) {
	let novel = createNovel({
		scenes: SCENES,
		cast: CAST,
		assets: ASSETS,
		interactions: INTERACTIONS,
		state: STATE,
		initial: SCENES.prologue.unwritten,
		...options,
	});
	novel.map(SCENES.prologue.unwritten, createScene(SCENES.prologue.unwritten, directives));
	return novel;
}

describe("exits", () => {
	test("puts each departing character on the frame where it left, as it last stood", async () => {
		let play = createTestPlay(
			oneScene((ctx) => [
				ctx.enter(CAST.mika, { at: "left", expression: "smile", transition: "fade" }),
				ctx.enter(CAST.ren, { at: "right", layers: { body: "casual", face: "neutral" } }),
				ctx.narrate("opening.welcome"),
				ctx.exit(CAST.mika, { transition: "slide" }),
				ctx.exit(CAST.ren),
				ctx.narrate("opening.lucky"),
				ctx.narrate("opening.unlucky"),
			]),
		);
		let welcome = await play.advance();
		expect(welcome?.stage.exits).toBeUndefined();

		let lucky = await play.advance();
		expect(lucky?.stage.characters).toEqual([]);
		expect(lucky?.stage.exits).toEqual([
			{
				id: "mika",
				at: "1/3",
				expression: "smile",
				images: ["/mika/smile.webp"],
				transition: "slide",
			},
			{
				id: "ren",
				at: "3/3",
				layers: { body: "casual", face: "neutral" },
				images: ["/ren/body-casual.webp", "/ren/face-neutral.webp"],
			},
		]);
		expect(play.play.state.stage.exits).toBeUndefined();

		let unlucky = await play.advance();
		expect(unlucky?.stage.exits).toBeUndefined();
	});

	test("forgets the exit of a character who comes back before the stop", async () => {
		let play = createTestPlay(
			oneScene((ctx) => [
				ctx.enter(CAST.mika, { at: "left" }),
				ctx.narrate("opening.welcome"),
				ctx.exit(CAST.mika, { transition: "fade" }),
				ctx.exit(CAST.ren, { transition: "fade" }),
				ctx.enter(CAST.mika, { at: "right" }),
				ctx.narrate("opening.lucky"),
			]),
		);
		await play.advance();
		let lucky = await play.advance();
		expect(lucky?.stage.exits).toBeUndefined();
		expect(lucky?.stage.characters.map((entry) => entry.at)).toEqual(["3/3"]);
	});
});

describe("versions and migrations", () => {
	test("stamps a save with the novel's version", async () => {
		let play = start();
		await play.next();
		expect(play.state.version).toBe(1);
		let versioned = unwrap(fixture({ version: 4 }).start({ seed: "fixture" }));
		await versioned.next();
		expect(versioned.state.version).toBe(4);
	});

	test("reads a save without a version as version 1 and upgrades it step by step", async () => {
		let play = start();
		let welcome = line(frameOf(await play.next()));
		await advance(play, welcome);
		let { version: _version, ...saved } = JSON.parse(JSON.stringify(play.state)) as GameState;
		let old = { ...saved, state: { coins: 7, affection: { mika: 3 } } };

		let novel = fixture({
			version: 3,
			migrate: {
				1: (game) => {
					let { coins, ...rest } = game.state as { coins: number };
					return success({ ...game, state: { ...rest, gold: coins } });
				},
				2: (game) => success({ ...game, state: { ...(game.state as object), charm: 50 } }),
			},
		});
		let resumed = unwrap(novel.start({ from: old }));
		expect(line(frameOf(await resumed.next())).key).toBe("opening.hello");
		expect(resumed.state.version).toBe(3);
		expect(resumed.state.state).toEqual({ gold: 7, charm: 50, affection: { mika: 3 } });
	});

	test("refuses a save no migration upgrades", async () => {
		let play = start();
		await play.next();
		let saved = JSON.parse(JSON.stringify(play.state)) as GameState;

		let missing = fixture({ version: 2 }).start({ from: saved });
		expect(isFailure(missing) && missing.error.code).toBe("migration-failed");

		let failing = fixture({
			version: 2,
			migrate: { 1: () => failure(new Error("no coins")) },
		}).start({ from: saved });
		expect(isFailure(failing) && failing.error.message).toMatch(/no coins/);

		let newer = fixture().start({ from: { ...saved, version: 2 } });
		expect(isFailure(newer) && newer.error.code).toBe("migration-failed");

		let garbage = fixture().start({ from: "save" });
		expect(isFailure(garbage) && garbage.error.code).toBe("invalid-state");
	});

	test("fills state fields a save predates with their schema defaults", async () => {
		let play = start();
		await play.next();
		let saved = { ...play.state, state: { gold: 3 } };
		let resumed = unwrap(fixture().start({ from: saved }));
		expect(resumed.state.state).toEqual({ gold: 3, charm: 0, affection: { mika: 0 } });
	});

	test("resumes at the anchored line when a counted anchor no longer exists", async () => {
		let play = start();
		let pause = await until(play, frameOf(await play.next()), "pause");
		expect(pause.type).toBe("pause");
		expect(play.state.position).toEqual({ scene: "prologue.opening", line: "opening.back+1" });

		let saved = { ...play.state, position: { scene: "prologue.opening", line: "opening.back+7" } };
		let resumed = unwrap(fixture().start({ from: saved }));
		expect(line(frameOf(await resumed.next())).key).toBe("opening.back");
	});
});

describe("persistent data", () => {
	test("records lines with their values, options, endings, chapters and unlocks", async () => {
		let play = await playToTheEnd();
		let persistent = play.persistent;

		expect(persistent.seen["prologue.opening:opening.welcome"]).toEqual({});
		expect(persistent.seen["prologue.opening:opening.hello"]).toEqual({ name: "Ada" });
		expect(persistent.seen["prologue.cafe:cafe.impressed"]).toEqual({ caught: 4 });
		expect(persistent.chosen).toEqual([
			"prologue.opening:opening.askName",
			"prologue.opening:opening.done",
			"prologue.cafe:cafe.stay",
		]);
		expect(persistent.endings).toEqual(["endings.good"]);
		expect(persistent.chapters).toEqual(["prologue"]);
		expect(persistent.unlocked).toEqual({ images: ["images.letter"], music: ["music.chill"] });
	});

	test("marks lines read and options taken in an earlier playthrough", async () => {
		let first = await playToTheEnd();
		let fresh = createTestPlay(fixture(), { seed: "mika" });
		expect(await fresh.advance()).toMatchObject({ key: "opening.welcome", seen: false });

		let again = createTestPlay(fixture(), { seed: "mika", persistent: first.persistent });
		expect(await again.advance()).toMatchObject({ key: "opening.welcome", seen: true });
		let menu = await again.advanceUntil("choice");
		expect(menu.options.map((option) => [option.id, option.chosen])).toEqual([
			["opening.askName", true],
			["opening.askJob", false],
			["opening.flirt", false],
			["opening.done", true],
		]);
	});

	test("starts from empty data when the stored value is invalid", () => {
		let play = createTestPlay(fixture(), { persistent: { seen: 3, endings: "all" } });
		expect(play.persistent).toEqual({
			seen: {},
			chosen: [],
			endings: [],
			chapters: [],
			unlocked: { images: [], music: [] },
		});
	});

	test("emits the whole record on persist and keeps it through rollback", async () => {
		let novel = fixture();
		let stored: Persistent[] = [];
		novel.on("persist", (persistent) => {
			stored.push(persistent);
		});
		let play = unwrap(novel.start({ seed: "fixture" }));
		let welcome = line(frameOf(await play.next()));
		await advance(play, welcome);
		expect(stored).toHaveLength(2);
		expect(stored.at(-1)).toEqual(play.persistent);

		await play.rollback();
		expect(play.persistent.seen["prologue.opening:opening.hello"]).toEqual({ name: "Ada" });
		expect(stored).toHaveLength(2);
	});

	test("hands persistent data to callbacks", async () => {
		let novel = oneScene((ctx) => [
			ctx.when(
				(_state, { persistent }) => persistent.endings.includes("endings.good"),
				[ctx.narrate("opening.lucky")],
				[ctx.narrate("opening.unlucky")],
			),
		]);
		let fresh = createTestPlay(novel);
		expect(await fresh.advance()).toMatchObject({ key: "opening.unlucky" });
		let after = createTestPlay(novel, { persistent: { endings: ["endings.good"] } });
		expect(await after.advance()).toMatchObject({ key: "opening.lucky" });
	});
});

describe("events", () => {
	test("emits what a play does, in order, with the play it fired for", async () => {
		let novel = fixture();
		let log = record(novel);
		let play = unwrap(novel.start({ seed: "fixture" }));
		let welcome = line(frameOf(await play.next()));

		expect(log.map((entry) => entry.name)).toEqual([
			"scene",
			"chapter",
			"unlock",
			"line",
			"persist",
		]);
		expect(log.every((entry) => entry.play === play)).toBe(true);
		expect(log.slice(0, 4).map((entry) => entry.payload)).toEqual([
			{ scene: "prologue.opening" },
			{ chapter: { name: "prologue", title: "chapters.prologue" }, scene: "prologue.opening" },
			{ kind: "music", id: "music.chill" },
			{ scene: "prologue.opening", key: "opening.welcome", speakers: [], values: undefined },
		]);

		log.length = 0;
		let frame: Frame = welcome;
		while (frame.type !== "line" || frame.key !== "flashback.memory") {
			frame = await advance(play, frame);
		}
		expect(log.filter((entry) => entry.name === "scene").map((entry) => entry.payload)).toEqual([
			{ scene: "prologue.flashback" },
		]);
		expect(log.some((entry) => entry.name === "chapter")).toBe(false);
		expect(log.find((entry) => entry.name === "unlock")?.payload).toEqual({
			kind: "image",
			id: "images.letter",
		});
	});

	test("emits accepted choices and the ending", async () => {
		let novel = fixture();
		let log = record(novel);
		await playToTheEnd(novel);
		let choices = log.filter((entry) => entry.name === "choice").map((entry) => entry.payload);
		expect(choices).toEqual([
			{ scene: "prologue.opening", option: "opening.askName" },
			{ scene: "prologue.opening", option: "opening.done" },
			{ scene: "prologue.cafe", option: "cafe.stay" },
		]);
		expect(log.filter((entry) => entry.name === "ending").map((entry) => entry.payload)).toEqual([
			{ key: "endings.good", scene: "prologue.cafe" },
		]);
	});

	test("removes a listener with off() or the function on() returns", async () => {
		let novel = fixture();
		let lines: string[] = [];
		let listener = (payload: NovelEvents["line"]) => {
			lines.push(payload.key);
		};
		novel.on("line", listener);
		let stop = novel.on("line", (payload) => {
			lines.push(`second:${payload.key}`);
		});
		let play = unwrap(novel.start({ seed: "fixture" }));
		let welcome = line(frameOf(await play.next()));
		novel.off("line", listener);
		stop();
		await advance(play, welcome);
		expect(lines).toEqual(["opening.welcome", "second:opening.welcome"]);
	});

	test("installs plugins that register listeners", async () => {
		let unlocked: string[] = [];
		let novel = fixture().use((target) => {
			target.on("ending", (ending) => {
				if (ending.key !== null) unlocked.push(`ACH:${ending.key}`);
			});
		});
		await playToTheEnd(novel);
		expect(unlocked).toEqual(["ACH:endings.good"]);
	});

	test("reports a failing listener on error and keeps playing", async () => {
		let novel = fixture();
		let errors: NovelEvents["error"][] = [];
		novel.on("line", () => {
			throw new Error("analytics down");
		});
		novel.on("scene", async () => {
			throw new Error("rejected");
		});
		novel.on("error", (error) => {
			errors.push(error);
		});
		let play = unwrap(novel.start({ seed: "fixture" }));
		let welcome = line(frameOf(await play.next()));
		expect(line(await advance(play, welcome)).key).toBe("opening.hello");
		await Promise.resolve();
		expect(errors.map((error) => `${error.code}:${error.subject}`).sort()).toEqual([
			"listener-failed:line",
			"listener-failed:line",
			"listener-failed:scene",
		]);
		expect(errors.map((error) => (error.cause as Error).message)).toContain("analytics down");
	});

	test("emits a save with the play as JSON", async () => {
		let novel = fixture();
		let saves: NovelEvents["save"][] = [];
		novel.on("save", (save) => {
			saves.push(save);
		});
		let play = unwrap(novel.start({ seed: "fixture" }));
		await play.next();
		let state = play.save("slot-1");
		expect(saves).toEqual([{ slot: "slot-1", state }]);
		expect(state.position).toEqual({ scene: "prologue.opening", line: "opening.welcome" });
		expect(JSON.parse(JSON.stringify(state))).toEqual(state);
	});

	test("reports a menu with no option and continues past it", async () => {
		let novel = oneScene((ctx) => [
			ctx.choose({ "opening.flirt": { when: () => false, do: [] } }),
			ctx.narrate("opening.done"),
		]);
		let log = record(novel);
		let play = createTestPlay(novel);
		expect(await play.advance()).toMatchObject({ key: "opening.done" });
		let errors = log.filter((entry) => entry.name === "error").map((entry) => entry.payload);
		expect(errors).toMatchObject([
			{ code: "dead-end-menu", subject: "prologue.unwritten:opening.flirt" },
		]);
	});

	test("reports an undeclared asset or character and still draws it", async () => {
		let other = assets({ backgrounds: { street: "/bg/street.webp" } });
		let stranger = cast({ kai: character({ name: "cast.ren", sprites: { calm: "/kai.webp" } }) });
		let novel = oneScene((ctx) => [
			ctx.show(other.backgrounds.street),
			ctx.enter(stranger.kai, { at: "left" }),
			ctx.narrate("opening.welcome"),
			ctx.narrate("opening.done"),
		]);
		let log = record(novel);
		let play = createTestPlay(novel);
		let frame = await play.advance();
		expect(frame?.stage.background).toEqual({ id: "backgrounds.street", src: "/bg/street.webp" });
		await play.advance();
		let errors = log.filter((entry) => entry.name === "error").map((entry) => entry.payload);
		expect(errors).toMatchObject([
			{ code: "missing-asset", subject: "backgrounds.street" },
			{ code: "missing-asset", subject: "cast.kai" },
		]);
	});

	test("reports a message a catalog lacks once per play", async () => {
		let novel = fixture({ messages: { en: EN, ja: { cast: { mika: "ミカ" } } } });
		let log = record(novel);
		let play = unwrap(novel.start({ seed: "fixture" }));
		let welcome = line(frameOf(await play.next()));
		await advance(play, welcome);
		await play.rollback();
		let errors = log
			.filter((entry) => entry.name === "error")
			.map((entry) => entry.payload as NovelEvents["error"])
			.map((error) => [error.code, error.locale, error.subject]);
		expect(errors).toEqual([
			["missing-message", "ja", "opening.welcome"],
			["missing-message", "ja", "opening.hello"],
		]);
	});

	test("reports a jump to an unmapped scene", async () => {
		let novel = fixture();
		let log = record(novel);
		let play = unwrap(novel.start({ scene: SCENES.prologue.jump }));
		let jump = line(frameOf(await play.next()));
		await play.next(jump.advance());
		expect(
			log.filter((entry) => entry.name === "error").map((entry) => entry.payload),
		).toMatchObject([{ code: "unmapped-scene", subject: "prologue.unwritten" }]);
	});

	test("asks for a voice per locale when the novel has locales", async () => {
		let novel = fixture({
			locales: ["en", "ja"],
			voice: ({ speaker, key, locale }) => `/voice/${locale}/${speaker}/${key}.ogg`,
		});
		let play = unwrap(novel.start({ seed: "fixture" }));
		let hello = line(await advance(play, frameOf(await play.next())));
		expect(hello.voice).toEqual({
			en: "/voice/en/mika/opening.hello.ogg",
			ja: "/voice/ja/mika/opening.hello.ogg",
		});
	});
});

/** The fishing outputs exploration tries: a poor catch and a good one. */
const FISHING = { fishing: () => [{ caught: 1 }, { caught: 4 }] };

describe("check", () => {
	test("reports the fixture's unmapped jump and the scenes nothing reaches", async () => {
		let report = await check(fixture());
		expect(report.ok).toBe(false);
		expect(report.problems).toEqual([
			{
				code: "unmapped-scene",
				severity: "error",
				scene: "prologue.jump",
				target: "prologue.unwritten",
			},
			{ code: "unreachable-scene", severity: "warning", scene: "prologue.unwritten" },
			{ code: "unreachable-scene", severity: "warning", scene: "prologue.jump" },
		]);
	});

	test("reports duplicate keys, shared columns, possible dead ends, undeclared assets and failed loads", async () => {
		let broken = scenes({ start: scene(), failing: scene() });
		let other = assets({ music: { loud: "/music/loud.ogg" } });
		let novel = createNovel({
			scenes: broken,
			cast: CAST,
			assets: ASSETS,
			state: STATE,
			initial: broken.start,
		});
		novel.map(
			broken.start,
			createScene(broken.start, (ctx) => [
				ctx.enter(CAST.mika, { at: "left" }),
				ctx.enter(CAST.ren, { at: "1/3", layers: { body: "school", face: "grin" } }),
				ctx.play(other.music.loud),
				ctx.narrate("opening.welcome"),
				ctx.choose(
					{
						"opening.flirt": { when: (state) => state.charm > 10, do: [] },
						"opening.secret": { when: (state) => state.gold > 10, do: [] },
					},
					{ prompt: "opening.welcome" },
				),
			]),
		);
		novel.map(
			broken.failing,
			lazy(async () => {
				throw new Error("network down");
			}),
		);
		let report = await check(novel);
		expect(report.ok).toBe(false);
		expect(report.problems).toEqual([
			{
				code: "shared-slot",
				severity: "warning",
				scene: "start",
				at: "1/3",
				characters: ["mika", "ren"],
			},
			{ code: "missing-asset", severity: "error", scene: "start", asset: "music.loud" },
			{ code: "dead-end-menu", severity: "warning", scene: "start", menu: "opening.welcome" },
			{ code: "duplicate-key", severity: "error", scene: "start", key: "opening.welcome" },
			{
				code: "load-failed",
				severity: "error",
				scene: "failing",
				message: 'Scene "failing" failed to load.',
			},
			{ code: "unreachable-scene", severity: "warning", scene: "failing" },
		]);
	});
});

describe("explore", () => {
	test("finds every ending with its shortest path, and each path replays", async () => {
		let novel = fixture();
		let report = await explore(novel, { seeds: ["fixture", "mika"], interactions: FISHING });

		expect(report.capped).toEqual({ paths: false, depth: false });
		expect(report.endings.map((ending) => String(ending.key)).sort()).toEqual([
			"endings.bad",
			"endings.good",
		]);
		let good = report.endings.find((ending) => ending.key === "endings.good");
		expect(good?.steps).toEqual([
			{ type: "choice", option: "opening.done" },
			{ type: "custom", interaction: "fishing", output: { caught: 1 } },
			{ type: "choice", option: "cafe.stay" },
		]);
		for (let ending of report.endings) {
			let play = createTestPlay(fixture(), { seed: ending.seed });
			await play.follow(ending.steps);
			expect(play.ending).toEqual({ key: ending.key, scene: ending.scene });
		}
		expect(report.unreachableScenes).toEqual(["prologue.unwritten", "prologue.jump"]);
		expect(report.problems.map((problem) => problem.code)).toContain("unmapped-scene");
		expect(report.deadEndMenus).toEqual([]);
		expect(report.errors).toEqual([]);
	});

	test("reports interactions it has no outputs for", async () => {
		let report = await explore(fixture());
		expect(report.endings).toEqual([]);
		expect(report.unexplored).toEqual([
			{
				seed: "explore",
				steps: [{ type: "choice", option: "opening.done" }],
				scene: "prologue.cafe",
				interaction: "fishing",
			},
		]);
	});

	test("stops at its caps and says so", async () => {
		let shallow = await explore(fixture(), { interactions: FISHING, maxDepth: 1 });
		expect(shallow.capped.depth).toBe(true);
		expect(shallow.endings).toEqual([]);

		let narrow = await explore(fixture(), { interactions: FISHING, maxPaths: 1 });
		expect(narrow.capped.paths).toBe(true);
		expect(narrow.paths).toBe(1);
	});

	test("terminates a loop that comes back to the same menu with the same state", async () => {
		let novel = oneScene((ctx) => [
			ctx.narrate("opening.welcome"),
			ctx.choose({
				"opening.askName": [ctx.goto(SCENES.prologue.unwritten)],
				"opening.done": [ctx.ending("endings.good")],
			}),
		]);
		let report = await explore(novel);
		expect(report.endings).toEqual([
			{
				seed: "explore",
				steps: [{ type: "choice", option: "opening.done" }],
				key: "endings.good",
				scene: "prologue.unwritten",
			},
		]);
	});

	test("explores draws from every seed", async () => {
		let seeds = ["s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7"];
		let lucky = seeds.find((seed) => createRandom(seed).bool());
		let unlucky = seeds.find((seed) => !createRandom(seed).bool());
		let novel = oneScene((ctx) => [
			ctx.when(
				(_state, { random }) => random.bool(),
				[ctx.ending("endings.good")],
				[ctx.ending("endings.bad")],
			),
		]);
		let report = await explore(novel, { seeds: [lucky ?? "", unlucky ?? ""] });
		expect(report.endings).toEqual([
			{ seed: lucky, steps: [], key: "endings.good", scene: "prologue.unwritten" },
			{ seed: unlucky, steps: [], key: "endings.bad", scene: "prologue.unwritten" },
		]);
		for (let ending of report.endings) {
			let play = createTestPlay(novel, { seed: ending.seed });
			await play.follow(ending.steps);
			expect(play.ending?.key).toBe(ending.key);
		}
	});

	test("reports dead-end menus, jumps it cannot take, missing assets and missing messages", async () => {
		let other = assets({ backgrounds: { street: "/bg/street.webp" } });
		let novel = oneScene((ctx) => [
			ctx.show(other.backgrounds.street),
			ctx.narrate("opening.welcome"),
			ctx.choose({
				"opening.askName": [ctx.goto(SCENES.prologue.jump)],
				"opening.askJob": [
					ctx.choose({ "opening.flirt": { when: () => false, do: [] } }),
					ctx.ending("endings.bad"),
				],
			}),
		]);
		let report = await explore(novel, {
			messages: { en: EN, ja: { opening: { welcome: "ようこそ" } } },
		});
		expect(report.errors).toMatchObject([
			{
				steps: [{ type: "choice", option: "opening.askName" }],
				code: "unmapped-scene",
			},
		]);
		expect(report.deadEndMenus).toEqual([
			{
				seed: "explore",
				steps: [{ type: "choice", option: "opening.askJob" }],
				menu: "prologue.unwritten:opening.flirt",
			},
		]);
		expect(report.missingAssets).toEqual(["backgrounds.street"]);
		expect(report.missingMessages).toEqual({
			ja: ["chapters.prologue", "opening.askJob", "opening.askName"],
		});

		let replay = createTestPlay(novel, { seed: "explore" });
		await replay.follow(report.deadEndMenus[0]?.steps ?? []);
		expect(replay.events.map((event) => event.type)).toContain("error");
		expect(replay.ending?.key).toBe("endings.bad");
	});
});
