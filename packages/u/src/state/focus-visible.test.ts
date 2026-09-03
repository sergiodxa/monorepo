/**
 * Unit tests for `focus-visible.ts`, sugar over `when("&:focus-visible", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { border } from "../color/border.js";
import { declarations, serialize } from "../internal/serialize.js";

import { focusVisible } from "./focus-visible.js";

describe("focusVisible", () => {
	test("emits an '&:focus-visible' block around the wrapped utility's declarations", async () => {
		expect(await serialize(focusVisible(border("brand")))).toContain("&:focus-visible {");
		expect(await declarations(focusVisible(border("brand")))).toEqual([
			"border-color: var(--ui-brand-border)",
		]);
	});
});
