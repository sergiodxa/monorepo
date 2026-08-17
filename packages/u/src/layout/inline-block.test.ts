/**
 * Unit tests for `inlineBlock()`'s fixed `display: inline-block` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { inlineBlock } from "./inline-block";

describe("inlineBlock", () => {
	test("sets display: inline-block", async () => {
		expect(await declarations(inlineBlock())).toEqual(["display: inline-block"]);
	});
});
