/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { z } from "./z";

describe("z", () => {
	test("sets zIndex from a plain number", async () => {
		expect(await declarations(z(10))).toEqual(["z-index: 10"]);
	});

	test("a different numeric value", async () => {
		expect(await declarations(z(0))).toEqual(["z-index: 0"]);
	});

	test("the count keeps no unit, since z-index is unitless", async () => {
		// `z-index` is one of the properties the CSS serializer knows is
		// unitless; a number on a property outside that allow-list would come
		// out as `10px`, which browsers drop.
		expect(await declarations(z(10))).not.toContain("z-index: 10px");
	});
});
