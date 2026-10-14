/**
 * Covers the split a reference sentence goes through before a page draws it, since the
 * backticks a doc comment writes are markup to the page and literal text to a reader.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { toRuns } from "./reference-prose.js";

describe("toRuns", () => {
	test("reads a sentence with no code as one run of prose", () => {
		expect(toRuns("A compact pill communicating a short status.")).toEqual([
			{ code: false, text: "A compact pill communicating a short status." },
		]);
	});

	test("lifts a code run out of the prose around it", () => {
		expect(toRuns("Built on the native `<details>` element.")).toEqual([
			{ code: false, text: "Built on the native " },
			{ code: true, text: "<details>" },
			{ code: false, text: " element." },
		]);
	});

	test("keeps two code runs in one sentence apart", () => {
		expect(toRuns("The `<details>` and `<summary>` elements.")).toEqual([
			{ code: false, text: "The " },
			{ code: true, text: "<details>" },
			{ code: false, text: " and " },
			{ code: true, text: "<summary>" },
			{ code: false, text: " elements." },
		]);
	});

	test("opens with a code run when the sentence does", () => {
		expect(toRuns("`commandfor` names the surface.")).toEqual([
			{ code: true, text: "commandfor" },
			{ code: false, text: " names the surface." },
		]);
	});

	test("closes on a code run when the sentence does", () => {
		expect(toRuns("Opened through `commandfor`")).toEqual([
			{ code: false, text: "Opened through " },
			{ code: true, text: "commandfor" },
		]);
	});

	test("leaves an unpaired backtick in the prose it sits in", () => {
		expect(toRuns("A stray ` mark and nothing to close it.")).toEqual([
			{ code: false, text: "A stray ` mark and nothing to close it." },
		]);
	});

	test("reads an empty sentence as no runs at all", () => {
		expect(toRuns("")).toEqual([]);
	});
});
