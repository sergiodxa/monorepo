/**
 * Unit tests for `flexRowReverse()`'s fixed `flex-direction: row-reverse`
 * declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { flexRowReverse } from "./flex-row-reverse.js";

describe("flexRowReverse", () => {
	test("sets display: flex and flex-direction: row-reverse", async () => {
		expect(await declarations(flexRowReverse())).toEqual([
			"display: flex",
			"flex-direction: row-reverse",
		]);
	});
});
