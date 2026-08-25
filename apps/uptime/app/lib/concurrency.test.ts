/**
 * Unit tests for the sweep concurrency helpers: how `chunk` groups items, and the two
 * guarantees `mapWithConcurrency` gives its callers — that no more than `concurrency`
 * items are ever in flight at once, and that every other item keeps running to
 * completion when one throws.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { chunk, mapWithConcurrency, SWEEP_CONCURRENCY } from "~/app/lib/concurrency";

describe("chunk", () => {
	test("splits into consecutive groups of at most the given size", () => {
		expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
	});

	test("returns no chunks for an empty list", () => {
		expect(chunk([], 10)).toEqual([]);
	});

	test("returns a single chunk when the size exceeds the list length", () => {
		expect(chunk([1, 2], 10)).toEqual([[1, 2]]);
	});

	test("rejects a size that can't make progress", () => {
		expect(() => chunk([1, 2], 0)).toThrow(RangeError);
	});
});

describe("mapWithConcurrency", () => {
	test("runs every item and returns its value paired with the item", async () => {
		let settled = await mapWithConcurrency([1, 2, 3], async (item) => item * 2, 2);

		expect(settled).toEqual([
			{ item: 1, ok: true, value: 2 },
			{ item: 2, ok: true, value: 4 },
			{ item: 3, ok: true, value: 6 },
		]);
	});

	test("never runs more than `concurrency` items at once", async () => {
		let inFlight = 0;
		let peak = 0;

		await mapWithConcurrency(
			Array.from({ length: 25 }, (_value, index) => index),
			async () => {
				inFlight++;
				peak = Math.max(peak, inFlight);
				await Promise.resolve();
				inFlight--;
			},
			4,
		);

		expect(peak).toBe(4);
	});

	test("isolates a failure: the rest of the batch and the batches after it still run", async () => {
		let ran: number[] = [];

		let settled = await mapWithConcurrency(
			[1, 2, 3, 4],
			async (item) => {
				ran.push(item);
				if (item === 1) throw new Error("boom");
				return item;
			},
			2,
		);

		expect(ran.sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
		expect(settled.filter((outcome) => outcome.ok)).toHaveLength(3);

		let failure = settled.find((outcome) => !outcome.ok);
		expect(failure?.item).toBe(1);
		expect(failure?.ok === false && failure.error).toBeInstanceOf(Error);
	});

	test("defaults to the shared sweep concurrency", async () => {
		let inFlight = 0;
		let peak = 0;

		await mapWithConcurrency(
			Array.from({ length: SWEEP_CONCURRENCY * 3 }, (_value, index) => index),
			async () => {
				inFlight++;
				peak = Math.max(peak, inFlight);
				await Promise.resolve();
				inFlight--;
			},
		);

		expect(peak).toBe(SWEEP_CONCURRENCY);
	});
});
