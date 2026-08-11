/**
 * Unit tests for `active.ts`, sugar over `when("&:active", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { bg } from "../color/bg";
import { declarations, serialize } from "../internal/serialize";

import { active } from "./active";

describe("active", () => {
	test("emits an '&:active' block around the wrapped utility's declarations", async () => {
		expect(await serialize(active(bg("brand.solid")))).toContain("&:active {");
		expect(await declarations(active(bg("brand.solid")))).toEqual([
			"background-color: var(--ui-brand-bg-solid)",
		]);
	});
});
