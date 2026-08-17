/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { compose } from "../internal/descriptor";
import { COMPOSITE_FILTER } from "../internal/filter";
import { declarations } from "../internal/serialize";

import { blur } from "./blur";
import { grayscale } from "./grayscale";

describe("blur", () => {
	test("no-arg defaults to the md blur, written to the composite's blur variable", async () => {
		expect(await declarations(blur())).toEqual([
			"--ui-filter-blur: var(--ui-blur-md, 12px)",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("an explicit named blur", async () => {
		expect(await declarations(blur("lg"))).toEqual([
			"--ui-filter-blur: var(--ui-blur-lg, 24px)",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("a raw CSS length passes through unchanged", async () => {
		expect(await declarations(blur("8px"))).toEqual([
			"--ui-filter-blur: 8px",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});
});

describe("composability with other filter utilities", () => {
	test("composing blur() and grayscale() together sets both variables under the same composite filter", async () => {
		let merged = compose([blur("lg"), grayscale()], (styles) => styles);

		expect(await declarations(merged)).toEqual([
			"--ui-filter-blur: var(--ui-blur-lg, 24px)",
			`filter: ${COMPOSITE_FILTER}`,
			"--ui-filter-grayscale: 1",
		]);
	});
});
