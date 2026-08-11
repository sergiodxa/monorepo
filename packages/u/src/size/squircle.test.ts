/**
 * Unit tests for `squircle()`'s composition of a radius declaration with the
 * `corner()` progressive-enhancement wrapper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations, serialize } from "../internal/serialize";

import { squircle } from "./squircle";

describe("squircle", () => {
	test("defaults to the 'md' radius, alongside the @supports corner-shape block", async () => {
		expect(await serialize(squircle())).toContain("@supports (corner-shape: squircle)");
		expect(await declarations(squircle())).toEqual([
			"border-radius: var(--ui-radius-md, 0.375rem)",
			"corner-shape: squircle",
		]);
	});

	test("resolves an explicit radius name, alongside the @supports corner-shape block", async () => {
		expect(await serialize(squircle("lg"))).toContain("@supports (corner-shape: squircle)");
		expect(await declarations(squircle("lg"))).toEqual([
			"border-radius: var(--ui-radius-lg, 0.5rem)",
			"corner-shape: squircle",
		]);
	});

	test("the radius is unconditional and only corner-shape sits behind @supports", async () => {
		// The fallback shape is the whole point: a browser without
		// `corner-shape` must still get the plain rounded corners.
		let css = await serialize(squircle("lg"));

		expect(css.indexOf("border-radius:")).toBeLessThan(css.indexOf("@supports"));
	});
});
