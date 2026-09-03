/**
 * Unit tests for `hover.ts`, sugar over `when("&:hover", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { bg } from "../color/bg.js";
import { declarations, serialize } from "../internal/serialize.js";

import { hover } from "./hover.js";

describe("hover", () => {
	test("emits an '&:hover' block around the wrapped utility's declarations", async () => {
		expect(await serialize(hover(bg("brand.tint")))).toContain("&:hover {");
		expect(await declarations(hover(bg("brand.tint")))).toEqual([
			"background-color: var(--ui-brand-bg-tint)",
		]);
	});
});
