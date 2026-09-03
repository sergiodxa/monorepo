/**
 * Unit tests for `inlineGrid()`'s fixed `display: inline-grid` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { inlineGrid } from "./inline-grid.js";

describe("inlineGrid", () => {
	test("sets display: inline-grid", async () => {
		expect(await declarations(inlineGrid())).toEqual(["display: inline-grid"]);
	});
});
