/**
 * Tests for addresses, handles, and links: that every generated address is
 * unroutable, that a handle survives an accented or punctuated name, and that a
 * password avoids the characters people misread.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { en } from "../data/en";
import { createRandom } from "../random";

import { createInternetModule } from "./internet";

const RESERVED = /^example\.(com|org|net)$/;

function module(seed: string) {
	return createInternetModule(createRandom(seed), en);
}

describe("email", () => {
	test("lands on a domain reserved for documentation", () => {
		let internet = module("addresses");

		for (let count = 0; count < 300; count++) {
			let domain = internet.email().split("@").at(1) as string;
			expect(domain).toMatch(RESERVED);
		}
	});

	test("carries the name it was given", () => {
		let internet = module("named");

		expect(internet.email({ firstName: "Ana", lastName: "Moreau" })).toMatch(
			/^ana\.moreau\d{1,2}@example\.(com|org|net)$/,
		);
	});

	test("varies the address between calls", () => {
		let internet = module("varies");
		let seen = new Set(Array.from({ length: 200 }, () => internet.email()));

		expect(seen.size).toBeGreaterThan(150);
	});
});

describe("username", () => {
	test("joins a first and last name with a dot", () => {
		expect(module("handles").username({ firstName: "Ana", lastName: "Moreau" })).toBe("ana.moreau");
	});

	test("folds accents onto their base letter", () => {
		let internet = module("handles");

		expect(internet.username({ firstName: "Lucía", lastName: "Ibáñez" })).toBe("lucia.ibanez");
		expect(internet.username({ firstName: "Álvaro", lastName: "Müller" })).toBe("alvaro.muller");
	});

	test("drops the punctuation a name can carry", () => {
		let internet = module("handles");

		expect(internet.username({ firstName: "Anne-Marie", lastName: "O'Brien" })).toBe(
			"annemarie.obrien",
		);
	});

	test("holds only characters an address can carry", () => {
		let internet = module("charset");

		for (let count = 0; count < 200; count++) {
			expect(internet.username()).toMatch(/^[a-z0-9]+\.[a-z0-9]+$/);
		}
	});
});

describe("domain and url", () => {
	test("returns only reserved domains", () => {
		let internet = module("domains");
		let seen = new Set(Array.from({ length: 200 }, () => internet.domain()));

		for (let domain of seen) expect(domain).toMatch(RESERVED);
		expect(seen.size).toBe(3);
	});

	test("builds a link on a reserved domain", () => {
		let internet = module("links");

		for (let count = 0; count < 100; count++) {
			expect(internet.url()).toMatch(/^https:\/\/[a-z0-9]+\.example\.(com|org|net)$/);
		}
	});
});

describe("password", () => {
	test("runs to sixteen characters by default", () => {
		expect(module("passwords").password()).toHaveLength(16);
	});

	test("runs to the length asked for", () => {
		expect(module("passwords").password({ length: 40 })).toHaveLength(40);
	});

	test("leaves out the characters people misread", () => {
		let internet = module("legible");
		let drawn = Array.from({ length: 200 }, () => internet.password({ length: 32 })).join("");

		for (let character of ["l", "I", "1", "O", "0"]) {
			expect(drawn).not.toContain(character);
		}
	});
});
