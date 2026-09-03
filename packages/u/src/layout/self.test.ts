/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { self } from "./self.js";

describe("self", () => {
	test("defaults to auto", async () => {
		expect(await declarations(self())).toEqual(["align-self: auto"]);
	});

	test("accepts center", async () => {
		expect(await declarations(self("center"))).toEqual(["align-self: center"]);
	});

	test("accepts stretch", async () => {
		expect(await declarations(self("stretch"))).toEqual(["align-self: stretch"]);
	});
});
