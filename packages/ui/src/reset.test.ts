/**
 * Covers the base reset's exemptions as written in `reset.css`: the user-agent
 * styles MathML lays itself out with survive the margin and padding reset, and
 * formulas draw in a font that can stretch fences and big operators.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

const RESET = readFileSync(new URL("./reset.css", import.meta.url), "utf8");

describe("reset.css", () => {
	test("leaves the padding that spaces matrix cells to everything inside math", () => {
		expect(RESET).toContain(":where(:not(dialog, [popover], math *)),");
	});

	test("draws math in a font with a MATH table ahead of the generic family", () => {
		expect(RESET).toMatch(
			/:where\(math\) \{\s*font-family: "STIX Two Math", "Cambria Math", math;\s*\}/,
		);
	});
});
