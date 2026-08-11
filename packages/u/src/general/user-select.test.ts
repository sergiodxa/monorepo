/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { userSelect } from "./user-select";

describe("userSelect", () => {
	test("no-arg defaults to 'none'", async () => {
		expect(await declarations(userSelect())).toEqual(["user-select: none"]);
	});

	test("an explicit value", async () => {
		expect(await declarations(userSelect("text"))).toEqual(["user-select: text"]);
	});
});
