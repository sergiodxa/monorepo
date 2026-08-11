/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { opacity } from "./opacity";

describe("opacity", () => {
	test("converts a 0-100 integer to the CSS 0-1 range", async () => {
		expect(await declarations(opacity(50))).toEqual(["opacity: 0.5"]);
	});

	test("100 converts to the fully opaque 1", async () => {
		expect(await declarations(opacity(100))).toEqual(["opacity: 1"]);
	});

	test("0 converts to the fully transparent 0", async () => {
		expect(await declarations(opacity(0))).toEqual(["opacity: 0"]);
	});

	test("the ratio carries no unit, so the declaration survives the serializer", async () => {
		// `opacity` is one of the properties the serializer leaves unitless; a
		// bare `0.5` on a property outside that list would come out as `0.5px`,
		// which browsers drop.
		expect(await declarations(opacity(50))).not.toContain("opacity: 0.5px");
	});
});
