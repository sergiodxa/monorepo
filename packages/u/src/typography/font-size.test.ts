/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { fontSize } from "./font-size.js";
import { text } from "./text.js";

describe("fontSize", () => {
	test("a named size resolves only fontSize, with no lineHeight", async () => {
		expect(await declarations(fontSize("lg"))).toEqual(["font-size: var(--ui-text-lg, 1.125rem)"]);
	});

	test("'sm' matches text('sm')'s own fontSize half exactly", async () => {
		expect(await declarations(fontSize("sm"))).toEqual(["font-size: var(--ui-text-sm, 0.875rem)"]);
		expect(await declarations(text("sm"))).toContain("font-size: var(--ui-text-sm, 0.875rem)");
	});

	test("'xs' matches text('xs')'s own fontSize half exactly", async () => {
		expect(await declarations(fontSize("xs"))).toEqual(["font-size: var(--ui-text-xs, 0.75rem)"]);
		expect(await declarations(text("xs"))).toContain("font-size: var(--ui-text-xs, 0.75rem)");
	});
});
