/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { COMPOSITE_BACKDROP_FILTER } from "../internal/backdrop-filter.js";
import { compose } from "../internal/descriptor.js";
import { declarations } from "../internal/serialize.js";

import { backdropBlur } from "./backdrop-blur.js";
import { backdropSaturate } from "./backdrop-saturate.js";

describe("backdropSaturate", () => {
	test("no-arg defaults to 1.4", async () => {
		expect(await declarations(backdropSaturate())).toEqual([
			"--ui-backdrop-saturate: 1.4",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});

	test("an explicit numeric factor", async () => {
		expect(await declarations(backdropSaturate(2))).toEqual([
			"--ui-backdrop-saturate: 2",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});

	test("an explicit string factor passes through unchanged", async () => {
		expect(await declarations(backdropSaturate("200%"))).toEqual([
			"--ui-backdrop-saturate: 200%",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
		]);
	});
});

describe("composability with backdropBlur", () => {
	test("composing backdropBlur() and backdropSaturate() together sets both variables under the same composite backdrop-filter", async () => {
		let merged = compose([backdropBlur("lg"), backdropSaturate(1.4)], (styles) => styles);

		expect(await declarations(merged)).toEqual([
			"--ui-backdrop-blur: var(--ui-blur-lg, 24px)",
			`backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			`-webkit-backdrop-filter: ${COMPOSITE_BACKDROP_FILTER}`,
			"--ui-backdrop-saturate: 1.4",
		]);
	});
});
