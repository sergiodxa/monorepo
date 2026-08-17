/**
 * Unit tests for `hover.ts`, sugar over `when("&:hover", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { bg } from "../color/bg";
import { declarations, serialize } from "../internal/serialize";

import { hover } from "./hover";

describe("hover", () => {
	test("emits an '&:hover' block around the wrapped utility's declarations", async () => {
		expect(await serialize(hover(bg("brand.tint")))).toContain("&:hover {");
		expect(await declarations(hover(bg("brand.tint")))).toEqual([
			"background-color: var(--ui-brand-bg-tint)",
		]);
	});
});
