/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { balance } from "./balance.js";

describe("balance", () => {
	test("applies the balance text-wrap declaration", async () => {
		expect(await declarations(balance())).toEqual(["text-wrap: balance"]);
	});
});
