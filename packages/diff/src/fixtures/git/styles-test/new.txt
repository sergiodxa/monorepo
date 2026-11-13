/**
 * Tests the stylesheet's default palette against WCAG: every colour a token type paints
 * with reads at 4.5:1 or more on the light and dark backgrounds the palette is drawn for,
 * so code set in the defaults stays legible as body-size text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

const STYLES = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

/** The code-block fills the light and dark defaults follow, darker than the page in light. */
const BACKGROUNDS = { light: "#f6f8fa", dark: "#161b22" };

/** The body-text contrast WCAG AA asks of text under 18pt. */
const MINIMUM_CONTRAST = 4.5;

/**
 * The `[light, dark]` hex pair each property declares through `light-dark()`. A property
 * that points at another one through `var()` inherits that pair's contrast and is skipped.
 */
function declaredPairs(styles: string): Map<string, readonly [string, string]> {
	let pairs = new Map<string, readonly [string, string]>();
	for (let match of styles.matchAll(
		/(--highlight-[\w-]+):\s*light-dark\((#[\da-f]{6}),\s*(#[\da-f]{6})\);/gi,
	)) {
		pairs.set(match[1]!, [match[2]!, match[3]!]);
	}
	return pairs;
}

/** WCAG relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
	let channels = [1, 3, 5].map((start) => {
		let value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
		return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

/** WCAG contrast ratio between two `#rrggbb` colours. */
function contrast(a: string, b: string): number {
	let [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (high! + 0.05) / (low! + 0.05);
}

let PAIRS = [...declaredPairs(STYLES)];

describe("styles.css", () => {
	test("declares every palette colour as a light-dark() pair", () => {
		expect(PAIRS.map(([property]) => property)).toEqual(
			expect.arrayContaining(["--highlight-text", "--highlight-string", "--highlight-deleted"]),
		);
		expect(STYLES).not.toMatch(/--highlight-[\w-]+:\s*#/);
	});

	test("switches palettes by color-scheme rather than the system preference", () => {
		expect(STYLES).not.toContain("prefers-color-scheme");
	});

	test.each(PAIRS)("paints %s at 4.5:1 or more on a light page", (_property, [colour]) => {
		expect(contrast(colour, BACKGROUNDS.light)).toBeGreaterThanOrEqual(MINIMUM_CONTRAST);
	});

	test.each(PAIRS)("paints %s at 4.5:1 or more on a dark page", (_property, [, colour]) => {
		expect(contrast(colour, BACKGROUNDS.dark)).toBeGreaterThanOrEqual(MINIMUM_CONTRAST);
	});
});
