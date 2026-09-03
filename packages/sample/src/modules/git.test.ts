/**
 * Tests for repository furniture: that a hash is hexadecimal at the length
 * asked for, that a branch reads as a branch, and that a log entry carries the
 * four lines a reader of `git log` expects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { en } from "../data/en.js";
import { createRandom } from "../random.js";

import { createDateModule } from "./date.js";
import { createGitModule } from "./git.js";
import { createInternetModule } from "./internet.js";
import { createPersonModule } from "./person.js";
import { createPhoneModule } from "./phone.js";

const NOW = new Date("2026-06-15T12:00:00.000Z");

function module(seed: string) {
	let random = createRandom(seed);
	let internet = createInternetModule(random, en);
	let person = createPersonModule(random, en, internet, createPhoneModule(random));
	return createGitModule(random, en, person, internet, createDateModule(random, en, NOW));
}

describe("commitSha", () => {
	test("returns forty hexadecimal characters by default", () => {
		expect(module("sha").commitSha()).toMatch(/^[0-9a-f]{40}$/);
	});

	test("returns the short form on request", () => {
		expect(module("sha").commitSha({ length: 7 })).toMatch(/^[0-9a-f]{7}$/);
	});

	test("refuses a length that is not a length", () => {
		expect(() => module("sha").commitSha({ length: 0 })).toThrow(RangeError);
	});
});

describe("branch and message", () => {
	test("writes a branch as dash-separated words", () => {
		let git = module("branches");

		for (let count = 0; count < 50; count++) {
			expect(git.branch()).toMatch(/^[a-z0-9-]+$/);
		}
	});

	test("writes a message as a verb and an object", () => {
		let git = module("messages");
		let message = git.commitMessage();

		expect(message.length).toBeGreaterThan(3);
		expect(message).toBe(message.toLowerCase());
	});
});

describe("commitDate and commitEntry", () => {
	test("writes a date the way git log does", () => {
		expect(module("dates").commitDate()).toMatch(
			/^[A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2} \d{4} \d{2}:\d{2}:\d{2} \+0000$/,
		);
	});

	test("writes an entry with a hash, an author, a date and a message", () => {
		let entry = module("entries").commitEntry();
		let lines = entry.split("\n");

		expect(lines[0]).toMatch(/^commit [0-9a-f]{40}$/);
		expect(lines[1]).toMatch(/^Author: .+ <.+@example\.(com|org|net)>$/);
		expect(lines[2]).toMatch(/^Date: /);
		expect(lines[4]?.startsWith("    ")).toBe(true);
	});
});

describe("determinism", () => {
	test("replays from the seed", () => {
		expect(module("fixed").commitEntry()).toBe(module("fixed").commitEntry());
	});
});
