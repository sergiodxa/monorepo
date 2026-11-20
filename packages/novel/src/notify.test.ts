/**
 * The notification specification: `ctx.notify` passes without a stop, emits `notify` with its
 * message key and values once when the play passes it (never again on a rollback or a load past
 * it, never in a replay), and `check` and `explore` report a key a catalog lacks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import { check, createTestPlay, explore } from "./test.js";

import type { Directive, GameState, NovelOptions, SceneContext } from "./index.js";

import { createNovel, createScene, scene, scenes } from "./index.js";

/** The story state every fixture in the package shares. */
const STATE = s.object({
	gold: s.defaulted(s.number(), 10),
	charm: s.defaulted(s.number(), 0),
	affection: s.defaulted(s.object({ mika: s.defaulted(s.number(), 0) }), { mika: 0 }),
	lastCatch: s.optional(s.object({ caught: s.number() })),
});

const SCENES = scenes({ hall: scene() });

/** A novel of one scene built by `build`. */
function fixture(build: (ctx: SceneContext) => Directive[], options: Partial<NovelOptions> = {}) {
	let novel = createNovel({ scenes: SCENES, state: STATE, initial: SCENES.hall, ...options });
	novel.map(SCENES.hall, createScene(SCENES.hall, build));
	return novel;
}

/** A scene that notifies between its first two lines, with values read from the state. */
function notifying(ctx: SceneContext): Directive[] {
	return [
		ctx.narrate("opening.welcome"),
		ctx.notify("opening.gold", (state) => ({ gold: state.gold })),
		ctx.narrate("opening.thinking"),
		ctx.narrate("opening.done"),
		ctx.ending("endings.good"),
	];
}

describe("notify", () => {
	test("records the key and its values as plain data", () => {
		let module = createScene(SCENES.hall, (ctx) => [
			ctx.notify("opening.hello", { name: "Ada" }),
			ctx.notify("opening.welcome"),
			// @ts-expect-error -- opening.hello needs its name
			ctx.notify("opening.hello"),
		]);
		expect(module.directives.slice(0, 2)).toEqual([
			{ type: "notify", key: "opening.hello", values: { name: "Ada" } },
			{ type: "notify", key: "opening.welcome" },
		]);
	});

	test("emits once when the play passes it, without a stop and leaving the state as it was", async () => {
		let play = createTestPlay(fixture(notifying), { state: { gold: 7 } });
		await play.advance();
		expect(play.events.filter((event) => event.type === "notify")).toEqual([]);
		await play.advance();
		expect(play.frame).toMatchObject({ type: "line", key: "opening.thinking" });
		let names = play.events.map((event) => event.type);
		expect(names.slice(names.indexOf("notify"), names.indexOf("notify") + 2)).toEqual([
			"notify",
			"line",
		]);
		expect(play.events.filter((event) => event.type === "notify")).toEqual([
			{ type: "notify", payload: { scene: "hall", key: "opening.gold", values: { gold: 7 } } },
		]);
		expect(play.state).toMatchObject({ gold: 7, charm: 0 });
	});

	test("is not emitted again when a rollback or a load lands past it", async () => {
		let novel = fixture(notifying);
		let play = createTestPlay(novel);
		await play.advance();
		await play.advance();
		let saved = JSON.parse(JSON.stringify(play.game)) as GameState;
		await play.advance();
		let previous = await play.play.rollback();
		if (previous?.type !== "line") throw new Error("Expected the line after the notification");
		await play.play.next(previous.advance());
		expect(play.events.filter((event) => event.type === "notify")).toHaveLength(1);

		let loaded = createTestPlay(novel, { from: saved });
		await loaded.advance();
		await loaded.advance();
		expect(loaded.frame).toMatchObject({ key: "opening.done" });
		expect(loaded.events.filter((event) => event.type === "notify")).toEqual([]);
		expect(unwrap(novel.start({ from: saved })).state.position.line).toBe("opening.thinking");
	});

	test("stays silent in a replay", async () => {
		let play = createTestPlay(fixture(notifying), { replay: "scene" });
		await play.advanceUntil("line");
		while (play.frame !== undefined) await play.advance();
		expect(play.events.filter((event) => event.type === "notify")).toEqual([]);
	});

	test("check and explore report a notification key a catalog lacks", async () => {
		let novel = fixture(notifying, {
			messages: {
				en: { opening: { welcome: "Hi", thinking: "Hm", done: "Done" }, endings: { good: "Good" } },
			},
		});
		let report = await check(novel);
		expect(report.problems).toEqual([
			{
				code: "missing-message",
				severity: "error",
				scene: "hall",
				key: "opening.gold",
				locale: "en",
			},
		]);
		expect(report.ok).toBe(false);
		let explored = await explore(novel);
		expect(explored.missingMessages).toEqual({ en: ["opening.gold"] });
	});
});
