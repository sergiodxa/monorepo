/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { truncate } from "./truncate.js";

describe("truncate", () => {
	test("applies the fixed single-line ellipsis overflow declaration", async () => {
		expect(await declarations(truncate())).toEqual([
			"overflow: hidden",
			"white-space: nowrap",
			"text-overflow: ellipsis",
		]);
	});
});
