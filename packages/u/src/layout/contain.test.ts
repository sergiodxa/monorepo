/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { contain } from "./contain";

describe("contain", () => {
	test("defaults to content", async () => {
		expect(await declarations(contain())).toEqual(["contain: content"]);
	});

	test("'none'", async () => {
		expect(await declarations(contain("none"))).toEqual(["contain: none"]);
	});

	test("'strict'", async () => {
		expect(await declarations(contain("strict"))).toEqual(["contain: strict"]);
	});

	test("'size'", async () => {
		expect(await declarations(contain("size"))).toEqual(["contain: size"]);
	});

	test("'inline-size'", async () => {
		expect(await declarations(contain("inline-size"))).toEqual(["contain: inline-size"]);
	});

	test("'layout'", async () => {
		expect(await declarations(contain("layout"))).toEqual(["contain: layout"]);
	});

	test("'style'", async () => {
		expect(await declarations(contain("style"))).toEqual(["contain: style"]);
	});

	test("'paint'", async () => {
		expect(await declarations(contain("paint"))).toEqual(["contain: paint"]);
	});

	test("a space-separated combination passes through unchanged", async () => {
		expect(await declarations(contain("layout paint"))).toEqual(["contain: layout paint"]);
	});

	test("does not reserve an intrinsic size the way virtualize() does", async () => {
		let css = await declarations(contain("strict"));

		expect(css.some((line) => line.startsWith("contain-intrinsic-size:"))).toBe(false);
	});
});
