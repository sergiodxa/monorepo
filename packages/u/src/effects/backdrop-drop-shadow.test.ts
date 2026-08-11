/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { COMPOSITE_BACKDROP_FILTER } from "../internal/backdrop-filter";
import { declarations } from "../internal/serialize";

import { backdropDropShadow } from "./backdrop-drop-shadow";

describe("backdropDropShadow", () => {
	test("no-arg defaults resolve through the spacing scale and a literal color", async () => {
		expect(await declarations(backdropDropShadow())).toEqual([
			"--ui-backdrop-drop-shadow: calc(var(--ui-spacing, 0.25rem) * 0) calc(var(--ui-spacing, 0.25rem) * 1) calc(var(--ui-spacing, 0.25rem) * 2) rgb(0 0 0 / 0.15)",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});

	test("raw lengths pass through and a bare tone resolves through the token layer", async () => {
		expect(
			await declarations(backdropDropShadow({ x: "1px", y: "2px", blur: "4px", color: "brand" })),
		).toEqual([
			"--ui-backdrop-drop-shadow: 1px 2px 4px var(--ui-brand-border)",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});

	test("the emitted composite carries a drop-shadow slot", async () => {
		let css = await declarations(backdropDropShadow());

		expect(css.join("\n")).toContain(
			"drop-shadow(var(--ui-backdrop-drop-shadow, 0 0 0 transparent))",
		);
	});
});
