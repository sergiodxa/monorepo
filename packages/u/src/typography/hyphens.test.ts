/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { hyphens } from "./hyphens";

describe("hyphens", () => {
	test("no-arg defaults to auto", async () => {
		expect(await declarations(hyphens())).toEqual(["hyphens: auto"]);
	});

	test("none", async () => {
		expect(await declarations(hyphens("none"))).toEqual(["hyphens: none"]);
	});

	test("manual", async () => {
		expect(await declarations(hyphens("manual"))).toEqual(["hyphens: manual"]);
	});

	test("auto", async () => {
		expect(await declarations(hyphens("auto"))).toEqual(["hyphens: auto"]);
	});
});
