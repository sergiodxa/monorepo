/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { gridArea } from "./grid-area.js";

describe("gridArea", () => {
	test("applies the named grid area", async () => {
		expect(await declarations(gridArea("header"))).toEqual(["grid-area: header"]);
	});
});
