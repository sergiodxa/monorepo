/**
 * Coverage for `hexToOklch` (color conversion + malformed-input fallback) and
 * `renderThemeStyle` (the `:root` block it emits, including engine defaults).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { hexToOklch, renderThemeStyle } from "./theme.js";

describe("hexToOklch", () => {
	test("white is near lightness 1, chroma ~0", () => {
		let { l, c } = hexToOklch("#ffffff");
		expect(l).toBeGreaterThan(0.99);
		expect(c).toBeLessThan(0.01);
	});

	test("black is near lightness 0", () => {
		let { l } = hexToOklch("#000000");
		expect(l).toBeLessThan(0.01);
	});

	test("expands 3-digit hex and tolerates bad input", () => {
		let short = hexToOklch("#fff");
		expect(short.l).toBeGreaterThan(0.99);
		let bad = hexToOklch("nonsense");
		expect(bad).toEqual({ l: 0.5, c: 0, h: 0 });
	});
});

describe("renderThemeStyle", () => {
	test("emits a :root block with theme and semantic tokens", () => {
		let css = renderThemeStyle({ accent: "#2563eb" });
		expect(css.startsWith(":root {")).toBe(true);
		expect(css).toContain("--blog-accent:");
		expect(css).toContain("--blog-radius:");
		expect(css).toContain("--color-accent-500:");
		expect(css).toContain("--ui-accent:");
		expect(css).toContain("oklch(");
	});

	test("applies engine defaults when knobs are missing", () => {
		let css = renderThemeStyle(undefined);
		expect(css).toContain("--blog-spacing: 1rem");
		expect(css).toContain("--blog-measure: 65ch");
	});
});
