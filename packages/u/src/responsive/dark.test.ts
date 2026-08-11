/**
 * Unit tests for `dark.ts`, sugar over `scheme("dark", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { bg } from "../color/bg";
import { serialize } from "../internal/serialize";

import { dark } from "./dark";
import { scheme } from "./scheme";

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
