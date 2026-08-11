/**
 * Unit tests for `objectPosition()`'s `object-position` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { objectPosition } from "./object-position";

describe("objectPosition", () => {
	test("defaults to 'center'", async () => {
		expect(await declarations(objectPosition())).toEqual(["object-position: center"]);
	});

	test("applies a keyword value", async () => {
		expect(await declarations(objectPosition("top"))).toEqual(["object-position: top"]);
	});

	test("applies a two-keyword value", async () => {
		expect(await declarations(objectPosition("bottom right"))).toEqual([
			"object-position: bottom right",
		]);
	});

	test("a raw length or percentage pair passes through unchanged", async () => {
		expect(await declarations(objectPosition("50% 20%"))).toEqual(["object-position: 50% 20%"]);
	});
});
