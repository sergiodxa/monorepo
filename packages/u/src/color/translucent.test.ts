/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { COMPOSITE_BACKDROP_FILTER } from "../internal/backdrop-filter";
import { declarations, serialize } from "../internal/serialize";

import { translucent } from "./translucent";

describe("translucent", () => {
	test("defaults to the md blur", async () => {
		expect(await serialize(translucent())).toContain(
			"@media (prefers-reduced-transparency: no-preference)",
		);
		expect(await declarations(translucent())).toEqual([
			"background-color: var(--ui-bg, Canvas)",
			"--ui-backdrop-blur: var(--ui-blur-md, 12px)",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});

	test("an explicit sm blur", async () => {
		expect(await serialize(translucent("sm"))).toContain(
			"@media (prefers-reduced-transparency: no-preference)",
		);
		expect(await declarations(translucent("sm"))).toEqual([
			"background-color: var(--ui-bg, Canvas)",
			"--ui-backdrop-blur: var(--ui-blur-sm, 4px)",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});
});
