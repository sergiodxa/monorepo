/**
 * Unit tests for `after.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations, serialize } from "../internal/serialize";
import { p } from "../size/p";

import { after } from "./after";

describe("after", () => {
	test("emits an '&::after' block around the input's declarations", async () => {
		expect(await serialize(after(p(4)))).toContain("&::after {");
		expect(await declarations(after(p(4)))).toEqual([
			"padding: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});
});
