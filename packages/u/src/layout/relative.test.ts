/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { relative } from "./relative.js";

describe("relative", () => {
	test("sets position: relative", async () => {
		expect(await declarations(relative())).toEqual(["position: relative"]);
	});
});
