/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { willChange } from "./will-change";

describe("willChange", () => {
	test("a single property", async () => {
		expect(await declarations(willChange("transform"))).toEqual(["will-change: transform"]);
	});
});
