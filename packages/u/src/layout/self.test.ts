/**
 * Unit tests for `self()`'s default and explicit `align-self` values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { self } from "./self";

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
