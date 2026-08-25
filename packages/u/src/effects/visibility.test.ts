/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { visibility } from "./visibility";

describe("visibility", () => {
	test("no-arg defaults to visible", async () => {
		expect(await declarations(visibility())).toEqual(["visibility: visible"]);
	});

	test("accepts hidden", async () => {
		expect(await declarations(visibility("hidden"))).toEqual(["visibility: hidden"]);
	});

	test("accepts collapse", async () => {
		expect(await declarations(visibility("collapse"))).toEqual(["visibility: collapse"]);
	});
});
