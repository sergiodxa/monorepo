/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { textShadow } from "./text-shadow";

describe("textShadow", () => {
	test("no-arg resolves the default offsets off the spacing scale and a translucent black", async () => {
		expect(await declarations(textShadow())).toEqual([
			"text-shadow: calc(var(--ui-spacing, 0.25rem) * 0) calc(var(--ui-spacing, 0.25rem) * 1) calc(var(--ui-spacing, 0.25rem) * 2) rgb(0 0 0 / 0.35)",
		]);
	});

	test("raw CSS lengths pass through unchanged", async () => {
		expect(await declarations(textShadow({ x: "1px", y: "2px", blur: "4px" }))).toEqual([
			"text-shadow: 1px 2px 4px rgb(0 0 0 / 0.35)",
		]);
	});

	test("a bare tone color resolves against the border property", async () => {
		expect(await declarations(textShadow({ x: "0", y: "0", blur: "0", color: "brand" }))).toEqual([
			"text-shadow: 0 0 0 var(--ui-brand-border)",
		]);
	});

	test("an explicit color property is honored", async () => {
		expect(
			await declarations(textShadow({ x: "0", y: "1px", blur: "2px", color: "brand.solid" })),
		).toEqual(["text-shadow: 0 1px 2px var(--ui-brand-bg-solid)"]);
	});

	test("sets only text-shadow, unlike its filter-based neighbour", async () => {
		expect((await declarations(textShadow())).map((line) => line.split(":")[0])).toEqual([
			"text-shadow",
		]);
	});
});
