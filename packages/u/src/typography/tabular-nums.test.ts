/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { tabularNums } from "./tabular-nums";

describe("tabularNums", () => {
	test("applies the fixed font-variant-numeric declaration", async () => {
		expect(await declarations(tabularNums())).toEqual(["font-variant-numeric: tabular-nums"]);
	});
});
