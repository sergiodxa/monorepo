/**
 * Unit tests for `invalid.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { border } from "../color/border.js";
import { declarations, serialize } from "../internal/serialize.js";

import { invalid } from "./invalid.js";

describe("invalid", () => {
	test("emits ':user-invalid' — not ':invalid' — alongside the ARIA selector", async () => {
		expect(await serialize(invalid(border("danger")))).toContain(
			'&:user-invalid, &[aria-invalid="true"] {',
		);
		expect(await declarations(invalid(border("danger")))).toEqual([
			"border-color: var(--ui-danger-border)",
		]);
	});
});
