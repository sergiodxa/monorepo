/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { nowrap } from "./nowrap.js";

describe("nowrap", () => {
	test("applies the fixed white-space nowrap declaration", async () => {
		expect(await declarations(nowrap())).toEqual(["white-space: nowrap"]);
	});
});
