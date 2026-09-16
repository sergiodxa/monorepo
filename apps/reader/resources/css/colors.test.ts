/**
 * The palette, measured on both sides.
 *
 * `colors.css` documents its ratios on the light side and says nothing about the dark one,
 * where every token points at a different step — so a theme switch measured on one side is
 * half tested. This computes the ratio for each pair the app actually renders, in both
 * schemes, from the values the two stylesheets declare rather than from a number written
 * into a comment.
 *
 * It also pins the one variable the reading face is: nothing in the app branches on the
 * setting, so the whole of that feature is this file declaring the variable twice.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

/** The app's own palette, which is where every `--ui-color-{scale}-{step}` is declared. */
const PALETTE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "colors.css"), "utf8");

/** The mixin layer's theme, which is what decides the step each token points at. */
const THEME = readFileSync(createRequire(import.meta.url).resolve("@sdxc/u/theme.css"), "utf8");

/** What a reader has to be able to read, against the surface every page is painted on. */
const RENDERED_PAIRS = ["neutral-fg-emphasis", "neutral-fg", "brand-fg"] as const;

/** The token every one of those is read against. */
const SURFACE = "neutral-bg-tint";

/** WCAG AA for body text, which is what each pair is held to on both sides. */
const AA_RATIO = 4.5;

/** One palette entry, as `colors.css` declares it. */
function paletteStep(name: string): [number, number, number] {
	let declared = new RegExp(`--ui-color-${name}:\\s*oklch\\(([^)]+)\\)`).exec(PALETTE)?.[1];
	if (declared === undefined) throw new Error(`No palette step named ${name}`);

	let [lightness, chroma, hue] = declared.trim().split(/\s+/).map(Number);
	return [lightness ?? 0, chroma ?? 0, hue ?? 0];
}

/**
 * The block of `theme.css` one scheme's tokens are declared in. The forced class and the
 * system at-rule carry identical declarations, so the class block is the one read: `u`'s own
 * tests are what pin the two halves together.
 */
function themeBlock(scheme: "light" | "dark"): string {
	let start =
		scheme === "light" ? THEME.indexOf(":root {") : THEME.indexOf(":is(.dark, .dark *) {");

	return THEME.slice(start, THEME.indexOf("}", start));
}

/** Which palette step a semantic token points at, in one scheme. */
function stepOf(token: string, scheme: "light" | "dark"): string {
	let block = themeBlock(scheme);
	let declared = new RegExp(`--ui-${token}:\\s*var\\(--ui-color-([\\w-]+)\\)`).exec(block)?.[1];

	if (declared === undefined) throw new Error(`${token} is not declared for ${scheme}`);
	return declared;
}

/** One oklch colour as linear-light sRGB, which is what a luminance is taken over. */
function linearRgb([lightness, chroma, hue]: [number, number, number]): [number, number, number] {
	let radians = (hue * Math.PI) / 180;
	let a = chroma * Math.cos(radians);
	let b = chroma * Math.sin(radians);

	let l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	let m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	let s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	];
}

/** Relative luminance, with each channel clamped into the gamut the screen actually has. */
function luminance(colour: [number, number, number]): number {
	let [red, green, blue] = linearRgb(colour).map((channel) => Math.min(1, Math.max(0, channel)));
	return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}

/** The WCAG ratio between two colours, in either order. */
function contrast(one: [number, number, number], other: [number, number, number]): number {
	let [lighter, darker] = [luminance(one), luminance(other)].sort((a, b) => b - a);
	return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

describe("the palette in both schemes", () => {
	for (let scheme of ["light", "dark"] as const) {
		for (let token of RENDERED_PAIRS) {
			test(`${token} clears AA on ${SURFACE} in ${scheme}`, () => {
				let ratio = contrast(
					paletteStep(stepOf(token, scheme)),
					paletteStep(stepOf(SURFACE, scheme)),
				);

				expect(ratio).toBeGreaterThanOrEqual(AA_RATIO);
			});
		}
	}

	/**
	 * `neutral-fg` is what a read row's title becomes, and a read post is meant to stay
	 * readable rather than merely present — which is why it is in the list above rather than
	 * excused as a quiet colour.
	 */
	test("keeps a read post's title readable on both sides", () => {
		for (let scheme of ["light", "dark"] as const) {
			expect(stepOf("neutral-fg", scheme)).not.toBe(stepOf("neutral-bg-tint", scheme));
		}
	});

	/**
	 * Neither muted token is a text colour, and this is why: each of them falls short of AA
	 * on at least one side. A token that cannot be read in one scheme is not a token to set
	 * words in, whichever scheme it was picked in.
	 */
	test("keeps the muted tokens short of AA on at least one side", () => {
		for (let token of ["neutral-fg-muted", "brand-fg-muted"]) {
			let ratios = (["light", "dark"] as const).map((scheme) =>
				contrast(paletteStep(stepOf(token, scheme)), paletteStep(stepOf(SURFACE, scheme))),
			);

			expect(Math.min(...ratios), `${token} is not a text colour`).toBeLessThan(AA_RATIO);
		}
	});
});

describe("the reading face", () => {
	test("is the sans stack until the reader asks for the other one", () => {
		expect(PALETTE).toContain("--ui-font-reading: var(--ui-font-sans)");
	});

	/**
	 * Written against the element and the attribute rather than `:root`, so it outranks the
	 * same declaration arriving from a stylesheet linked after this one.
	 */
	test("is the serif stack under the attribute the document wears", () => {
		expect(PALETTE).toMatch(
			/html\[data-face="serif"\]\s*\{[^}]*--ui-font-reading:\s*var\(--ui-font-serif\)/,
		);
	});

	/** The chrome is never asked to change, which is what keeps a sidebar out of serif. */
	test("leaves the chrome's own stacks alone", () => {
		expect(PALETTE).not.toMatch(/--ui-font-sans:\s*var\(--ui-font-serif\)/);
		expect(PALETTE).not.toMatch(/html\[data-face="serif"\]\s*\{[^}]*--ui-font-sans:/);
	});
});
