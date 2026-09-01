/**
 * Tests for placeholder prose: that a count is honored exactly, that words come
 * from the dataset and nowhere else, and that a sentence reads as one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { Dataset } from "../dataset";

import { en } from "../data/en";
import { createRandom } from "../random";

import { createLoremModule } from "./lorem";

function module(seed: string, data: Dataset = en) {
	return createLoremModule(createRandom(seed), data);
}

describe("words", () => {
	test("returns exactly the count asked for", () => {
		let lorem = module("words");

		expect(lorem.words(1).split(" ")).toHaveLength(1);
		expect(lorem.words(7).split(" ")).toHaveLength(7);
	});

	test("returns nothing for a count of zero", () => {
		expect(module("empty").words(0)).toBe("");
	});

	test("draws only from the dataset", () => {
		let vocabulary = new Set(en.lorem);
		let lorem = module("vocabulary");

		for (let word of lorem.words(500).split(" ")) {
			expect(vocabulary.has(word)).toBe(true);
		}
	});

	test("refuses a count that is not a count", () => {
		expect(() => module("bad").words(-1)).toThrow(/words\(\) needs a count/);
		expect(() => module("bad").words(1.5)).toThrow(/words\(\) needs a count/);
	});
});

describe("sentence", () => {
	test("opens with a capital and closes with a period", () => {
		let lorem = module("sentences");

		for (let count = 0; count < 100; count++) {
			let sentence = lorem.sentence();
			expect(sentence.charAt(0)).toBe(sentence.charAt(0).toUpperCase());
			expect(sentence.endsWith(".")).toBe(true);
		}
	});

	test("runs to a handful of words", () => {
		let lorem = module("lengths");

		for (let count = 0; count < 100; count++) {
			let words = lorem.sentence().slice(0, -1).split(" ");
			expect(words.length).toBeGreaterThanOrEqual(4);
			expect(words.length).toBeLessThanOrEqual(12);
		}
	});
});

describe("paragraph", () => {
	test("runs to four sentences by default", () => {
		expect(module("paragraphs").paragraph().match(/\./g)).toHaveLength(4);
	});

	test("runs to the number of sentences asked for", () => {
		expect(module("paragraphs").paragraph({ sentences: 2 }).match(/\./g)).toHaveLength(2);
	});
});

describe("a caller's own vocabulary", () => {
	test("draws from the words it was handed", () => {
		let data: Dataset = { ...en, lorem: ["alpha"] };

		expect(module("custom", data).words(3)).toBe("alpha alpha alpha");
	});
});
