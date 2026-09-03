/**
 * Unit tests for `disabled.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations, serialize } from "../internal/serialize.js";
import { p } from "../size/p.js";

import { disabled } from "./disabled.js";

describe("disabled", () => {
	test("emits both the native and the ARIA selector in one block", async () => {
		expect(await serialize(disabled(p(4)))).toContain('&:disabled, &[aria-disabled="true"] {');
		expect(await declarations(disabled(p(4)))).toEqual([
			"padding: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});
});
