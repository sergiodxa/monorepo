/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { virtualize } from "./virtualize.js";

describe("virtualize", () => {
	test("applies content-visibility with the given intrinsic size fallback", async () => {
		expect(await declarations(virtualize("auto var(--ui-table-row-size, 2.5rem)"))).toEqual([
			"content-visibility: auto",
			"contain-intrinsic-size: auto var(--ui-table-row-size, 2.5rem)",
		]);
	});
});
