/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations, serialize } from "../internal/serialize";

import { ring } from "./ring";

describe("ring", () => {
	test("no-arg resolves the system default, nested under &:focus-visible", async () => {
		expect(await serialize(ring())).toContain("&:focus-visible");
		expect(await declarations(ring())).toEqual([
			"outline-width: 2px",
			"outline-style: solid",
			"outline-offset: 2px",
			"outline-color: var(--ui-ring, Highlight)",
		]);
	});

	/**
	 * `:focus` fires on pointer clicks too, so the ring scopes to
	 * `:focus-visible` and tracks keyboard and assistive-tech focus.
	 */
	test("never nests under plain :focus", async () => {
		expect(await serialize(ring())).not.toMatch(/:focus\s*\{/);
	});

	test("an explicit tone, still nested under &:focus-visible", async () => {
		expect(await serialize(ring("danger"))).toContain("&:focus-visible");
		expect(await declarations(ring("danger"))).toEqual([
			"outline-width: 2px",
			"outline-style: solid",
			"outline-offset: 2px",
			"outline-color: var(--ui-danger-ring)",
		]);
	});
});
