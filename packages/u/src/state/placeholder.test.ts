/**
 * Unit tests for `placeholder.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations, serialize } from "../internal/serialize.js";
import { p } from "../size/p.js";

import { placeholder } from "./placeholder.js";

describe("placeholder", () => {
	test("emits an '&::placeholder' block around the input's declarations", async () => {
		expect(await serialize(placeholder(p(4)))).toContain("&::placeholder {");
		expect(await declarations(placeholder(p(4)))).toEqual([
			"padding: calc(var(--ui-spacing, 0.25rem) * 4)",
		]);
	});
});
