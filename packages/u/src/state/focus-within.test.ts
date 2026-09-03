/**
 * Unit tests for `focus-within.ts`, sugar over `when("&:focus-within", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { border } from "../color/border.js";
import { declarations, serialize } from "../internal/serialize.js";

import { focusWithin } from "./focus-within.js";

describe("focusWithin", () => {
	test("emits an '&:focus-within' block around the wrapped utility's declarations", async () => {
		expect(await serialize(focusWithin(border("brand")))).toContain("&:focus-within {");
		expect(await declarations(focusWithin(border("brand")))).toEqual([
			"border-color: var(--ui-brand-border)",
		]);
	});
});
