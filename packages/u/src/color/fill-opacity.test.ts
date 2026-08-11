/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { fillOpacity } from "./fill-opacity";

describe("fillOpacity", () => {
	test("converts a 0-100 integer to the CSS 0-1 range", async () => {
		expect(await declarations(fillOpacity(50))).toEqual(["fill-opacity: 0.5"]);
	});

	test("100 converts to the fully opaque 1", async () => {
		expect(await declarations(fillOpacity(100))).toEqual(["fill-opacity: 1"]);
	});

	test("0 converts to the fully transparent 0", async () => {
		expect(await declarations(fillOpacity(0))).toEqual(["fill-opacity: 0"]);
	});

	test("a string passes through unchanged", async () => {
		expect(await declarations(fillOpacity("var(--chart-fill-opacity)"))).toEqual([
			"fill-opacity: var(--chart-fill-opacity)",
		]);
	});

	test("the ratio carries no unit, so the declaration survives the serializer", async () => {
		// Regression: the ratio used to be emitted as a bare number, and the
		// serializer's px-appending turned it into `fill-opacity: 0.5px`, an
		// invalid declaration browsers drop — the shape stayed fully opaque.
		expect(await declarations(fillOpacity(50))).not.toContain("fill-opacity: 0.5px");
	});
});
