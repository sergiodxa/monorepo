/**
 * Unit tests for `overflowY()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { overflowY } from "./overflow-y";

describe("overflowY", () => {
	test("defaults to hidden", async () => {
		expect(await declarations(overflowY())).toEqual(["overflow-y: hidden"]);
	});

	test("accepts an explicit value", async () => {
		expect(await declarations(overflowY("auto"))).toEqual(["overflow-y: auto"]);
	});
});
