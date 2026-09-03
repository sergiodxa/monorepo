/**
 * Unit tests for `required.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations, serialize } from "../internal/serialize.js";
import { p } from "../size/p.js";

import { required } from "./required.js";

describe("required", () => {
	test("emits both the native and the ARIA selector in one block", async () => {
		expect(await serialize(required(p(4)))).toContain('&:required, &[aria-required="true"] {');
		expect(await declarations(required(p(4)))).toEqual([
			"padding: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});
});
