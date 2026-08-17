/**
 * Unit tests for `items()`'s default and explicit `align-items` values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { items } from "./items";

describe("items", () => {
	test("defaults to stretch", async () => {
		expect(await declarations(items())).toEqual(["align-items: stretch"]);
	});

	test("accepts center", async () => {
		expect(await declarations(items("center"))).toEqual(["align-items: center"]);
	});

	test("accepts baseline", async () => {
		expect(await declarations(items("baseline"))).toEqual(["align-items: baseline"]);
	});
});
