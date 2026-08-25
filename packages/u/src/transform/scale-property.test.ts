/**
 * Unit tests for `scaleProperty()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { scaleProperty } from "./scale-property";

describe("scaleProperty", () => {
	test("passes a raw string value through unchanged", async () => {
		expect(await declarations(scaleProperty("1"))).toEqual(["scale: 1"]);
	});

	test("passes the none keyword through unchanged", async () => {
		expect(await declarations(scaleProperty("none"))).toEqual(["scale: none"]);
	});

	test("passes a fractional string value through unchanged", async () => {
		expect(await declarations(scaleProperty("0.95"))).toEqual(["scale: 0.95"]);
	});

	test("passes another fractional string value through unchanged", async () => {
		expect(await declarations(scaleProperty("0.98"))).toEqual(["scale: 0.98"]);
	});

	/**
	 * `scale` accepts a unitless number, so converting it to a string before
	 * serializing produces `0.95`, which browsers apply directly to scale the
	 * element.
	 */
	test("stringifies a bare number", async () => {
		expect(await declarations(scaleProperty(0.95))).toEqual(["scale: 0.95"]);
	});
});
