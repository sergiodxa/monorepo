/**
 * Tests for {@link RefreshSchedule}: reloads on its interval one at a time, holds while
 * paused, catches up once on resume, keeps the old time when a reload fails, and never runs
 * when off.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { RefreshSchedule } from "./refresh-schedule.js";

let reloads = 0;

/** A reload that counts itself and resolves at once. */
async function reload(): Promise<void> {
	reloads++;
}

beforeEach(() => {
	vi.useFakeTimers({ now: new Date("2026-11-01T10:00:00Z") });
	reloads = 0;
});

afterEach(() => {
	vi.useRealTimers();
});

describe(RefreshSchedule.name, () => {
	test("reloads every interval and records when", async () => {
		let schedule = new RefreshSchedule({ every: 1000, reload });
		let refreshes = 0;
		schedule.addEventListener("refresh", () => refreshes++);
		schedule.start();

		await vi.advanceTimersByTimeAsync(999);
		expect(reloads).toBe(0);
		await vi.advanceTimersByTimeAsync(1);
		expect(reloads).toBe(1);
		expect(refreshes).toBe(1);
		expect(schedule.refreshedAt.toISOString()).toBe("2026-11-01T10:00:01.000Z");
		await vi.advanceTimersByTimeAsync(1000);
		expect(reloads).toBe(2);
	});

	test("waits a full interval from load for a page fetched long before, such as a cached copy", async () => {
		let schedule = new RefreshSchedule({
			every: 1000,
			reload,
			refreshedAt: new Date("2026-11-01T09:00:00Z"),
		});
		schedule.start();

		await vi.advanceTimersByTimeAsync(999);
		expect(reloads).toBe(0);
		expect(schedule.refreshedAt.toISOString()).toBe("2026-11-01T09:00:00.000Z");
		await vi.advanceTimersByTimeAsync(1);
		expect(reloads).toBe(1);
	});

	test("counts the next interval from the end of a slow reload", async () => {
		let release: (() => void) | undefined;
		let schedule = new RefreshSchedule({
			every: 1000,
			reload: () => {
				reloads++;
				return new Promise<void>((resolve) => (release = resolve));
			},
		});
		schedule.start();

		await vi.advanceTimersByTimeAsync(1000);
		await vi.advanceTimersByTimeAsync(5000);
		expect(reloads).toBe(1);
		release?.();
		await vi.advanceTimersByTimeAsync(999);
		expect(reloads).toBe(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(reloads).toBe(2);
	});

	test("holds while paused and reloads at once on a late resume", async () => {
		let schedule = new RefreshSchedule({ every: 1000, reload });
		schedule.start();
		await vi.advanceTimersByTimeAsync(500);
		schedule.pause();

		await vi.advanceTimersByTimeAsync(5000);
		expect(reloads).toBe(0);
		expect(schedule.paused).toBe(true);

		schedule.resume();
		await vi.advanceTimersByTimeAsync(0);
		expect(reloads).toBe(1);
	});

	test("waits out the rest of the interval on an early resume", async () => {
		let schedule = new RefreshSchedule({ every: 1000, reload });
		schedule.start();
		await vi.advanceTimersByTimeAsync(300);
		schedule.pause();
		await vi.advanceTimersByTimeAsync(200);
		schedule.resume();

		await vi.advanceTimersByTimeAsync(499);
		expect(reloads).toBe(0);
		await vi.advanceTimersByTimeAsync(1);
		expect(reloads).toBe(1);
	});

	test("keeps the last refresh time when a reload fails and tries again next interval", async () => {
		let start = new Date();
		let schedule = new RefreshSchedule({
			every: 1000,
			reload: async () => {
				reloads++;
				throw new Error("offline");
			},
		});
		schedule.start();

		await vi.advanceTimersByTimeAsync(1000);
		expect(reloads).toBe(1);
		expect(schedule.refreshedAt).toEqual(start);
		await vi.advanceTimersByTimeAsync(999);
		expect(reloads).toBe(1);
		await vi.advanceTimersByTimeAsync(1);
		expect(reloads).toBe(2);
	});

	test("never reloads when off or stopped", async () => {
		new RefreshSchedule({ every: 0, reload }).start();
		let stopped = new RefreshSchedule({ every: 1000, reload });
		stopped.start();
		stopped.stop();
		stopped.resume();

		await vi.advanceTimersByTimeAsync(10_000);
		expect(reloads).toBe(0);
	});
});
