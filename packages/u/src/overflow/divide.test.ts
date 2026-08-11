/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations, serialize } from "../internal/serialize";

import { divide } from "./divide";

/** Same tiny system default `u.border()` falls back to when no color is given. */
const DEFAULT_BORDER_COLOR = "var(--ui-border, color-mix(in oklab, CanvasText 16%, transparent))";

describe("divide", () => {
	test("no args defaults to the block axis, 1px, and the system default border color", async () => {
		expect(await declarations(divide())).toEqual([
			"border-style: solid",
			"border-block-end-width: 1px",
			`border-block-end-color: ${DEFAULT_BORDER_COLOR}`,
		]);
	});

	test("the declarations land inside the between-children child selector", async () => {
		// The whole point of the utility is that only the gaps between siblings
		// get a border; a flat declaration would border the container instead.
		expect(await serialize(divide())).toMatch(
			/& > \*:not\(:last-child\) \{[\s\S]*border-block-end-width: 1px/,
		);
	});

	test("axis only", async () => {
		expect(await declarations(divide("inline"))).toEqual([
			"border-style: solid",
			"border-inline-end-width: 1px",
			`border-inline-end-color: ${DEFAULT_BORDER_COLOR}`,
		]);
	});

	test("axis + color", async () => {
		expect(await declarations(divide("block", "brand"))).toEqual([
			"border-style: solid",
			"border-block-end-width: 1px",
			"border-block-end-color: var(--ui-brand-border)",
		]);
	});

	test("axis + color + width", async () => {
		expect(await declarations(divide("block", "brand", 2))).toEqual([
			"border-style: solid",
			"border-block-end-width: 2px",
			"border-block-end-color: var(--ui-brand-border)",
		]);
	});

	test("axis + width, with no color, still resolves the system default color", async () => {
		expect(await declarations(divide("block", 2))).toEqual([
			"border-style: solid",
			"border-block-end-width: 2px",
			`border-block-end-color: ${DEFAULT_BORDER_COLOR}`,
		]);
	});
});
