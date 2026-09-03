/**
 * Unit tests for `dark.ts`, sugar over `scheme("dark", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { bg } from "../color/bg.js";
import { serialize } from "../internal/serialize.js";

import { dark } from "./dark.js";
import { scheme } from "./scheme.js";

describe("dark", () => {
	test("produces the identical stylesheet scheme('dark', input) would", async () => {
		expect(await serialize(dark(bg("neutral.solid")))).toBe(
			await serialize(scheme("dark", bg("neutral.solid"))),
		);
	});

	test("nests the forced-class block and the system-preference at-rule with the same styles", async () => {
		let css = await serialize(dark(bg("neutral.solid")));

		expect(css).toMatch(/\.dark & \{\s*background-color: var\(--ui-neutral-bg-solid\);/);
		expect(css).toMatch(
			/@media \(prefers-color-scheme: dark\) \{[\s\S]*\.system & \{\s*background-color: var\(--ui-neutral-bg-solid\);/,
		);
	});
});
