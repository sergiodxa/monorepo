/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { weight } from "./weight.js";

describe("weight", () => {
	test("every named alias resolves its numeric weight", async () => {
		expect(await declarations(weight("thin"))).toEqual(["font-weight: 100"]);
		expect(await declarations(weight("extralight"))).toEqual(["font-weight: 200"]);
		expect(await declarations(weight("light"))).toEqual(["font-weight: 300"]);
		expect(await declarations(weight("normal"))).toEqual(["font-weight: 400"]);
		expect(await declarations(weight("medium"))).toEqual(["font-weight: 500"]);
		expect(await declarations(weight("semibold"))).toEqual(["font-weight: 600"]);
		expect(await declarations(weight("bold"))).toEqual(["font-weight: 700"]);
		expect(await declarations(weight("extrabold"))).toEqual(["font-weight: 800"]);
		expect(await declarations(weight("black"))).toEqual(["font-weight: 900"]);
	});

	test("a raw number passes through unchanged", async () => {
		expect(await declarations(weight(550))).toEqual(["font-weight: 550"]);
	});

	test("no-arg defaults to normal", async () => {
		expect(await declarations(weight())).toEqual(["font-weight: 400"]);
	});

	test("the weight keeps no unit, so the declaration survives the serializer", async () => {
		expect(await declarations(weight("bold"))).not.toContain("font-weight: 700px");
	});
});
