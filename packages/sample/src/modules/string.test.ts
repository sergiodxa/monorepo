/**
 * Tests for identifiers and character runs: that a UUID carries the version and
 * variant bits its format requires, that a run holds only the characters of its
 * base, and that a nonsensical length is refused rather than rounded.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { createRandom } from "../random";

import { createStringModule } from "./string";

function module(seed: string) {
	return createStringModule(createRandom(seed));
}

describe("uuid", () => {
	test("stamps the version and variant a version 4 identifier declares", () => {
		let string = module("uuids");

		for (let count = 0; count < 200; count++) {
			let uuid = string.uuid();
			expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
		}
	});

	test("replays from the seed", () => {
		expect(module("ids").uuid()).toBe(module("ids").uuid());
	});

	test("returns a different identifier on each call", () => {
		let string = module("ids");
		let seen = new Set(Array.from({ length: 100 }, () => string.uuid()));

		expect(seen.size).toBe(100);
	});
});

describe("alphanumeric", () => {
	test("holds only digits and lowercase letters", () => {
		let string = module("runs");

		for (let count = 0; count < 100; count++) {
			expect(string.alphanumeric(24)).toMatch(/^[0-9a-z]{24}$/);
		}
	});

	test("reaches both the digits and the far end of the letters", () => {
		let string = module("coverage");
		let drawn = string.alphanumeric(2000);

		expect(drawn).toMatch(/[0-9]/);
		expect(drawn).toMatch(/z/);
	});

	test("returns nothing for a length of zero", () => {
		expect(module("empty").alphanumeric(0)).toBe("");
	});
});

describe("hex", () => {
	test("holds only hexadecimal digits", () => {
		let string = module("hex");

		for (let count = 0; count < 100; count++) {
			expect(string.hex(16)).toMatch(/^[0-9a-f]{16}$/);
		}
	});

	test("reaches every digit of the base", () => {
		let drawn = module("hex-coverage").hex(2000);

		expect(new Set(drawn).size).toBe(16);
	});
});

describe("a length that is not a count", () => {
	test("refuses a negative length", () => {
		expect(() => module("bad").alphanumeric(-1)).toThrow(/alphanumeric\(\) needs a length/);
	});

	test("refuses a fractional length", () => {
		expect(() => module("bad").hex(2.5)).toThrow(/hex\(\) needs a length/);
	});
});
