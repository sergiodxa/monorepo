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

	test("defines the marketing layout and display tokens for light mode", () => {
		let root = block(":root {");

		expect(root).toContain("--ui-marketing-measure: 72rem;");
		expect(root).toContain("--ui-marketing-gutter: 1rem;");
		expect(root).toContain("--ui-marketing-section-space: 6rem;");
		expect(root).toContain("--ui-marketing-section-space-compact: 4rem;");
		expect(root).toContain("--ui-marketing-section-space-hero: 8rem;");
		expect(root).toContain("--ui-marketing-display-tracking: -0.04em;");
		expect(root).toContain("--ui-marketing-display-weight: 500;");
		expect(root).toContain("--ui-marketing-display-leading: 1;");
		expect(root).toContain("--ui-marketing-lead-measure: 40rem;");
		expect(root).toContain("--ui-marketing-lead-size: 1.125rem;");
		expect(root).toContain("--ui-marketing-chapter-size: 2.75rem;");
		expect(root).toContain("--ui-marketing-logo-height: 1rem;");
		expect(root).toContain("--ui-marketing-header-height: 4rem;");
		expect(root).toContain("--ui-marketing-cta-radius: 0.5rem;");
		expect(root).toContain("--ui-font-display: var(--ui-font-sans);");
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
