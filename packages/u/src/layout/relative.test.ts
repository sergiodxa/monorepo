/**
 * Unit tests for `relative()`'s fixed `position: relative` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { relative } from "./relative";

describe("relative", () => {
	test("sets position: relative", async () => {
		expect(await declarations(relative())).toEqual(["position: relative"]);
	});
});
