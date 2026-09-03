/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { shrink } from "./shrink.js";

describe("shrink", () => {
	test("no-arg defaults to 0", async () => {
		expect(await declarations(shrink())).toEqual(["flex-shrink: 0"]);
	});

	test("an explicit number", async () => {
		expect(await declarations(shrink(1))).toEqual(["flex-shrink: 1"]);
	});
});
