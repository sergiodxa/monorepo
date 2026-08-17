/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { scrollbarGutter } from "./scrollbar-gutter";

describe("scrollbarGutter", () => {
	test("no-arg defaults to stable", async () => {
		expect(await declarations(scrollbarGutter())).toEqual(["scrollbar-gutter: stable"]);
	});

	test("stable both-edges", async () => {
		expect(await declarations(scrollbarGutter("stable both-edges"))).toEqual([
			"scrollbar-gutter: stable both-edges",
		]);
	});

	test("auto", async () => {
		expect(await declarations(scrollbarGutter("auto"))).toEqual(["scrollbar-gutter: auto"]);
	});
});
