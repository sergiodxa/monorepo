/**
 * Holds the auto-mode model to its contract without a DOM: it waits for the voice, then the
 * reader's delay plus a share per character of an unvoiced line, and a wait it drops never fires.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { AUTO_PER_CHARACTER_MS, AutoModel } from "./auto.js";

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe(AutoModel, () => {
	test("adds a share per character only to an unvoiced line", () => {
		expect(AutoModel.delayFor({ length: 10, voiced: false, delay: 1000 })).toBe(
			1000 + 10 * AUTO_PER_CHARACTER_MS,
		);
		expect(AutoModel.delayFor({ length: 10, voiced: true, delay: 1000 })).toBe(1000);
	});

	test("advances once the voice ends and the delay passes", async () => {
		let auto = new AutoModel();
		let advance = vi.fn();
		let endVoice: () => void = () => undefined;
		let voice = new Promise<void>((resolve) => {
			endVoice = resolve;
		});
		auto.set(true);
		auto.wait({ length: 0, voiced: true, delay: 500, after: [voice] }, advance);
		await vi.advanceTimersByTimeAsync(1000);
		expect(advance).not.toHaveBeenCalled();
		endVoice();
		await vi.advanceTimersByTimeAsync(499);
		expect(advance).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(advance).toHaveBeenCalledOnce();
	});

	test("waits for nothing while off, and drops a wait when turned off", async () => {
		let auto = new AutoModel();
		let advance = vi.fn();
		auto.wait({ length: 0, voiced: false, delay: 10 }, advance);
		await vi.advanceTimersByTimeAsync(50);
		expect(advance).not.toHaveBeenCalled();
		let changed = vi.fn();
		auto.addEventListener("change", changed);
		auto.toggle();
		auto.wait({ length: 0, voiced: false, delay: 10 }, advance);
		auto.toggle();
		await vi.advanceTimersByTimeAsync(50);
		expect(advance).not.toHaveBeenCalled();
		expect(changed).toHaveBeenCalledTimes(2);
	});

	test("replaces the pending wait with a new one", async () => {
		let auto = new AutoModel();
		let first = vi.fn();
		let second = vi.fn();
		auto.set(true);
		auto.wait({ length: 0, voiced: false, delay: 10 }, first);
		auto.wait({ length: 0, voiced: false, delay: 10 }, second);
		await vi.advanceTimersByTimeAsync(50);
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledOnce();
	});

	test("waits as long as a subclass's delay() says", async () => {
		/** Holds every line for twice the reader's delay. */
		class SlowAuto extends AutoModel {
			override delay(line: AutoModel.Line): number {
				return line.delay * 2;
			}
		}
		let auto = new SlowAuto();
		let advance = vi.fn();
		auto.set(true);
		auto.wait({ length: 0, voiced: true, delay: 100 }, advance);
		await vi.advanceTimersByTimeAsync(199);
		expect(advance).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(advance).toHaveBeenCalledOnce();
	});
});
