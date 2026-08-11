/**
 * Unit tests for `transformOrigin()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { transformOrigin } from "./transform-origin";

describe("transformOrigin", () => {
	test("defaults to center", async () => {
		expect(await declarations(transformOrigin())).toEqual(["transform-origin: center"]);
	});

	test("accepts a single edge keyword", async () => {
		expect(await declarations(transformOrigin("left"))).toEqual(["transform-origin: left"]);
	});

	test("accepts a two-keyword corner", async () => {
		expect(await declarations(transformOrigin("bottom right"))).toEqual([
			"transform-origin: bottom right",
		]);
	});

	test("passes a percentage pair through unchanged", async () => {
		expect(await declarations(transformOrigin("25% 75%"))).toEqual(["transform-origin: 25% 75%"]);
	});

	test("passes the three-value 3D form through unchanged", async () => {
		expect(await declarations(transformOrigin("50% 50% 8px"))).toEqual([
			"transform-origin: 50% 50% 8px",
		]);
	});

	test("passes a custom property reference through unchanged", async () => {
		expect(await declarations(transformOrigin("var(--ui-origin)"))).toEqual([
			"transform-origin: var(--ui-origin)",
		]);
	});
});
