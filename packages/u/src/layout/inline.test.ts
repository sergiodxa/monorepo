/**
 * Unit tests for `inline()`'s fixed `display: inline` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { inline } from "./inline.js";

describe("inline", () => {
	test("sets display: inline", async () => {
		expect(await declarations(inline())).toEqual(["display: inline"]);
	});
});
