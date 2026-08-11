/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { strokeLinecap } from "./stroke-linecap";

describe("strokeLinecap", () => {
	test("sets the stroke linecap", async () => {
		expect(await declarations(strokeLinecap("round"))).toEqual(["stroke-linecap: round"]);
	});

	test("accepts butt", async () => {
		expect(await declarations(strokeLinecap("butt"))).toEqual(["stroke-linecap: butt"]);
	});

	test("accepts square", async () => {
		expect(await declarations(strokeLinecap("square"))).toEqual(["stroke-linecap: square"]);
	});
});
