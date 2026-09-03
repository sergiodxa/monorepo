/**
 * Unit tests for `flex()`'s fixed `display: flex` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { flex } from "./flex.js";

describe("flex", () => {
	test("sets display: flex", async () => {
		expect(await declarations(flex())).toEqual(["display: flex"]);
	});
});
