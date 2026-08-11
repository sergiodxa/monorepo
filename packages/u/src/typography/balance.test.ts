/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { balance } from "./balance";

describe("balance", () => {
	test("applies the balance text-wrap declaration", async () => {
		expect(await declarations(balance())).toEqual(["text-wrap: balance"]);
	});
});
