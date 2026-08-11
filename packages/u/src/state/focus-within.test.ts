/**
 * Unit tests for `focus-within.ts`, sugar over `when("&:focus-within", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { border } from "../color/border";
import { declarations, serialize } from "../internal/serialize";

import { focusWithin } from "./focus-within";

describe("focusWithin", () => {
	test("emits an '&:focus-within' block around the wrapped utility's declarations", async () => {
		expect(await serialize(focusWithin(border("brand")))).toContain("&:focus-within {");
		expect(await declarations(focusWithin(border("brand")))).toEqual([
			"border-color: var(--ui-brand-border)",
		]);
	});
});
