/**
 * Covers the headline a component page opens with, which is the one line a reader meets
 * before the example.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { toHeadline } from "./headline.js";

describe("toHeadline", () => {
	test("keeps a summary that already reads as one line", () => {
		let summary = "A compact pill communicating a short status, label, or count inline.";

		expect(toHeadline(summary)).toBe(summary);
	});

	test("stops at the dash a definition trails its detail behind", () => {
		expect(
			toHeadline(
				"An interruptive modal surface that demands an explicit response before a page continues — confirming a destructive action, sealed against light dismiss.",
			),
		).toBe(
			"An interruptive modal surface that demands an explicit response before a page continues.",
		);
	});

	test("keeps as many clauses as fit, cutting at the last one before the limit", () => {
		expect(
			toHeadline(
				"A person's picture rendered as a fixed-size, fully circular host stacking an image layer, an initials fallback, and an optional corner status badge.",
			),
		).toBe(
			"A person's picture rendered as a fixed-size, fully circular host stacking an image layer, an initials fallback.",
		);
	});

	test("stops at the colon a definition introduces its detail with", () => {
		expect(
			toHeadline(
				'A styled native checkbox: an `<input type="checkbox">` paired with a decorative glyph box that renders its mark purely from the input\'s own state.',
			),
		).toBe("A styled native checkbox.");
	});

	test("cuts before a clause that hangs off the sentence, not inside a list", () => {
		expect(
			toHeadline(
				"A hierarchical list of nodes built from nested `<details>` and `<summary>` elements, so a branch's expand/collapse state, keyboard toggling, and content hiding all come from the platform.",
			),
		).toBe("A hierarchical list of nodes built from nested `<details>` and `<summary>` elements.");
	});

	test("leaves a sentence whole when every comma of it is a list", () => {
		let listed =
			"A control that reports the day, the month, the year and the weekday it currently stands on for a reader.";

		expect(toHeadline(listed)).toBe(listed);
	});

	test("hands back a long summary that offers no clause to cut at", () => {
		let unbroken = `A${"a".repeat(200)}.`;

		expect(toHeadline(unbroken)).toBe(unbroken);
	});
});
