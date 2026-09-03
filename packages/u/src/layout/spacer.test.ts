/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { spacer } from "./spacer.js";

describe("spacer", () => {
	test("grows and shrinks to fill the available space", async () => {
		expect(await declarations(spacer())).toEqual(["flex: 1 1 auto"]);
	});
});
