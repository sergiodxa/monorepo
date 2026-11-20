/**
 * The runtime scene pick specification: `goto.oneOf` and `call.oneOf` draw a weighted candidate
 * from the play's seeded stream, fall through when none qualifies, replay the same pick after a
 * reload or a rollback, and stay visible to `check`, `explore`, prefetching and the scene graph.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createRandom } from "@sdxc/random";
import { unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, expectTypeOf, test } from "vitest";

import { readGraph } from "./dev/graph.js";
import { INTERNALS } from "./novel.js";
import { check, createTestPlay, explore } from "./test.js";

import type { Directive, Frame, GameState, Play, SceneContext } from "./index.js";

import { createNovel, createScene, scene, scenes } from "./index.js";

/** The story state every fixture in the package shares. */
const STATE = s.object({
	gold: s.defaulted(s.number(), 10),
	charm: s.defaulted(s.number(), 0),
	affection: s.defaulted(s.object({ mika: s.defaulted(s.number(), 0) }), { mika: 0 }),
	lastCatch: s.optional(s.object({ caught: s.number() })),
});

const SCENES = scenes({
	hub: scene(),
	beach: scene(),
	library: scene(),
	rain: scene(),
	errand: scene(),
	chores: scene(),
	nowhere: scene(),
});

const BEACH = createScene(SCENES.beach, (ctx) => [
	ctx.narrate("opening.lucky"),
	ctx.ending("endings.good"),
]);

const LIBRARY = createScene(SCENES.library, (ctx) => [
	ctx.narrate("opening.unlucky"),
	ctx.ending("endings.bad"),
]);

/** Runs out of directives, so a call returns from it and a jump to it finishes the play. */
const RAIN = createScene(SCENES.rain, (ctx) => [ctx.narrate("flashback.memory")]);

/** Changes state and returns without a stop, so a pick after a call to it runs in the same run. */
const ERRAND = createScene(SCENES.errand, (ctx) => [ctx.set("gold", (gold) => gold + 1)]);

/** Like {@link ERRAND}, with a different change, so the two calls leave different states. */
const CHORES = createScene(SCENES.chores, (ctx) => [ctx.set("charm", (charm) => charm + 1)]);

/** Seeds the draws below are checked over. */
const SEEDS = ["s0", "s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9"];

/** A novel starting in a hub scene built by `build`, with every candidate scene mapped. */
function fixture(build: (ctx: SceneContext) => Directive[]) {
	let novel = createNovel({ scenes: SCENES, state: STATE, initial: SCENES.hub });
	novel.map(SCENES.hub, createScene(SCENES.hub, build));
	novel.map(SCENES.beach, BEACH);
	novel.map(SCENES.library, LIBRARY);
	novel.map(SCENES.rain, RAIN);
	novel.map(SCENES.errand, ERRAND);
	novel.map(SCENES.chores, CHORES);
	return novel;
}

/** Reads the frame a step yielded, failing the test when the play finished instead. */
function frameOf(step: IteratorResult<Frame, unknown>): Frame {
	if (step.done) throw new Error("Expected a frame, the play finished");
	return step.value;
}

/** The key of a line frame, failing the test on any other frame. */
function keyOf(frame: Frame): string {
	if (frame.type !== "line") throw new Error(`Expected a line, got ${frame.type}`);
	return frame.key;
}

/** Answers a line frame and reads the frame after it. */
async function advance(play: Play, frame: Frame): Promise<Frame> {
	if (frame.type !== "line") throw new Error(`Expected a line, got ${frame.type}`);
	return frameOf(await play.next(frame.advance()));
}

describe("building", () => {
	test("keeps goto and call callable and records a pick as plain data", () => {
		let byWeight = () => true;
		let module = createScene(SCENES.hub, (ctx) => [
			ctx.goto(SCENES.beach),
			ctx.call(SCENES.rain),
			ctx.goto.oneOf([SCENES.beach, SCENES.library]),
			ctx.call.oneOf([SCENES.rain], byWeight),
		]);
		expect(module.directives).toEqual([
			{ type: "goto", scene: SCENES.beach },
			{ type: "call", scene: SCENES.rain },
			{ type: "pick", via: "goto", scenes: [SCENES.beach, SCENES.library] },
			{ type: "pick", via: "call", scenes: [SCENES.rain], weight: byWeight },
		]);
	});

	test("types the weight from the candidates and the state", () => {
		createScene(SCENES.hub, (ctx) => [
			ctx.goto.oneOf([SCENES.beach, SCENES.library], (candidate, state, tools) => {
				expectTypeOf(candidate).toEqualTypeOf<typeof SCENES.beach | typeof SCENES.library>();
				expectTypeOf(state.charm).toEqualTypeOf<number>();
				return tools.random.bool() ? 2 : false;
			}),
			// @ts-expect-error -- a weight is a number or a boolean
			ctx.call.oneOf([SCENES.rain], () => "often"),
		]);
	});
});

describe("playing", () => {
	test("draws among the candidates in proportion to their weights, from the seeded stream", async () => {
		let novel = fixture((ctx) => [
			ctx.goto.oneOf([SCENES.beach, SCENES.library], (candidate) =>
				candidate === SCENES.beach ? 1 : 3,
			),
		]);
		let picked = new Set<string>();
		for (let seed of SEEDS) {
			let expected = createRandom(seed).next() * 4 < 1 ? "opening.lucky" : "opening.unlucky";
			let play = unwrap(novel.start({ seed }));
			let key = keyOf(frameOf(await play.next()));
			expect(key).toBe(expected);
			picked.add(key);
		}
		expect(picked.size).toBe(2);
	});

	test("counts true as 1 and leaves out false, 0 and weights that are not positive", async () => {
		let weights = new Map<string, number | boolean>([
			["beach", false],
			["rain", 0],
			["library", true],
		]);
		let novel = fixture((ctx) => [
			ctx.goto.oneOf([SCENES.beach, SCENES.rain, SCENES.library], (candidate) =>
				candidate === SCENES.beach || candidate === SCENES.rain
					? (weights.get(candidate.name) ?? false)
					: true,
			),
		]);
		for (let seed of SEEDS) {
			let play = unwrap(novel.start({ seed }));
			expect(keyOf(frameOf(await play.next()))).toBe("opening.unlucky");
		}
		let negative = fixture((ctx) => [
			ctx.goto.oneOf([SCENES.beach, SCENES.library], (candidate) =>
				candidate === SCENES.beach ? -2 : Number.NaN,
			),
			ctx.narrate("opening.done"),
		]);
		let play = unwrap(negative.start({ seed: "s0" }));
		expect(keyOf(frameOf(await play.next()))).toBe("opening.done");
	});

	test("weighs each candidate from the state", async () => {
		let novel = fixture((ctx) => [
			ctx.goto.oneOf([SCENES.beach, SCENES.library], (candidate, state) =>
				candidate === SCENES.library ? state.charm >= 5 : state.charm < 5,
			),
		]);
		let charming = createTestPlay(novel, { state: { charm: 5 } });
		await charming.advance();
		expect(charming.scene).toBe(SCENES.library);
		let shy = createTestPlay(novel, { state: { charm: 0 } });
		await shy.advance();
		expect(shy.scene).toBe(SCENES.beach);
	});

	test("continues with the next directive when no candidate qualifies", async () => {
		let novel = fixture((ctx) => [
			ctx.goto.oneOf([SCENES.beach, SCENES.library], () => false),
			ctx.goto.oneOf([]),
			ctx.call.oneOf([SCENES.rain], () => 0),
			ctx.narrate("opening.done"),
			ctx.ending("endings.good"),
		]);
		let play = createTestPlay(novel);
		await play.advance();
		expect(play.transcript).toEqual([
			{ type: "line", speakers: [], key: "opening.done", values: undefined },
		]);
		await play.advance();
		expect(play.ending).toEqual({ key: "endings.good", scene: "hub" });
		expect(play.events.filter((event) => event.type === "error")).toEqual([]);
	});

	test("picks the same scene after a reload and after a rollback", async () => {
		let novel = fixture((ctx) => [
			ctx.narrate("opening.welcome"),
			ctx.goto.oneOf([SCENES.beach, SCENES.library, SCENES.rain]),
		]);
		for (let seed of SEEDS.slice(0, 4)) {
			let play = unwrap(novel.start({ seed }));
			let welcome = frameOf(await play.next());
			let saved = JSON.parse(JSON.stringify(play.state)) as GameState;
			let picked = keyOf(await advance(play, welcome));

			let resumed = unwrap(novel.start({ from: saved }));
			expect(keyOf(await advance(resumed, frameOf(await resumed.next())))).toBe(picked);

			let previous = await play.rollback();
			if (previous === null) throw new Error("Expected the line before the pick");
			expect(keyOf(await advance(play, previous))).toBe(picked);
		}
	});

	test("calls the picked scene and returns after the pick, also from a save inside it", async () => {
		let novel = fixture((ctx) => [
			ctx.narrate("opening.welcome"),
			ctx.call.oneOf([SCENES.rain]),
			ctx.narrate("opening.done"),
		]);
		let play = unwrap(novel.start());
		let memory = await advance(play, frameOf(await play.next()));
		expect(keyOf(memory)).toBe("flashback.memory");

		let saved = JSON.parse(JSON.stringify(play.state)) as GameState;
		expect(saved.stack).toEqual([{ scene: "hub", line: "opening.welcome+1" }]);
		expect(keyOf(await advance(play, memory))).toBe("opening.done");

		let resumed = unwrap(novel.start({ from: saved }));
		let again = frameOf(await resumed.next());
		expect(keyOf(again)).toBe("flashback.memory");
		expect(keyOf(await advance(resumed, again))).toBe("opening.done");
	});
});

describe("static analysis", () => {
	test("check counts every candidate as reachable and reports one with no module", async () => {
		let report = await check(
			fixture((ctx) => [ctx.goto.oneOf([SCENES.beach, SCENES.library, SCENES.nowhere])]),
		);
		expect(report.problems).toEqual([
			{ code: "unmapped-scene", severity: "error", scene: "hub", target: "nowhere" },
			{ code: "unreachable-scene", severity: "warning", scene: "rain" },
			{ code: "unreachable-scene", severity: "warning", scene: "errand" },
			{ code: "unreachable-scene", severity: "warning", scene: "chores" },
		]);
	});

	test("explore branches over every candidate that can be picked, and each path replays", async () => {
		let novel = fixture((ctx) => [
			ctx.narrate("opening.welcome"),
			ctx.goto.oneOf([SCENES.beach, SCENES.library, SCENES.rain], (candidate) =>
				candidate === SCENES.rain ? false : 1,
			),
		]);
		let report = await explore(novel);
		expect(report.endings).toEqual([
			expect.objectContaining({ key: "endings.good", scene: "beach" }),
			expect.objectContaining({ key: "endings.bad", scene: "library" }),
		]);
		for (let ending of report.endings) {
			expect(ending.steps).toEqual([{ type: "pick", scene: ending.scene }]);
			let play = createTestPlay(novel, { seed: ending.seed });
			await play.follow(ending.steps);
			expect(play.ending).toEqual({ key: ending.key, scene: ending.scene });
		}
		expect(report.unreachableScenes).toEqual(["rain", "errand", "chores", "nowhere"]);
		expect(report.errors).toEqual([]);
	});

	test("explore branches over picks after a choice and over several picks in one run", async () => {
		let novel = fixture((ctx) => [
			ctx.choose({
				"opening.askName": [
					ctx.call.oneOf([SCENES.errand, SCENES.chores]),
					ctx.goto.oneOf([SCENES.beach, SCENES.library]),
				],
				"opening.done": [ctx.ending("endings.good")],
			}),
		]);
		let report = await explore(novel);
		expect(report.paths).toBe(5);
		expect(report.endings).toHaveLength(3);
		for (let ending of report.endings) {
			let play = createTestPlay(novel, { seed: ending.seed });
			await play.follow(ending.steps);
			expect(play.ending).toEqual({ key: ending.key, scene: ending.scene });
		}
		let library = report.endings.find((ending) => ending.scene === "library");
		expect(library?.steps).toEqual([
			{ type: "choice", option: "opening.askName" },
			{ type: "pick", scene: expect.stringMatching(/^(errand|chores)$/) },
			{ type: "pick", scene: "library" },
		]);
	});

	test("explore takes a pick with one candidate without a step", async () => {
		let novel = fixture((ctx) => [
			ctx.call.oneOf([SCENES.rain, SCENES.beach], (candidate) => candidate === SCENES.rain),
			ctx.ending("endings.good"),
		]);
		let report = await explore(novel);
		expect(report.endings).toEqual([
			{ seed: "explore", steps: [], key: "endings.good", scene: "hub" },
		]);
	});

	test("prefetching and the scene graph follow every candidate", async () => {
		let novel = fixture((ctx) => [
			ctx.goto.oneOf([SCENES.beach, SCENES.library]),
			ctx.call.oneOf([SCENES.rain]),
		]);
		let reached = await novel.reachable(SCENES.hub);
		expect(reached.map((entry) => [entry.scene, entry.depth])).toEqual([
			["hub", 0],
			["beach", 1],
			["library", 1],
			["rain", 1],
		]);
		let graph = await readGraph(novel[INTERNALS]());
		expect(graph.edges).toEqual([
			{ from: "hub", to: "beach", kind: "goto" },
			{ from: "hub", to: "library", kind: "goto" },
			{ from: "hub", to: "rain", kind: "call" },
		]);
	});
});
