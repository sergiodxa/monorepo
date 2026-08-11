/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { fieldSizing } from "./field-sizing";

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
