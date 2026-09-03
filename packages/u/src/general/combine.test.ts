/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { border } from "../color/border.js";
import { rounded } from "../effects/rounded.js";
import { declarations, serialize } from "../internal/serialize.js";
import { when } from "../state/when.js";

import { combine } from "./combine.js";

describe("combine", () => {
	test("merges several utilities' styles into one flat object, with no wrapping key", async () => {
		expect(
			await declarations(combine([rounded("lg"), border({ color: "neutral", width: 1 })])),
		).toEqual([
			"border-radius: var(--ui-radius-lg, 0.5rem)",
			"border-color: var(--ui-neutral-border)",
			"border-width: 1px",
			"border-style: solid",
		]);
	});

	test("merges already-nested utilities, each keeping its own selector as a sibling", async () => {
		let css = await serialize(
			combine([
				when("&:hover", rounded("lg")),
				when("&:focus", border({ color: "neutral", width: 1 })),
			]),
		);

		expect(css).toContain("&:hover {");
		expect(css).toContain("&:focus {");
		expect(css.replace(/\s+/g, " ")).toContain(
			"&:hover { border-radius: var(--ui-radius-lg, 0.5rem); } &:focus { border-color: var(--ui-neutral-border); border-width: 1px; border-style: solid; }",
		);
	});

	test("drops falsy entries the same way a mix array would", async () => {
		expect(await declarations(combine([rounded("lg"), false, null, undefined]))).toEqual([
			"border-radius: var(--ui-radius-lg, 0.5rem)",
		]);
	});

	test("returns a fresh mixin descriptor on every call", () => {
		expect(combine([rounded("lg")])).not.toBe(combine([rounded("lg")]));
	});
});
