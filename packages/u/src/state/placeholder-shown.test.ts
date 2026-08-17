/**
 * Unit tests for `placeholder-shown.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations, serialize } from "../internal/serialize";
import { p } from "../size/p";

import { placeholderShown } from "./placeholder-shown";

describe("placeholderShown", () => {
	test("emits an '&:placeholder-shown' block around the input's declarations", async () => {
		expect(await serialize(placeholderShown(p(4)))).toContain("&:placeholder-shown {");
		expect(await declarations(placeholderShown(p(4)))).toEqual([
			"padding: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});
});
