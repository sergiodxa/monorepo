/**
 * Unit tests for `fixed()`'s fixed `position: fixed` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { fixed } from "./fixed.js";

describe("fixed", () => {
	test("sets position: fixed", async () => {
		expect(await declarations(fixed())).toEqual(["position: fixed"]);
	});
});
