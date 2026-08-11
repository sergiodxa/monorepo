/**
 * Unit tests for `flex()`'s fixed `display: flex` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { flex } from "./flex";

describe("flex", () => {
	test("sets display: flex", async () => {
		expect(await declarations(flex())).toEqual(["display: flex"]);
	});
});
