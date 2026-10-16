/**
 * Checks the scanline filters against their definitions: one-pass scoring picks the filter a
 * full trial of all five would, and every filter reverses to the original row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { chooseFilter, FILTER_COUNT, filterRow, unfilterRow } from "./filters.js";

/** A deterministic pseudo-random row, so a failure reproduces. */
function randomRow(length: number, seed: number): Uint8Array {
	let row = new Uint8Array(length);
	let state = seed;
	for (let index = 0; index < length; index++) {
		state = (state * 1103515245 + 12345) >>> 0;
		row[index] = state >>> 24;
	}
	return row;
}

/** A smooth row, where prediction beats the raw bytes, as in a rendered gradient. */
function smoothRow(length: number, start: number): Uint8Array {
	return Uint8Array.from({ length }, (_, index) => (start + (index >> 2)) & 0xff);
}

/** The filter the full heuristic picks: every type tried in order, the lowest cost kept. */
function bestByTrial(row: Uint8Array, previous: Uint8Array | undefined, bpp: number): number {
	let out = new Uint8Array(row.length);
	let best = 0;
	let bestCost = Infinity;
	for (let type = 0; type < FILTER_COUNT; type++) {
		let cost = filterRow(type, row, previous, bpp, out);
		if (cost < bestCost) [best, bestCost] = [type, cost];
	}
	return best;
}

describe("chooseFilter", () => {
	test("picks the filter a trial of all five picks", () => {
		for (let bpp of [1, 3, 4]) {
			for (let seed = 1; seed <= 40; seed++) {
				let previous = seed % 5 === 0 ? undefined : randomRow(60, seed * 7);
				for (let row of [randomRow(60, seed), smoothRow(60, seed)]) {
					expect(chooseFilter(row, previous, bpp), `bpp ${bpp} seed ${seed}`).toBe(
						bestByTrial(row, previous, bpp),
					);
				}
			}
		}
	});
});

describe("unfilterRow", () => {
	test("reverses every filter", () => {
		for (let bpp of [1, 3, 4]) {
			let previous = randomRow(48, 3);
			let row = randomRow(48, 9);
			for (let type = 0; type < FILTER_COUNT; type++) {
				let filtered = new Uint8Array(row.length);
				filterRow(type, row, previous, bpp, filtered);
				expect(unfilterRow(type, filtered, previous, bpp)).toBe(true);
				expect(Array.from(filtered)).toEqual(Array.from(row));
			}
		}
	});
});
