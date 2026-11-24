/**
 * Holds the autosave model to its contract without a DOM: a save asked for at each chapter's
 * start and after every `every` lines, the count starting over at each save.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test, vi } from "vitest";

import { AUTO_SLOT, AutosaveModel } from "./autosave.js";

describe(AutosaveModel, () => {
	test("writes the autosave slot every 20 lines by default", () => {
		let autosave = new AutosaveModel();
		let save = vi.fn();
		autosave.addEventListener("save", save);
		expect(autosave.slot).toBe(AUTO_SLOT);
		for (let index = 0; index < 19; index++) autosave.line();
		expect(save).not.toHaveBeenCalled();
		autosave.line();
		expect(save).toHaveBeenCalledOnce();
		expect(autosave.pending).toBe(0);
	});

	test("saves at a chapter's start and counts its lines from zero", () => {
		let autosave = new AutosaveModel({ every: 3, slot: "chapter" });
		let save = vi.fn();
		autosave.addEventListener("save", save);
		autosave.line();
		autosave.line();
		autosave.chapter();
		expect(save).toHaveBeenCalledOnce();
		autosave.line();
		autosave.line();
		expect(save).toHaveBeenCalledOnce();
		autosave.line();
		expect(save).toHaveBeenCalledTimes(2);
		expect(autosave.slot).toBe("chapter");
	});

	test("never waits for fewer than one line", () => {
		let autosave = new AutosaveModel({ every: 0 });
		let save = vi.fn();
		autosave.addEventListener("save", save);
		autosave.line();
		expect(save).toHaveBeenCalledOnce();
	});

	test("saves when the reader leaves with lines shown since the last save", () => {
		let autosave = new AutosaveModel({ every: 20 });
		let save = vi.fn();
		autosave.addEventListener("save", save);
		autosave.leave();
		expect(save).not.toHaveBeenCalled();
		autosave.line();
		autosave.leave();
		expect(save).toHaveBeenCalledOnce();
		expect(autosave.pending).toBe(0);
		autosave.leave();
		expect(save).toHaveBeenCalledOnce();
	});
});
