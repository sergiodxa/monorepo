/**
 * Unit tests for `ringShadow()` writing its ring to the `ring` slot of the
 * shared composite `box-shadow` declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { COMPOSITE_BOX_SHADOW } from "../internal/box-shadow";
import { compose } from "../internal/descriptor";
import { declarations } from "../internal/serialize";

import { ringShadow } from "./ring-shadow";
import { shadow } from "./shadow";

describe("ringShadow", () => {
	test("a bare tone defaults to a 2px ring in that tone's solid background color", async () => {
		expect(await declarations(ringShadow("brand"))).toEqual([
			"--ui-box-shadow-ring: 0 0 0 2px var(--ui-brand-bg-solid)",
			`box-shadow: ${COMPOSITE_BOX_SHADOW}`,
		]);
	});

	test("accepts a numeric width", async () => {
		expect(await declarations(ringShadow("danger", 3))).toEqual([
			"--ui-box-shadow-ring: 0 0 0 3px var(--ui-danger-bg-solid)",
			`box-shadow: ${COMPOSITE_BOX_SHADOW}`,
		]);
	});

	test("accepts a string width, passed through unchanged", async () => {
		expect(await declarations(ringShadow("neutral", "0.25rem"))).toEqual([
			"--ui-box-shadow-ring: 0 0 0 0.25rem var(--ui-neutral-bg-solid)",
			`box-shadow: ${COMPOSITE_BOX_SHADOW}`,
		]);
	});
});

describe("composability with shadow", () => {
	test("composing ringShadow() and shadow() together sets both slots under the same composite box-shadow", async () => {
		let merged = compose([ringShadow("brand", 3), shadow("md")], (styles) => styles);

		expect(await declarations(merged)).toEqual([
			"--ui-box-shadow-ring: 0 0 0 3px var(--ui-brand-bg-solid)",
			`box-shadow: ${COMPOSITE_BOX_SHADOW}`,
			"--ui-box-shadow-elevation: var(--ui-shadow-md, 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1))",
		]);
	});

	test("the ring slot paints before the elevation slot in the emitted composite", async () => {
		let composite = (await declarations(ringShadow("brand"))).join("\n");

		expect(composite.indexOf("var(--ui-box-shadow-ring")).toBeLessThan(
			composite.indexOf("var(--ui-box-shadow-elevation"),
		);
	});
});
