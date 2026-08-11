/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { strokeLinejoin } from "./stroke-linejoin";

describe("strokeLinejoin", () => {
	test("sets the stroke linejoin", async () => {
		expect(await declarations(strokeLinejoin("round"))).toEqual(["stroke-linejoin: round"]);
	});

	test("accepts bevel", async () => {
		expect(await declarations(strokeLinejoin("bevel"))).toEqual(["stroke-linejoin: bevel"]);
	});

	test("accepts miter", async () => {
		expect(await declarations(strokeLinejoin("miter"))).toEqual(["stroke-linejoin: miter"]);
	});
});
