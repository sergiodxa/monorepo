/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { vectorEffect } from "./vector-effect";

describe("vectorEffect", () => {
	test("sets the vector effect", async () => {
		expect(await declarations(vectorEffect("non-scaling-stroke"))).toEqual([
			"vector-effect: non-scaling-stroke",
		]);
	});

	test("accepts none", async () => {
		expect(await declarations(vectorEffect("none"))).toEqual(["vector-effect: none"]);
	});

	test("accepts non-scaling-size", async () => {
		expect(await declarations(vectorEffect("non-scaling-size"))).toEqual([
			"vector-effect: non-scaling-size",
		]);
	});

	test("accepts non-rotation", async () => {
		expect(await declarations(vectorEffect("non-rotation"))).toEqual([
			"vector-effect: non-rotation",
		]);
	});

	test("accepts fixed-position", async () => {
		expect(await declarations(vectorEffect("fixed-position"))).toEqual([
			"vector-effect: fixed-position",
		]);
	});
});
