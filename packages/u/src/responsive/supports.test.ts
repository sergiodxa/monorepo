/**
 * Unit tests for `supports.ts`, the `@supports` feature-query wrapper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { serialize } from "../internal/serialize.js";
import { p } from "../size/p.js";

import { supports } from "./supports.js";

describe("supports", () => {
	test("nests the wrapped utility's styles under '@supports <query>'", async () => {
		expect(await serialize(supports("(corner-shape: squircle)", p(4)))).toMatch(
			/@supports \(corner-shape: squircle\) \{[\s\S]*padding: calc\(var\(--ui-spacing, 0\.25rem\) \* 4\)/,
		);
	});
});
