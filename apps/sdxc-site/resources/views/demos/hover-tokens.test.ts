/**
 * Guards the hover fills the demo landings name. A colour path naming a variable the theme
 * never defines resolves to transparent, so a hovered row or tile loses its fill instead of
 * deepening it; the theme spells its hover tints `<scale>.bg-tint-hover`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

/** Every demo source file, read as text. */
const SOURCES = import.meta.glob<string>("./**/*.tsx", {
	eager: true,
	query: "?raw",
	import: "default",
});

describe("demo hover fills", () => {
	test("name the theme's bg-tint-hover variables", () => {
		let offenders = Object.entries(SOURCES)
			.filter(([, source]) => /"[a-z]+\.tint-hover"/.test(source))
			.map(([path]) => path);

		expect(Object.keys(SOURCES).length).toBeGreaterThan(0);
		expect(offenders).toEqual([]);
	});
});
