/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { COMPOSITE_BACKDROP_FILTER } from "../internal/backdrop-filter.js";
import { declarations, serialize } from "../internal/serialize.js";

import { backdropBlur } from "./backdrop-blur.js";

describe("backdropBlur", () => {
	test("no-arg defaults to the md blur, set on the --ui-backdrop-blur variable behind the composite backdrop-filter", async () => {
		expect(await declarations(backdropBlur())).toEqual([
			"--ui-backdrop-blur: var(--ui-blur-md, 12px)",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});

	test("an explicit named blur", async () => {
		expect(await declarations(backdropBlur("lg"))).toEqual([
			"--ui-backdrop-blur: var(--ui-blur-lg, 24px)",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});

	test("applies unconditionally, with no prefers-reduced-transparency gating", async () => {
		expect(await serialize(backdropBlur("sm"))).not.toContain("prefers-reduced-transparency");
		expect(await declarations(backdropBlur("sm"))).toEqual([
			"--ui-backdrop-blur: var(--ui-blur-sm, 4px)",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});
});
