/**
 * The developer tools' connection, without a browser: it follows plays through events, logs
 * them, jumps with validated state, resets persistent data, reads the scene graph and missing
 * messages, and swaps hot-reloaded scenes so the play resumes on the same message key.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import type { Frame, Persistent, Play, StartOptions } from "../index.js";

import { assets, chapter, createNovel, createScene, lazy, scene, scenes } from "../index.js";

import { createDevTools } from "./devtools.js";
import { toMermaid } from "./graph.js";

/** The story state every fixture in the package shares. */
const STATE = s.object({
	gold: s.defaulted(s.number(), 10),
	charm: s.defaulted(s.number(), 0),
	affection: s.defaulted(s.object({ mika: s.defaulted(s.number(), 0) }), { mika: 0 }),
	lastCatch: s.optional(s.object({ caught: s.number() })),
});

const SCENES = scenes({
	prologue: chapter({
		title: "chapters.prologue",
		scenes: { opening: scene({ title: "titles.opening" }), memory: scene() },
	}),
	cafe: scene({ title: "titles.cafe" }),
	orphan: scene(),
});

const ASSETS = assets({ images: { letter: "/cg/letter.webp" } });

const OPENING = createScene(SCENES.prologue.opening, (ctx) => [
	ctx.narrate("opening.welcome"),
	ctx.narrate("opening.lucky"),
	ctx.call(SCENES.prologue.memory),
	ctx.choose({
		"cafe.stay": [ctx.goto(SCENES.cafe)],
		"cafe.leave": [ctx.ending("endings.bad")],
	}),
]);

const MEMORY = createScene(SCENES.prologue.memory, (ctx) => [
	ctx.show(ASSETS.images.letter),
	ctx.narrate("flashback.memory"),
]);

const CAFE = createScene(SCENES.cafe, (ctx) => [
	ctx.narrate("opening.done"),
	ctx.ending("endings.good"),
]);

/** English with two keys missing, and Japanese with only the cast. */
const MESSAGES = {
	en: {
		chapters: { prologue: "Prologue" },
		titles: { opening: "Opening", cafe: "Café" },
		opening: { welcome: "Welcome.", lucky: "Lucky.", done: "Done.", thinking: "Hmm." },
		flashback: { memory: "A letter." },
		cafe: { stay: "Stay", leave: "Leave" },
		endings: { good: "Good" },
	},
	ja: { opening: { welcome: "ようこそ。" } },
};

/** The fixture novel, the starts handed to `restart`, and the connected tools. */
function fixture() {
	let novel = createNovel({
		scenes: SCENES,
		assets: ASSETS,
		state: STATE,
		initial: SCENES.prologue.opening,
		messages: MESSAGES,
	});
	novel.map(SCENES.prologue.opening, OPENING);
	novel.map(
		SCENES.prologue.memory,
		lazy(async () => ({ default: MEMORY })),
	);
	novel.map(SCENES.cafe, CAFE);
	let starts: StartOptions[] = [];
	let devtools = createDevTools(novel, { restart: (start) => starts.push(start) });
	return { novel, devtools, starts };
}

/** Advances a play from its start through `count` line frames, answering the last one reached. */
async function linesInto(play: Play, count: number): Promise<Frame> {
	let step = await play.next();
	for (let index = 1; index < count; index += 1) {
		if (step.done) throw new Error("The play ended early");
		let frame = step.value;
		if (frame.type !== "line" && frame.type !== "pause") throw new Error(`At ${frame.type}`);
		step = await play.next(frame.advance());
	}
	if (step.done) throw new Error("The play ended early");
	return step.value;
}

describe("following a play", () => {
	test("follows the play every event fires for and logs the events in order", async () => {
		let { novel, devtools } = fixture();
		let play = unwrap(novel.start({ seed: "dev" }));
		expect(devtools.play).toBeUndefined();
		await linesInto(play, 2);
		expect(devtools.play).toBe(play);
		expect(devtools.state?.position).toEqual({ scene: "prologue.opening", line: "opening.lucky" });
		expect(devtools.events.map((event) => event.type)).toEqual([
			"scene",
			"chapter",
			"line",
			"persist",
			"error",
			"line",
			"persist",
		]);
		expect(devtools.events.at(4)?.payload).toMatchObject({
			code: "missing-message",
			subject: "opening.lucky",
			locale: "ja",
		});
		expect(devtools.events.map((event) => event.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
	});

	test("logs a notification the play passes", async () => {
		let { novel, devtools } = fixture();
		novel.map(
			SCENES.orphan,
			createScene(SCENES.orphan, (ctx) => [
				ctx.notify("opening.lucky"),
				ctx.narrate("opening.done"),
			]),
		);
		await linesInto(unwrap(novel.start({ scene: SCENES.orphan })), 1);
		expect(devtools.events.find((event) => event.type === "notify")?.payload).toEqual({
			scene: "orphan",
			key: "opening.lucky",
			values: undefined,
		});
	});

	test("keeps only the newest events past its limit, and clears on request", async () => {
		let { novel } = fixture();
		let devtools = createDevTools(novel, { restart: () => undefined, limit: 2 });
		await linesInto(unwrap(novel.start()), 2);
		expect(devtools.events.map((event) => event.id)).toEqual([6, 7]);
		devtools.clear();
		expect(devtools.events).toEqual([]);
	});

	test("tells subscribers about every change until they unsubscribe or it is disposed", async () => {
		let { novel, devtools } = fixture();
		let calls = 0;
		let unsubscribe = devtools.subscribe(() => (calls += 1));
		let play = unwrap(novel.start());
		await linesInto(play, 1);
		let seen = calls;
		expect(seen).toBeGreaterThan(0);
		unsubscribe();
		devtools.attach(play);
		expect(calls).toBe(seen);
		devtools.dispose();
		await linesInto(unwrap(novel.start()), 1);
		expect(devtools.events).toHaveLength(4);
	});

	test("lists the mapped scenes a jump can start in", () => {
		let { devtools } = fixture();
		expect(devtools.scenes).toEqual(["prologue.opening", "prologue.memory", "cafe"]);
	});
});

describe("jump()", () => {
	test("starts the scene with the edited state and the followed play's persistent data", async () => {
		let { novel, devtools, starts } = fixture();
		let play = unwrap(novel.start());
		await linesInto(play, 1);
		let jumped = unwrap(devtools.jump("cafe", { gold: 99 }));
		expect(starts).toEqual([jumped]);
		expect(jumped.scene).toBe(SCENES.cafe);
		expect(jumped.state).toEqual({ gold: 99, charm: 0, affection: { mika: 0 } });
		expect((jumped.persistent as Persistent).seen).toHaveProperty([
			"prologue.opening:opening.welcome",
		]);
		let next = unwrap(novel.start(jumped));
		expect((await next.next()).value).toMatchObject({ type: "line", key: "opening.done" });
		expect(next.state.state.gold).toBe(99);
		expect(devtools.play).toBe(next);
	});

	test("refuses state the schema refuses and scenes with no module", () => {
		let { devtools, starts } = fixture();
		let invalid = devtools.jump("cafe", { gold: "lots" });
		expect(isFailure(invalid) && invalid.error.code).toBe("invalid-state");
		let unmapped = devtools.jump("orphan", {});
		expect(isFailure(unmapped) && unmapped.error.code).toBe("unmapped-scene");
		expect(starts).toEqual([]);
	});
});

describe("reload()", () => {
	test("swaps an edited scene and resumes the play on the same message key", async () => {
		let { novel, devtools, starts } = fixture();
		await linesInto(unwrap(novel.start({ seed: "dev" })), 2);
		let edited = createScene(SCENES.prologue.opening, (ctx) => [
			ctx.narrate("opening.thinking"),
			ctx.narrate("opening.welcome"),
			ctx.narrate("opening.lucky"),
			ctx.ending("endings.good"),
		]);
		let reloaded = unwrap(devtools.reload([{ default: edited }]));
		expect(reloaded).toEqual({ scenes: ["prologue.opening"], restarted: true });
		expect(starts).toHaveLength(1);
		expect(devtools.play).toBeUndefined();
		let resumed = unwrap(novel.start(starts[0]));
		let frame = (await resumed.next()).value as Frame;
		expect(frame).toMatchObject({ type: "line", key: "opening.lucky" });
		if (frame.type !== "line") throw new Error("Expected a line");
		expect(await resumed.next(frame.advance())).toMatchObject({
			done: true,
			value: { key: "endings.good" },
		});
	});

	test("resumes at the scene's start when the line was removed", async () => {
		let { novel, devtools, starts } = fixture();
		await linesInto(unwrap(novel.start()), 2);
		let edited = createScene(SCENES.prologue.opening, (ctx) => [ctx.narrate("opening.done")]);
		unwrap(devtools.reload([edited]));
		let resumed = unwrap(novel.start(starts[0]));
		expect((await resumed.next()).value).toMatchObject({ type: "line", key: "opening.done" });
	});

	test("leaves the play running when it stands in another scene", async () => {
		let { novel, devtools, starts } = fixture();
		await linesInto(unwrap(novel.start()), 1);
		let edited = createScene(SCENES.cafe, (ctx) => [ctx.narrate("opening.thinking")]);
		expect(unwrap(devtools.reload([undefined, edited]))).toEqual({
			scenes: ["cafe"],
			restarted: false,
		});
		expect(starts).toEqual([]);
		let fresh = unwrap(novel.start({ scene: SCENES.cafe }));
		expect((await fresh.next()).value).toMatchObject({ key: "opening.thinking" });
	});

	test("refuses a module that is no scene module", () => {
		let { devtools } = fixture();
		let refused = devtools.reload([{ default: { hello: true } }]);
		expect(isFailure(refused) && refused.error.code).toBe("load-failed");
	});
});

describe("reset()", () => {
	test("clears what it is asked to and restarts from the play's own save", async () => {
		let { novel, devtools, starts } = fixture();
		let play = unwrap(novel.start());
		await linesInto(play, 3);
		let reset = unwrap(devtools.reset({ seen: true }));
		expect(starts).toEqual([reset]);
		expect(reset.persistent).toMatchObject({ seen: {}, chapters: ["prologue"] });
		expect(reset.from).toMatchObject({ position: { scene: "prologue.memory" } });
		expect(devtools.play).toBeUndefined();
		devtools.attach(play);
		unwrap(devtools.reset());
		expect(starts[1]?.persistent).toEqual({
			seen: {},
			chosen: [],
			endings: [],
			chapters: [],
			unlocked: { images: [], music: [] },
			introduced: [],
		});
	});

	test("refuses before any play", () => {
		let { devtools } = fixture();
		expect(isFailure(devtools.reset())).toBe(true);
	});
});

describe("graph() and problems()", () => {
	test("reads every jump, call and ending and draws them as a flowchart", async () => {
		let { devtools } = fixture();
		let graph = await devtools.graph();
		expect(graph.edges).toEqual([
			{ from: "prologue.opening", to: "prologue.memory", kind: "call" },
			{ from: "prologue.opening", to: "cafe", kind: "goto" },
		]);
		expect(graph.scenes.find((entry) => entry.name === "orphan")?.mapped).toBe(false);
		expect(toMermaid(graph)).toBe(
			[
				"flowchart LR",
				'  subgraph c0 ["prologue"]',
				'    s0["prologue.opening"]',
				'    s1["prologue.memory"]',
				"  end",
				'  s2["cafe"]',
				'  s3[/"orphan"/]',
				"  s0 -.-> s1",
				"  s0 --> s2",
				'  e0(["endings.bad"])',
				"  s0 --> e0",
				'  e1(["endings.good"])',
				"  s2 --> e1",
			].join("\n"),
		);
	});

	test("reports check problems and every key a catalog lacks", async () => {
		let { devtools } = fixture();
		let problems = await devtools.problems();
		expect(problems.check.problems).toContainEqual({
			code: "unreachable-scene",
			severity: "warning",
			scene: "orphan",
		});
		let english = problems.messages.filter((message) => message.locale === "en");
		expect(english).toEqual([{ locale: "en", key: "endings.bad", scene: "prologue.opening" }]);
		expect(problems.messages.filter((message) => message.locale === "ja")).toContainEqual({
			locale: "ja",
			key: "titles.opening",
		});
	});
});
