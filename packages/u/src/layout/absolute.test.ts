/**
 * Unit tests for `absolute()`'s fixed `position: absolute` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { absolute } from "./absolute.js";

describe("absolute", () => {
	test("sets position: absolute", async () => {
		expect(await declarations(absolute())).toEqual(["position: absolute"]);
	});
});
