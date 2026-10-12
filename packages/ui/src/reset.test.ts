/**
 * Covers the base reset's exemptions as written in `reset.css`: the user-agent
 * styles MathML lays itself out with survive the margin and padding reset,
 * formulas draw in a font that can stretch fences and big operators, and the
 * document root smooths its text with grayscale antialiasing.
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

	test("smooths text with grayscale antialiasing at the document root", () => {
		expect(RESET).toMatch(
			/:where\(html, :host\) \{[^}]*-webkit-font-smoothing: antialiased;\s*-moz-osx-font-smoothing: grayscale;[^}]*\}/,
		);
	});
});
