/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { hyphens } from "./hyphens.js";

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
