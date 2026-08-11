/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { grow } from "./grow";

describe("grow", () => {
	test("no-arg defaults to 1", async () => {
		expect(await declarations(grow())).toEqual(["flex-grow: 1"]);
	});

	test("an explicit number", async () => {
		expect(await declarations(grow(0))).toEqual(["flex-grow: 0"]);
	});
});
