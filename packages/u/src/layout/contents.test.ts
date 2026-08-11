/**
 * Unit tests for `contents()`'s fixed `display: contents` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { contents } from "./contents";

describe("contents", () => {
	test("sets display: contents", async () => {
		expect(await declarations(contents())).toEqual(["display: contents"]);
	});
});
