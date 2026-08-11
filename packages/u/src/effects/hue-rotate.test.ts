/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { compose } from "../internal/descriptor";
import { COMPOSITE_FILTER } from "../internal/filter";
import { declarations } from "../internal/serialize";

import { blur } from "./blur";
import { filterOpacity } from "./filter-opacity";
import { hueRotate } from "./hue-rotate";

describe("hueRotate", () => {
	test("no-arg defaults to 90deg", async () => {
		expect(await declarations(hueRotate())).toEqual([
			"--ui-filter-hue-rotate: 90deg",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("a bare number is treated as degrees", async () => {
		expect(await declarations(hueRotate(180))).toEqual([
			"--ui-filter-hue-rotate: 180deg",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("a negative number rotates the other way", async () => {
		expect(await declarations(hueRotate(-45))).toEqual([
			"--ui-filter-hue-rotate: -45deg",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});

	test("a raw angle string passes through unchanged", async () => {
		expect(await declarations(hueRotate("0.5turn"))).toEqual([
			"--ui-filter-hue-rotate: 0.5turn",
			`filter: ${COMPOSITE_FILTER}`,
		]);
	});
});

describe("composability with other filter utilities", () => {
	test("composing hueRotate(), filterOpacity(), and blur() together sets all three variables under one composite filter", async () => {
		let merged = compose([hueRotate(), filterOpacity(), blur("lg")], (styles) => styles);

		expect(await declarations(merged)).toEqual([
			"--ui-filter-hue-rotate: 90deg",
			`filter: ${COMPOSITE_FILTER}`,
			"--ui-filter-opacity: 0.5",
			"--ui-filter-blur: var(--ui-blur-lg, 24px)",
		]);
	});
});
