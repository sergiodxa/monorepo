/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { fieldSizing } from "./field-sizing.js";

describe("fieldSizing", () => {
	test("defaults to content", async () => {
		expect(await declarations(fieldSizing())).toEqual(["field-sizing: content"]);
	});

	test("'content'", async () => {
		expect(await declarations(fieldSizing("content"))).toEqual(["field-sizing: content"]);
	});

	test("'fixed'", async () => {
		expect(await declarations(fieldSizing("fixed"))).toEqual(["field-sizing: fixed"]);
	});
});
