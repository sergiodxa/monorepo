/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { overflow } from "./overflow.js";

describe("overflow", () => {
	test("no-arg defaults to hidden", async () => {
		expect(await declarations(overflow())).toEqual(["overflow: hidden"]);
	});

	test("an explicit keyword form", async () => {
		expect(await declarations(overflow("auto"))).toEqual(["overflow: auto"]);
	});

	test("the axis-object overload sets overflow-x and overflow-y independently", async () => {
		expect(await declarations(overflow({ x: "hidden", y: "auto" }))).toEqual([
			"overflow-x: hidden",
			"overflow-y: auto",
		]);
	});

	test("the axis-object overload with only x given leaves y untouched", async () => {
		expect(await declarations(overflow({ x: "hidden" }))).toEqual(["overflow-x: hidden"]);
	});

	test("the axis-object overload with only y given leaves x untouched", async () => {
		expect(await declarations(overflow({ y: "auto" }))).toEqual(["overflow-y: auto"]);
	});

	test("the axis-object overload sets overflow-inline and overflow-block independently", async () => {
		expect(await declarations(overflow({ inline: "hidden", block: "auto" }))).toEqual([
			"overflow-inline: hidden",
			"overflow-block: auto",
		]);
	});

	test("the axis-object overload with only inline given leaves block untouched", async () => {
		expect(await declarations(overflow({ inline: "hidden" }))).toEqual(["overflow-inline: hidden"]);
	});

	test("the axis-object overload with only block given leaves inline untouched", async () => {
		expect(await declarations(overflow({ block: "auto" }))).toEqual(["overflow-block: auto"]);
	});
});
