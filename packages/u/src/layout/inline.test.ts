/**
 * Unit tests for `inline()`'s fixed `display: inline` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { inline } from "./inline";

describe("inline", () => {
	test("sets display: inline", async () => {
		expect(await declarations(inline())).toEqual(["display: inline"]);
	});
});
