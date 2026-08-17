/**
 * Unit tests for `inlineFlex()`'s fixed `display: inline-flex` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { inlineFlex } from "./inline-flex";

describe("inlineFlex", () => {
	test("sets display: inline-flex", async () => {
		expect(await declarations(inlineFlex())).toEqual(["display: inline-flex"]);
	});
});
