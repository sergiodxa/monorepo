/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { scrollSnapStop } from "./scroll-snap-stop.js";

describe("scrollSnapStop", () => {
	test("no-arg defaults to always", async () => {
		expect(await declarations(scrollSnapStop())).toEqual(["scroll-snap-stop: always"]);
	});

	test("normal", async () => {
		expect(await declarations(scrollSnapStop("normal"))).toEqual(["scroll-snap-stop: normal"]);
	});
});
