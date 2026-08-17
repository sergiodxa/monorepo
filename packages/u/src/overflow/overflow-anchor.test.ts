/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { overflowAnchor } from "./overflow-anchor";

describe("overflowAnchor", () => {
	test("no-arg defaults to none, opting out of scroll anchoring", async () => {
		expect(await declarations(overflowAnchor())).toEqual(["overflow-anchor: none"]);
	});

	test("auto restores the browser default", async () => {
		expect(await declarations(overflowAnchor("auto"))).toEqual(["overflow-anchor: auto"]);
	});
});
