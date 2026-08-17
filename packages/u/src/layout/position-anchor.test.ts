/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { positionAnchor } from "./position-anchor";

describe("positionAnchor", () => {
	test("prefixes the name with --", async () => {
		expect(await declarations(positionAnchor("tooltip-trigger"))).toEqual([
			"position-anchor: --tooltip-trigger",
		]);
	});

	test("prefixes a single-word name the same way", async () => {
		expect(await declarations(positionAnchor("trigger"))).toEqual(["position-anchor: --trigger"]);
	});
});
