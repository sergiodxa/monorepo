/**
 * Tests for the technical filler: that each word comes from its own list, and
 * that a phrase leaves no placeholder behind.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { en } from "../data/en.js";
import { createRandom } from "../random.js";

import { createHackerModule } from "./hacker.js";

function module(seed: string) {
	return createHackerModule(createRandom(seed), en);
}

describe("words", () => {
	test("draws each kind from its own list", () => {
		let hacker = module("words");

		expect(en.hackerAbbreviations).toContain(hacker.abbreviation());
		expect(en.hackerAdjectives).toContain(hacker.adjective());
		expect(en.hackerNouns).toContain(hacker.noun());
		expect(en.hackerVerbs).toContain(hacker.verb());
		expect(en.hackerIngverbs).toContain(hacker.ingverb());
	});
});

describe("phrase", () => {
	test("fills every placeholder", () => {
		let hacker = module("phrases");

		for (let count = 0; count < 100; count++) {
			let phrase = hacker.phrase();
			expect(phrase).not.toContain("{");
			expect(phrase).not.toContain("}");
			expect(phrase.endsWith("!")).toBe(true);
		}
	});

	test("varies across calls", () => {
		let hacker = module("varies");
		let seen = new Set(Array.from({ length: 50 }, () => hacker.phrase()));

		expect(seen.size).toBeGreaterThan(40);
	});
});
