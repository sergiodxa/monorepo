/**
 * Holds `strip` to leaving a readable rest of the sentence once its date phrases are taken out:
 * stranded "on", "at" and commas go, whitespace collapses, and overlapping ranges are skipped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { find } from "./find.js";
import { strip } from "./strip.js";

/** The text with every phrase `find` reads in it removed. */
function rest(text: string): string {
	let found = unwrap(
		find(text, { now: new Date("2026-11-18T17:00:00Z"), timeZone: "America/New_York" }),
	);
	return strip(text, found.matches);
}

describe("strip", () => {
	test.each([
		["Lunch with Ana tomorrow 1pm", "Lunch with Ana"],
		["Dentist on Friday at 8:30am", "Dentist"],
		["Tomorrow: call the bank", "call the bank"],
		["Design sync every other Tuesday until March at 3pm", "Design sync"],
		["Standup 9:30-9:45, every weekday", "Standup"],
		["Buy milk", "Buy milk"],
		["Format review tomorrow", "Format review"],
		["Onboarding call on Friday", "Onboarding call"],
	])("leaves %s as %s", (text, title) => {
		expect(rest(text)).toBe(title);
	});

	test("removes stranded words after a long run of blanks in linear time", () => {
		let started = performance.now();
		expect(strip(`a${"\t,".repeat(50_000)}x`, [])).toBe(`a${",".repeat(50_000)}x`);
		expect(strip(`a${" ,".repeat(50_000)}`, [])).toBe("a");
		expect(performance.now() - started).toBeLessThan(1000);
	});

	test("skips a range that overlaps one already removed", () => {
		expect(
			strip("abc def ghi", [
				{ index: 4, end: 7 },
				{ index: 5, end: 9 },
			]),
		).toBe("abc ghi");
	});
});
