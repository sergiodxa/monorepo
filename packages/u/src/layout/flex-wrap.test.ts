/**
 * Unit tests for `flexWrap()`'s default and explicit `flex-wrap` values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { flexWrap } from "./flex-wrap.js";

describe("flexWrap", () => {
	test("defaults to wrap", async () => {
		expect(await declarations(flexWrap())).toEqual(["flex-wrap: wrap"]);
	});

	test("accepts wrap explicitly", async () => {
		expect(await declarations(flexWrap("wrap"))).toEqual(["flex-wrap: wrap"]);
	});

	test("accepts nowrap", async () => {
		expect(await declarations(flexWrap("nowrap"))).toEqual(["flex-wrap: nowrap"]);
	});

	test("accepts wrap-reverse", async () => {
		expect(await declarations(flexWrap("wrap-reverse"))).toEqual(["flex-wrap: wrap-reverse"]);
	});
});
