/**
 * Unit tests for `backdrop.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations, serialize } from "../internal/serialize";
import { p } from "../size/p";

import { backdrop } from "./backdrop";

describe("backdrop", () => {
	test("emits an '&::backdrop' block around the input's declarations", async () => {
		expect(await serialize(backdrop(p(4)))).toContain("&::backdrop {");
		expect(await declarations(backdrop(p(4)))).toEqual([
			"padding: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});
});
