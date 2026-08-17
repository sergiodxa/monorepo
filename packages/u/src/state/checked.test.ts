/**
 * Unit tests for `checked.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { bg } from "../color/bg";
import { declarations, serialize } from "../internal/serialize";

import { checked } from "./checked";

describe("checked", () => {
	test("emits both the native and the ARIA selector in one block", async () => {
		// The comma-separated pair must survive verbatim: a widget that fakes
		// checkedness with `aria-checked` gets no `:checked` from the browser.
		expect(await serialize(checked(bg("brand.solid")))).toContain(
			'&:checked, &[aria-checked="true"] {',
		);
		expect(await declarations(checked(bg("brand.solid")))).toEqual([
			"background-color: var(--ui-brand-bg-solid)",
		]);
	});
});
