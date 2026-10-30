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
		expect(root).toContain("--ui-marketing-section-space: clamp(5rem, 3.86rem + 4.85cqi, 7.5rem);");
		expect(root).toContain("--ui-marketing-section-space-compact: clamp(3rem,");
		expect(root).toContain("--ui-marketing-section-space-hero: clamp(3.5rem,");
		expect(root).toContain("--ui-marketing-section-space-cta: clamp(5rem,");
		expect(root).toContain("--ui-marketing-header-space: clamp(2.5rem,");
		expect(root).toContain("--ui-marketing-display-tracking: -0.035em;");
		expect(root).toContain("--ui-marketing-display-weight: 500;");
		expect(root).toContain("--ui-marketing-display-max: 4.5rem;");
		expect(root).toContain("--ui-marketing-chapter-size: clamp(1.75rem, 1.18rem + 2.42cqi, 3rem);");
		expect(root).toContain("--ui-marketing-chapter-leading: 1.1;");
		expect(root).toContain("--ui-marketing-lead-leading: 2rem;");
		expect(root).toContain("--ui-marketing-logo-height: 1.75rem;");
		expect(root).toContain("--ui-marketing-logo-height-lg: 2.25rem;");
		expect(root).toContain("--ui-marketing-header-height: 4rem;");
		expect(root).toContain("--ui-marketing-cta-radius: 0.5rem;");
		expect(root).toContain("--ui-marketing-radius-surface: 1rem;");
		expect(root).toContain("--ui-font-display: var(--ui-font-sans);");
	});

	test("draws marketing lines as ink at 6% and raises surfaces to white in light mode", () => {
		let root = block(":root {");

		expect(root).toContain(
			"--ui-marketing-hairline: color-mix(in oklch, var(--ui-neutral-fg-emphasis) 6%, transparent);",
		);
		expect(root).toContain("--ui-surface-raised: white;");
		expect(root).toContain("--ui-shadow-surface:");
		expect(root).toContain("--ui-shadow-stage:");
		expect(root).toContain("--ui-shadow-control:");
	});

	test("swaps every token for a light hairline in both dark blocks", () => {
		for (let opener of ["/* Forced dark mode */", "/* System-preference dark mode */"]) {
			let dark = block(opener);

			expect(dark).toContain("--ui-shadow-ring: 0 0 0 1px rgb(255 255 255 / 0.08);");
			expect(dark).toContain("--ui-shadow-ring-hover: 0 0 0 1px rgb(255 255 255 / 0.12);");
			expect(dark).toContain("--ui-image-outline: rgb(255 255 255 / 0.1);");
		}
	});

	test("declares dark surfaces and hairlines on the root alone, so a band can re-point them", () => {
		for (let opener of [".dark {", "\t.system {"]) {
			let root = block(opener);

			expect(root).toContain(
				"--ui-marketing-hairline: color-mix(in oklch, white 10%, transparent);",
			);
			expect(root).toContain("--ui-surface-raised: color-mix(");
		}
		expect(block("/* Forced dark mode */")).not.toContain("--ui-surface-raised");
	});

	test("draws the ring as a solid strong border under high contrast, in every scheme", () => {
		let contrast = block("@media (prefers-contrast: more)");

		expect(contrast).toContain(":is(.dark, .dark *)");
		expect(contrast).toContain(":is(.system, .system *)");
		expect(contrast).toContain("--ui-shadow-ring: 0 0 0 1px var(--ui-neutral-border-strong);");
		expect(contrast).toContain("--ui-marketing-hairline: var(--ui-neutral-border-strong);");
	});
});
