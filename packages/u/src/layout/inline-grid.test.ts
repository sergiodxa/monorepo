/**
 * Unit tests for `inlineGrid()`'s fixed `display: inline-grid` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { inlineGrid } from "./inline-grid";

describe("inlineGrid", () => {
	test("sets display: inline-grid", async () => {
		expect(await declarations(inlineGrid())).toEqual(["display: inline-grid"]);
	});
});
