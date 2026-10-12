/**
 * Covers the elevation and image-edge tokens as written in `theme.css`: each
 * has a light value, both dark blocks swap it for a light hairline, and high
 * contrast turns the ring into a solid line in the promoted border color.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

const THEME = readFileSync(new URL("./theme.css", import.meta.url), "utf8");

/** The body of the block opened by the first line containing `opener`, up to its closing brace. */
function block(opener: string): string {
	let start = THEME.indexOf(opener);
	return THEME.slice(start, THEME.indexOf("\n}", start));
}

describe("theme.css", () => {
	test("defines the ring, its hover step and the image outline for light mode", () => {
		let root = block(":root {");

		expect(root).toContain("--ui-shadow-ring:");
		expect(root).toContain("--ui-shadow-ring-hover:");
		expect(root).toContain("--ui-image-outline: rgb(0 0 0 / 0.1);");
	});

	test("swaps every token for a light hairline in both dark blocks", () => {
		for (let opener of ["/* Forced dark mode */", "/* System-preference dark mode */"]) {
			let dark = block(opener);

			expect(dark).toContain("--ui-shadow-ring: 0 0 0 1px rgb(255 255 255 / 0.08);");
			expect(dark).toContain("--ui-shadow-ring-hover: 0 0 0 1px rgb(255 255 255 / 0.12);");
			expect(dark).toContain("--ui-image-outline: rgb(255 255 255 / 0.1);");
		}
	});

	test("draws the ring as a solid strong border under high contrast, in every scheme", () => {
		let contrast = block("@media (prefers-contrast: more)");

		expect(contrast).toContain(":is(.dark, .dark *)");
		expect(contrast).toContain(":is(.system, .system *)");
		expect(contrast).toContain("--ui-shadow-ring: 0 0 0 1px var(--ui-neutral-border-strong);");
	});
});
