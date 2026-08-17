/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { scroll } from "./scroll";

describe("scroll", () => {
	test("no-arg defaults to both axes", async () => {
		expect(await declarations(scroll())).toEqual(["overflow-x: auto", "overflow-y: auto"]);
	});

	test("the x axis", async () => {
		expect(await declarations(scroll("x"))).toEqual(["overflow-x: auto"]);
	});

	test("the y axis", async () => {
		expect(await declarations(scroll("y"))).toEqual(["overflow-y: auto"]);
	});
});
