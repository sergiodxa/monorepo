/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { positionArea } from "./position-area";

describe("positionArea", () => {
	test("sets a two-keyword area", async () => {
		expect(await declarations(positionArea("top left"))).toEqual(["position-area: top left"]);
	});

	test("sets a span keyword combination", async () => {
		expect(await declarations(positionArea("bottom span-right"))).toEqual([
			"position-area: bottom span-right",
		]);
	});
});
