/**
 * Unit tests for `hidden()`'s fixed `display: none` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { hidden } from "./hidden";

describe("hidden", () => {
	test("sets display: none", async () => {
		expect(await declarations(hidden())).toEqual(["display: none"]);
	});
});
