/**
 * Unit tests for `not.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations, serialize } from "../internal/serialize";
import { p } from "../size/p";

import { not } from "./not";

describe("not", () => {
	test("emits an '&:not(selector)' block around the input's declarations", async () => {
		expect(await serialize(not(":disabled", p(4)))).toContain("&:not(:disabled) {");
		expect(await declarations(not(":disabled", p(4)))).toEqual([
			"padding: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});
});
