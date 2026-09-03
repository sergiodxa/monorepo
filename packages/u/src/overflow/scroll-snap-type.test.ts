/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { scrollSnapType } from "./scroll-snap-type.js";

describe("scrollSnapType", () => {
	test("no-arg defaults to inline mandatory", async () => {
		expect(await declarations(scrollSnapType())).toEqual(["scroll-snap-type: inline mandatory"]);
	});

	test("an explicit logical axis", async () => {
		expect(await declarations(scrollSnapType("block"))).toEqual([
			"scroll-snap-type: block mandatory",
		]);
	});

	test("an explicit strictness", async () => {
		expect(await declarations(scrollSnapType("inline", "proximity"))).toEqual([
			"scroll-snap-type: inline proximity",
		]);
	});

	test("the both axis", async () => {
		expect(await declarations(scrollSnapType("both", "proximity"))).toEqual([
			"scroll-snap-type: both proximity",
		]);
	});

	test("the physical axes", async () => {
		expect(await declarations(scrollSnapType("x"))).toEqual(["scroll-snap-type: x mandatory"]);
		expect(await declarations(scrollSnapType("y"))).toEqual(["scroll-snap-type: y mandatory"]);
	});

	test("the none axis drops the strictness segment", async () => {
		expect(await declarations(scrollSnapType("none"))).toEqual(["scroll-snap-type: none"]);
	});

	test("the none axis ignores an explicit strictness", async () => {
		expect(await declarations(scrollSnapType("none", "proximity"))).toEqual([
			"scroll-snap-type: none",
		]);
	});
});
