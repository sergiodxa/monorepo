/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { grow } from "./grow.js";

describe("grow", () => {
	test("no-arg defaults to 1", async () => {
		expect(await declarations(grow())).toEqual(["flex-grow: 1"]);
	});

	test("an explicit number", async () => {
		expect(await declarations(grow(0))).toEqual(["flex-grow: 0"]);
	});
});
