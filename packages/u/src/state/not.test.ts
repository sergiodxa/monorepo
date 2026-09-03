/**
 * Unit tests for `not.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations, serialize } from "../internal/serialize.js";
import { p } from "../size/p.js";

import { not } from "./not.js";

describe("not", () => {
	test("emits an '&:not(selector)' block around the input's declarations", async () => {
		expect(await serialize(not(":disabled", p(4)))).toContain("&:not(:disabled) {");
		expect(await declarations(not(":disabled", p(4)))).toEqual([
			"padding: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});
});
