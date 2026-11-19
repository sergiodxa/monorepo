/**
 * Holds the play queue to what a listener expects of Next, Previous, shuffle and repeat, and
 * the track clock to the times a player shows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	createPlayQueue,
	currentIndex,
	cycleRepeat,
	jumpTo,
	nextInQueue,
	previousInQueue,
	toggleShuffle,
	upcoming,
} from "./play-queue.js";
import { formatTotalTime, formatTrackTime } from "./track-time.js";

/** A random source that walks a fixed sequence, so a shuffle is the same every run. */
function fixed(...values: number[]): () => number {
	let index = 0;
	return () => values[index++ % values.length] ?? 0;
}

describe("play queue", () => {
	test("starts on the chosen track in list order", () => {
		let queue = createPlayQueue(5, 2);
		expect(currentIndex(queue)).toBe(2);
		expect(upcoming(queue)).toEqual([3, 4]);
	});

	test("shuffles the rest after the chosen track, which plays first", () => {
		let queue = createPlayQueue(5, 3, { shuffle: true, random: fixed(0.1, 0.9, 0.5) });
		expect(queue.order[0]).toBe(3);
		expect([...queue.order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
	});

	test("ends after the last track without repeat, and starts over with repeat all", () => {
		let last = createPlayQueue(3, 2);
		expect(nextInQueue(last)).toBeNull();
		let again = nextInQueue({ ...last, repeat: "all" });
		expect(again === null ? undefined : currentIndex(again)).toBe(0);
	});

	test("repeats one track when it ends by itself, but Next still moves on", () => {
		let queue = { ...createPlayQueue(3, 1), repeat: "one" as const };
		expect(nextInQueue(queue, true)).toBe(queue);
		let pressed = nextInQueue(queue);
		expect(pressed === null ? undefined : currentIndex(pressed)).toBe(2);
	});

	test("restarts a track past three seconds, and goes back one before that", () => {
		let queue = createPlayQueue(4, 2);
		expect(previousInQueue(queue, 12)).toEqual({ queue, restart: true });
		expect(currentIndex(previousInQueue(queue, 1).queue)).toBe(1);
		let first = createPlayQueue(4, 0);
		expect(previousInQueue(first, 1).restart).toBe(true);
		expect(currentIndex(previousInQueue({ ...first, repeat: "all" }, 1).queue)).toBe(3);
	});

	test("keeps the playing track when shuffle turns on or off", () => {
		let queue = createPlayQueue(6, 4);
		let shuffled = toggleShuffle(queue, fixed(0.3, 0.7));
		expect(shuffled.shuffle).toBe(true);
		expect(currentIndex(shuffled)).toBe(4);
		let back = toggleShuffle(shuffled);
		expect(back.shuffle).toBe(false);
		expect(currentIndex(back)).toBe(4);
		expect(upcoming(back)).toEqual([5]);
	});

	test("cycles repeat off, all, one and off again, and jumps to a queued track", () => {
		let queue = createPlayQueue(4, 0);
		let modes = [
			cycleRepeat(queue),
			cycleRepeat(cycleRepeat(queue)),
			cycleRepeat(cycleRepeat(cycleRepeat(queue))),
		];
		expect(modes.map((entry) => entry.repeat)).toEqual(["all", "one", "off"]);
		expect(currentIndex(jumpTo(queue, 3))).toBe(3);
		expect(jumpTo(queue, 9)).toBe(queue);
	});

	test("lists the start of the list after its end under repeat all", () => {
		let queue = { ...createPlayQueue(4, 2), repeat: "all" as const };
		expect(upcoming(queue)).toEqual([3, 0, 1]);
		expect(upcoming(queue, 2)).toEqual([3, 0]);
	});
});

describe("track time", () => {
	test("writes lengths as a clock, and an unknown length as zero", () => {
		expect(formatTrackTime(187)).toBe("3:07");
		expect(formatTrackTime(3765)).toBe("1:02:45");
		expect(formatTrackTime(Number.NaN)).toBe("0:00");
		expect(formatTrackTime(-4)).toBe("0:00");
	});

	test("writes a collection's total in hours and minutes", () => {
		let units = { hour: "hr", minute: "min" };
		expect(formatTotalTime(2280, units)).toBe("38 min");
		expect(formatTotalTime(4320, units)).toBe("1 hr 12 min");
	});
});
