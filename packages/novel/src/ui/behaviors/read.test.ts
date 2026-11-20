/**
 * Holds the read-line model to its contract without a DOM: each line's `seen` kept under its
 * frame id, the current stop's status with a `change` when it flips, and a bounded memory.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test, vi } from "vitest";

import type { StopFrame } from "../../frames.js";

import { ReadModel } from "./read.js";

/** A stand-in line frame; the model reads its type, id and `seen` only. */
function line(id: string, seen: boolean): StopFrame {
	return { type: "line", id, seen } as unknown as StopFrame;
}

/** A stand-in pause; the model reads its type only. */
const PAUSE = { type: "pause", id: "pause" } as unknown as StopFrame;

describe(ReadModel, () => {
	test("keeps whether each shown line had been read before", () => {
		let read = new ReadModel();
		let changed = vi.fn();
		read.addEventListener("change", changed);
		read.record(line("a", false));
		expect(read.current).toBe(false);
		expect(changed).not.toHaveBeenCalled();
		read.record(line("b", true));
		expect(read.current).toBe(true);
		expect(read.isRead("a")).toBe(false);
		expect(read.isRead("b")).toBe(true);
		expect(read.isRead("unknown")).toBe(false);
		expect(changed).toHaveBeenCalledOnce();
	});

	test("leaves the current stop unread at anything but a line", () => {
		let read = new ReadModel();
		read.record(line("a", true));
		read.record(PAUSE);
		expect(read.current).toBe(false);
		expect(read.isRead("a")).toBe(true);
	});

	test("forgets the oldest lines past its size", () => {
		let read = new ReadModel(2);
		read.record(line("a", true));
		read.record(line("b", true));
		read.record(line("c", true));
		expect(read.isRead("a")).toBe(false);
		expect(read.isRead("c")).toBe(true);
	});
});
