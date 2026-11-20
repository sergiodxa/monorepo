/**
 * Copying play state with its Blob files kept: the copy is independent of the original, and a
 * play hands the declared Blob itself to every frame, so the player reuses one object URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import { copyKeepingFiles } from "./files.js";
import { createTestPlay } from "./test.js";

import { assets, createNovel, createScene, scene, scenes } from "./index.js";

/** The story state every fixture in the package shares. */
const STATE = s.object({
	gold: s.defaulted(s.number(), 10),
	charm: s.defaulted(s.number(), 0),
	affection: s.defaulted(s.object({ mika: s.defaulted(s.number(), 0) }), { mika: 0 }),
	lastCatch: s.optional(s.object({ caught: s.number() })),
});

describe(copyKeepingFiles, () => {
	test("copies a saved state with prototype keys without touching any prototype", () => {
		let saved: unknown = JSON.parse(
			'{"__proto__": {"polluted": true}, "stage": {"constructor": {"prototype": {"polluted": true}}}}',
		);

		let copy = copyKeepingFiles(saved) as Record<string, unknown>;

		expect(Object.getPrototypeOf(copy)).toBe(Object.prototype);
		expect(({} as Record<string, unknown>)["polluted"]).toBeUndefined();
		expect(Object.prototype.hasOwnProperty.call(copy, "__proto__")).toBe(true);
		expect(JSON.stringify(copy)).toBe(JSON.stringify(saved));
	});

	test("copies the state and keeps each Blob", () => {
		let file = new Blob(["cafe"]);
		let state = { stage: { background: { id: "backgrounds.cafe", src: file } }, list: [file, 1] };
		let copy = copyKeepingFiles(state);
		expect(copy).not.toBe(state);
		expect(copy.stage.background).not.toBe(state.stage.background);
		expect(copy.stage.background.src).toBe(file);
		expect(copy.list[0]).toBe(file);
		copy.stage.background.id = "backgrounds.park";
		expect(state.stage.background.id).toBe("backgrounds.cafe");
	});

	test("hands a play's frames the declared Blob", async () => {
		let declared = scenes({ only: scene() });
		let files = assets({
			backgrounds: { cafe: new Blob(["cafe"], { type: "image/png" }) },
			music: { theme: new Blob(["theme"], { type: "audio/wav" }) },
		});
		let novel = createNovel({
			scenes: declared,
			assets: files,
			state: STATE,
			initial: declared.only,
		});
		novel.map(
			declared.only,
			createScene(declared.only, (ctx) => [
				ctx.show(files.backgrounds.cafe),
				ctx.play(files.music.theme),
				ctx.narrate("opening.welcome"),
				ctx.narrate("opening.thinking"),
			]),
		);
		let play = createTestPlay(novel);
		let first = await play.advance();
		let second = await play.advance();
		for (let frame of [first, second]) {
			expect(frame?.stage.background?.src).toBe(files.backgrounds.cafe.src);
			expect(frame?.audio.music?.src).toBe(files.music.theme.src);
		}
	});
});
