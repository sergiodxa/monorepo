/**
 * Tests the palette a showcase item's social card reads from its cover: the page's own colour as
 * the background, its most vivid colour as the accent, an item's own accent winning, and text
 * that reads on both.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { Pixels, RGB } from "~/scripts/showcase-cards";

import { readPalette } from "~/scripts/showcase-cards";

/**
 * A 100×100 image painted in runs: each entry fills `count` pixels with one colour, in order,
 * and the rest stay the first colour.
 */
function painted(runs: Array<[RGB, number]>): Pixels {
	let data = new Uint8ClampedArray(100 * 100 * 4);
	let [first] = runs;
	let pixel = 0;
	for (let [rgb, count] of runs) {
		for (let index = 0; index < count; index++, pixel++) data.set([...rgb, 255], pixel * 4);
	}
	for (; pixel < 10_000; pixel++) data.set([...(first?.[0] ?? [0, 0, 0]), 255], pixel * 4);
	return { width: 100, height: 100, data };
}

describe("readPalette", () => {
	test("takes the page's colour as the background and its most vivid colour as the accent", () => {
		let image = painted([
			[[250, 248, 244], 8000],
			[[40, 40, 44], 1500],
			[[1, 125, 92], 300],
			[[180, 180, 180], 200],
		]);

		expect(readPalette(image)).toEqual({
			background: "#faf8f4",
			foreground: "#14141a",
			accent: "#017d5c",
			onAccent: "#f6f6f8",
		});
	});

	test("sets light text on a dark page and dark text on a light accent", () => {
		let image = painted([
			[[7, 9, 8], 9000],
			[[164, 233, 46], 400],
		]);

		expect(readPalette(image)).toMatchObject({
			background: "#070908",
			foreground: "#f6f6f8",
			accent: "#a4e92e",
			onAccent: "#14141a",
		});
	});

	test("mixes a quiet accent from a screenshot with no vivid colour", () => {
		let image = painted([
			[[255, 255, 255], 9000],
			[[20, 20, 20], 1000],
		]);

		let channels = [1, 3, 5].map((start) =>
			Number.parseInt(readPalette(image).accent.slice(start, start + 2), 16),
		);

		expect(Math.max(...channels) - Math.min(...channels)).toBeLessThan(8);
		expect(channels[0]).toBeGreaterThan(60);
		expect(channels[0]).toBeLessThan(200);
	});

	test("uses the item's own accent when it names one", () => {
		let image = painted([
			[[250, 250, 250], 9000],
			[[200, 30, 30], 1000],
		]);

		expect(readPalette(image, [34, 117, 73]).accent).toBe("#227549");
	});
});
