/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { COMPOSITE_BACKDROP_FILTER } from "../internal/backdrop-filter.js";
import { declarations, serialize } from "../internal/serialize.js";

import { translucent } from "./translucent.js";

describe("translucent", () => {
	test("defaults to the md blur", async () => {
		expect(await serialize(translucent())).toContain(
			"@media (prefers-reduced-transparency: no-preference)",
		);
		expect(await declarations(translucent())).toEqual([
			"background-color: var(--ui-bg, Canvas)",
			"background-color: color-mix(in oklab, var(--ui-bg, Canvas) 70%, transparent)",
			"--ui-backdrop-blur: var(--ui-blur-md, 12px)",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});

	test("the background is see-through only where the blur applies", async () => {
		let css = await serialize(translucent());
		let gate = css.indexOf("@media (prefers-reduced-transparency: no-preference)");
		expect(css.indexOf("background-color: var(--ui-bg, Canvas)")).toBeLessThan(gate);
		expect(
			css.indexOf("color-mix(in oklab, var(--ui-bg, Canvas) 70%, transparent)"),
		).toBeGreaterThan(gate);
	});

	test("an explicit sm blur", async () => {
		expect(await serialize(translucent("sm"))).toContain(
			"@media (prefers-reduced-transparency: no-preference)",
		);
		expect(await declarations(translucent("sm"))).toEqual([
			"background-color: var(--ui-bg, Canvas)",
			"background-color: color-mix(in oklab, var(--ui-bg, Canvas) 70%, transparent)",
			"--ui-backdrop-blur: var(--ui-blur-sm, 4px)",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});
});
