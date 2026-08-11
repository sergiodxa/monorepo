/**
 * Unit tests for `spacer()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { spacer } from "./spacer";

describe("spacer", () => {
	test("grows and shrinks to fill the available space", async () => {
		expect(await declarations(spacer())).toEqual(["flex: 1 1 auto"]);
	});
});
