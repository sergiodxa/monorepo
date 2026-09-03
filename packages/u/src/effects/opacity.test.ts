/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { opacity } from "./opacity.js";

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
		expect(await declarations(opacity(50))).not.toContain("opacity: 0.5px");
	});
});
