/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { resize } from "./resize";

describe("resize", () => {
	test("defaults to the logical block axis", async () => {
		expect(await declarations(resize())).toEqual(["resize: block"]);
	});

	test("'none'", async () => {
		expect(await declarations(resize("none"))).toEqual(["resize: none"]);
	});

	test("'both'", async () => {
		expect(await declarations(resize("both"))).toEqual(["resize: both"]);
	});

	test("'horizontal'", async () => {
		expect(await declarations(resize("horizontal"))).toEqual(["resize: horizontal"]);
	});

	test("'block'", async () => {
		expect(await declarations(resize("block"))).toEqual(["resize: block"]);
	});

	test("'inline'", async () => {
		expect(await declarations(resize("inline"))).toEqual(["resize: inline"]);
	});
});
