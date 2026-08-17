/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { layer } from "./layer";

describe("layer", () => {
	test("merges isolate and z into one stacking-context-plus-order declaration", async () => {
		expect(await declarations(layer(10))).toEqual(["isolation: isolate", "z-index: 10"]);
	});
});
