/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { overflowY } from "./overflow-y.js";

describe("overflowY", () => {
	test("defaults to hidden", async () => {
		expect(await declarations(overflowY())).toEqual(["overflow-y: hidden"]);
	});

	test("accepts an explicit value", async () => {
		expect(await declarations(overflowY("auto"))).toEqual(["overflow-y: auto"]);
	});
});
