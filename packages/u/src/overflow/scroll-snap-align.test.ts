/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { scrollSnapAlign } from "./scroll-snap-align";

describe("scrollSnapAlign", () => {
	test("no-arg defaults to start", async () => {
		expect(await declarations(scrollSnapAlign())).toEqual(["scroll-snap-align: start"]);
	});

	test("center", async () => {
		expect(await declarations(scrollSnapAlign("center"))).toEqual(["scroll-snap-align: center"]);
	});

	test("end", async () => {
		expect(await declarations(scrollSnapAlign("end"))).toEqual(["scroll-snap-align: end"]);
	});

	test("none", async () => {
		expect(await declarations(scrollSnapAlign("none"))).toEqual(["scroll-snap-align: none"]);
	});
});
