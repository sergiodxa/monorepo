/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { gridArea } from "./grid-area";

describe("gridArea", () => {
	test("applies the named grid area", async () => {
		expect(await declarations(gridArea("header"))).toEqual(["grid-area: header"]);
	});
});
