/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { pointerEvents } from "./pointer-events.js";

describe("pointerEvents", () => {
	test("no-arg defaults to 'none'", async () => {
		expect(await declarations(pointerEvents())).toEqual(["pointer-events: none"]);
	});

	test("an explicit value", async () => {
		expect(await declarations(pointerEvents("auto"))).toEqual(["pointer-events: auto"]);
	});
});
