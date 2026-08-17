/**
 * Unit tests for `before.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations, serialize } from "../internal/serialize";
import { p } from "../size/p";

import { before } from "./before";

describe("before", () => {
	test("emits an '&::before' block around the input's declarations", async () => {
		expect(await serialize(before(p(4)))).toContain("&::before {");
		expect(await declarations(before(p(4)))).toEqual([
			"padding: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});
});
