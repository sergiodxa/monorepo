/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { bg } from "../color/bg.js";
import { declarations, serialize } from "../internal/serialize.js";

import { readOnly } from "./read-only.js";

describe("readOnly", () => {
	test("emits both the native and the ARIA selector in one block", async () => {
		expect(await serialize(readOnly(bg("brand.tint")))).toContain(
			'&:read-only, &[aria-readonly="true"] {',
		);
		expect(await declarations(readOnly(bg("brand.tint")))).toEqual([
			"background-color: var(--ui-brand-bg-tint)",
		]);
	});
});
