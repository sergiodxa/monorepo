/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { willChange } from "./will-change.js";

describe("willChange", () => {
	test("a single property", async () => {
		expect(await declarations(willChange("transform"))).toEqual(["will-change: transform"]);
	});
});
