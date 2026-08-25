/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { lineClamp } from "./line-clamp";

describe("lineClamp", () => {
	test("a numeric line count applies the -webkit-line-clamp trick", async () => {
		expect(await declarations(lineClamp(3))).toEqual([
			"display: -webkit-box",
			"-webkit-box-orient: vertical",
			"-webkit-line-clamp: 3",
			"overflow: hidden",
		]);
	});

	test("the line count keeps no unit, so the declaration survives the serializer", async () => {
		expect(await declarations(lineClamp(2))).toContain("-webkit-line-clamp: 2");
		expect(await declarations(lineClamp(2))).not.toContain("-webkit-line-clamp: 2px");
	});

	test("the vendor prefix keeps its leading dash, which a camelCase key would lose", async () => {
		let css = await declarations(lineClamp(2));

		expect(css.filter((line) => line.startsWith("-webkit"))).toEqual([
			"-webkit-box-orient: vertical",
			"-webkit-line-clamp: 2",
		]);
	});
});
