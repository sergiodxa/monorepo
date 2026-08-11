/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { cursor } from "./cursor";

describe("cursor", () => {
	test("pointer", async () => {
		expect(await declarations(cursor("pointer"))).toEqual(["cursor: pointer"]);
	});

	test("not-allowed", async () => {
		expect(await declarations(cursor("not-allowed"))).toEqual(["cursor: not-allowed"]);
	});

	test("default", async () => {
		expect(await declarations(cursor("default"))).toEqual(["cursor: default"]);
	});
});
