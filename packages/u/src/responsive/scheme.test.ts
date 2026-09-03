/**
 * Unit tests for `scheme.ts`, the light/dark mode wrapper covering both the
 * forced-class contract and the system-preference contract.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { bg } from "../color/bg.js";
import { serialize } from "../internal/serialize.js";

import { scheme } from "./scheme.js";

describe("scheme", () => {
	test("'dark' produces both the forced-class block and the system-preference at-rule with the same styles", async () => {
		let css = await serialize(scheme("dark", bg("neutral.solid")));

		expect(css).toMatch(/\.dark & \{\s*background-color: var\(--ui-neutral-bg-solid\);/);
		expect(css).toMatch(
			/@media \(prefers-color-scheme: dark\) \{[\s\S]*\.system & \{\s*background-color: var\(--ui-neutral-bg-solid\);/,
		);
	});

	test("'light' produces both the forced-class block and the system-preference at-rule with the same styles", async () => {
		let css = await serialize(scheme("light", bg("neutral.solid")));

		expect(css).toMatch(/\.light & \{\s*background-color: var\(--ui-neutral-bg-solid\);/);
		expect(css).toMatch(
			/@media \(prefers-color-scheme: light\) \{[\s\S]*\.system & \{\s*background-color: var\(--ui-neutral-bg-solid\);/,
		);
	});

	test("the forced-class block stays outside the preference at-rule, so an explicit choice wins", async () => {
		let css = await serialize(scheme("dark", bg("neutral.solid")));

		expect(css.indexOf(".dark &")).toBeLessThan(css.indexOf("@media (prefers-color-scheme"));
	});
});
