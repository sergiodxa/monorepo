/**
 * Unit tests for `has-sibling.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations, serialize } from "../internal/serialize";
import { p } from "../size/p";

import { hasSibling } from "./has-sibling";

describe("hasSibling", () => {
	test("emits an '&:has(~ selector)' block — the combinator must stay inside :has()", async () => {
		expect(await serialize(hasSibling("input:checked", p(4)))).toContain(
			"&:has(~ input:checked) {",
		);
		expect(await declarations(hasSibling("input:checked", p(4)))).toEqual([
			"padding: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});
});
