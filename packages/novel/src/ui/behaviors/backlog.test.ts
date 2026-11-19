/**
 * Holds the backlog model to its contract without a DOM: lines in reading order with their
 * voice resolved for the locale, a line shown again replacing its entry, a rollback leaving it,
 * and the size bound.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test, vi } from "vitest";

import type { LineFrame } from "../../frames.js";

import { BacklogModel } from "./backlog.js";

/** A line frame of `key`. */
function line(key: string, voice: LineFrame["voice"] = null): LineFrame {
	return { type: "line", id: `id-${key}`, scene: "s", key, voice, speakers: [] } as never;
}

describe(BacklogModel, () => {
	test("records lines in order, resolving their voice for the locale", () => {
		let backlog = new BacklogModel();
		let changed = vi.fn();
		backlog.addEventListener("change", changed);
		backlog.record(line("a"), "en");
		backlog.record(line("b", { en: "/b.en.ogg", ja: "/b.ja.ogg" }), "ja");
		expect(backlog.entries.map((entry) => [entry.key, entry.voice])).toEqual([
			["a", null],
			["b", "/b.ja.ogg"],
		]);
		expect(changed).toHaveBeenCalledTimes(2);
	});

	test("replaces a line shown again and drops it when a rollback leaves it", () => {
		let backlog = new BacklogModel();
		backlog.record(line("a"), "en");
		backlog.record(line("b"), "en");
		backlog.record(line("b"), "en");
		expect(backlog.entries.map((entry) => entry.key)).toEqual(["a", "b"]);
		backlog.leave(line("a"));
		expect(backlog.entries).toHaveLength(2);
		backlog.leave(line("b"));
		expect(backlog.entries.map((entry) => entry.key)).toEqual(["a"]);
	});

	test("keeps only the newest lines up to its size, and starts over from replace()", () => {
		let backlog = new BacklogModel(2);
		for (let key of ["a", "b", "c"]) backlog.record(line(key), "en");
		expect(backlog.entries.map((entry) => entry.key)).toEqual(["b", "c"]);
		backlog.replace([]);
		expect(backlog.entries).toEqual([]);
	});
});
