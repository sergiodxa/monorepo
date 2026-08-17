/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { COMPOSITE_FILTER } from "../internal/filter";
import { declarations } from "../internal/serialize";

import { dropShadow } from "./drop-shadow";

describe("dropShadow", () => {
	test("no-arg resolves the default offsets off the spacing scale and a translucent black", async () => {
		expect(await declarations(dropShadow())).toEqual([
			"--ui-filter-drop-shadow: calc(var(--ui-spacing, 0.25rem) * 0) calc(var(--ui-spacing, 0.25rem) * 1) calc(var(--ui-spacing, 0.25rem) * 2) rgb(0 0 0 / 0.15)",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("raw CSS lengths pass through unchanged", async () => {
		expect(await declarations(dropShadow({ x: "1px", y: "2px", blur: "4px" }))).toEqual([
			"--ui-filter-drop-shadow: 1px 2px 4px rgb(0 0 0 / 0.15)",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("a bare tone color resolves against the border property", async () => {
		expect(await declarations(dropShadow({ x: "0", y: "0", blur: "0", color: "brand" }))).toEqual([
			"--ui-filter-drop-shadow: 0 0 0 var(--ui-brand-border)",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("an explicit color property is honored", async () => {
		expect(
			await declarations(dropShadow({ x: "0", y: "1px", blur: "2px", color: "brand.solid" })),
		).toEqual([
			"--ui-filter-drop-shadow: 0 1px 2px var(--ui-brand-bg-solid)",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});
});
