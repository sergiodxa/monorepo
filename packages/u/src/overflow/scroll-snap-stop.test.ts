/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { scrollSnapStop } from "./scroll-snap-stop";

describe("scrollSnapStop", () => {
	test("no-arg defaults to always", async () => {
		expect(await declarations(scrollSnapStop())).toEqual(["scroll-snap-stop: always"]);
	});

	test("normal", async () => {
		expect(await declarations(scrollSnapStop("normal"))).toEqual(["scroll-snap-stop: normal"]);
	});
});
