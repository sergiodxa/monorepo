/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations, serialize } from "../internal/serialize";

import { keyframes } from "./keyframes";

describe("keyframes", () => {
	test("emits only the @keyframes rule for the given name and frames", async () => {
		let css = await serialize(keyframes("fade-in", { from: { opacity: 0 }, to: { opacity: 1 } }));

		expect(css).toContain("@keyframes fade-in");
		expect(css).toContain("from");
		expect(css).toContain("to");
		expect(
			await declarations(keyframes("fade-in", { from: { opacity: 0 }, to: { opacity: 1 } })),
		).toEqual(["opacity: 0", "opacity: 1"]);
	});

	/**
	 * A stop that reaches the declaration path serializes as
	 * `0%: [object Object];` and the browser drops the rule.
	 */
	test("emits percentage stops as real stop blocks, not as declarations", async () => {
		let css = await serialize(
			keyframes("ramp", {
				"0%": { opacity: 0 },
				"10%, 90%": { opacity: 1 },
				"100%": { opacity: 0 },
			}),
		);

		expect(css).not.toContain("[object Object]");
		expect(css).toMatch(/\b0%\s*\{/);
		expect(css).toMatch(/\b10%,\s*90%\s*\{/);
		expect(css).toMatch(/\b100%\s*\{/);
	});

	test("never emits host declarations such as animationName", async () => {
		let css = await serialize(keyframes("fade-in", { from: { opacity: 0 }, to: { opacity: 1 } }));

		expect(css).not.toContain("animation-name");
		expect(css).not.toContain("animation-duration");
	});
});
