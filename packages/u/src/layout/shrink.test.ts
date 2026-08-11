/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { shrink } from "./shrink";

describe("shrink", () => {
	test("no-arg defaults to 0", async () => {
		expect(await declarations(shrink())).toEqual(["flex-shrink: 0"]);
	});

	test("an explicit number", async () => {
		expect(await declarations(shrink(1))).toEqual(["flex-shrink: 1"]);
	});
});
