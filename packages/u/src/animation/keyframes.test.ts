/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations, serialize } from "../internal/serialize";

import { keyframes } from "./keyframes";

describe("keyframes", () => {
	test("emits only the @keyframes rule for the given name and frames", async () => {
		let css = await serialize(keyframes("fade-in", { from: { opacity: 0 }, to: { opacity: 1 } }));

		expect(css).toContain("@keyframes fade-in");
		expect(css).toContain("from");
		expect(css).toContain("to");
		// The frame values are the only declarations in the whole stylesheet,
		// and `opacity` is unitless, so neither picks up a `px` suffix.
		expect(
			await declarations(keyframes("fade-in", { from: { opacity: 0 }, to: { opacity: 1 } })),
		).toEqual(["opacity: 0", "opacity: 1"]);
	});

	test("never emits host declarations such as animationName", async () => {
		let css = await serialize(keyframes("fade-in", { from: { opacity: 0 }, to: { opacity: 1 } }));

		expect(css).not.toContain("animation-name");
		expect(css).not.toContain("animation-duration");
	});
});
