/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { truncate } from "./truncate";

describe("truncate", () => {
	test("applies the fixed single-line ellipsis overflow declaration", async () => {
		expect(await declarations(truncate())).toEqual([
			"overflow: hidden",
			"white-space: nowrap",
			"text-overflow: ellipsis",
		]);
	});
});
