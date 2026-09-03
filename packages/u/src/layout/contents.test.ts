/**
 * Unit tests for `contents()`'s fixed `display: contents` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { contents } from "./contents.js";

describe("contents", () => {
	test("sets display: contents", async () => {
		expect(await declarations(contents())).toEqual(["display: contents"]);
	});
});
