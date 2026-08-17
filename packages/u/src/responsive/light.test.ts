/**
 * Unit tests for `light.ts`, sugar over `scheme("light", input)`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { bg } from "../color/bg";
import { serialize } from "../internal/serialize";

import { light } from "./light";
import { scheme } from "./scheme";

describe("light", () => {
	test("produces the identical stylesheet scheme('light', input) would", async () => {
		expect(await serialize(light(bg("neutral.solid")))).toBe(
			await serialize(scheme("light", bg("neutral.solid"))),
		);
	});

	test("nests the forced-class block and the system-preference at-rule with the same styles", async () => {
		let css = await serialize(light(bg("neutral.solid")));

		expect(css).toMatch(/\.light & \{\s*background-color: var\(--ui-neutral-bg-solid\);/);
		expect(css).toMatch(
			/@media \(prefers-color-scheme: light\) \{[\s\S]*\.system & \{\s*background-color: var\(--ui-neutral-bg-solid\);/,
		);
	});
});
