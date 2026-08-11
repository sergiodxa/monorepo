/**
 * Unit tests for `invalid.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { border } from "../color/border";
import { declarations, serialize } from "../internal/serialize";

import { invalid } from "./invalid";

describe("invalid", () => {
	test("emits ':user-invalid' — not ':invalid' — alongside the ARIA selector", async () => {
		// `:invalid` fires before the user has typed anything; `:user-invalid`
		// waits for interaction, so the distinction is user-visible.
		expect(await serialize(invalid(border("danger")))).toContain(
			'&:user-invalid, &[aria-invalid="true"] {',
		);
		expect(await declarations(invalid(border("danger")))).toEqual([
			"border-color: var(--ui-danger-border)",
		]);
	});
});
