/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { borderCollapse } from "./border-collapse";

describe("borderCollapse", () => {
	test("no-arg defaults to 'collapse'", async () => {
		expect(await declarations(borderCollapse())).toEqual(["border-collapse: collapse"]);
	});

	test("an explicit value", async () => {
		expect(await declarations(borderCollapse("separate"))).toEqual(["border-collapse: separate"]);
	});
});
