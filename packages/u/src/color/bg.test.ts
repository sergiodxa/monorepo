/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { bg } from "./bg";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("bg", () => {
	test("no-arg resolves the system default", () => {
		expect(styles(bg())).toEqual({ backgroundColor: "var(--ui-bg, Canvas)" });
	});

	test("a semantic tone with an explicit tint suffix", () => {
		expect(styles(bg("brand.tint"))).toEqual({
			backgroundColor: "var(--ui-brand-bg-tint)",
		});
	});

	test("a semantic tone with an explicit solid suffix", () => {
		expect(styles(bg("brand.solid"))).toEqual({
			backgroundColor: "var(--ui-brand-bg-solid)",
		});
	});

	test("a raw palette reference", () => {
		expect(styles(bg("color.neutral.50"))).toEqual({
			backgroundColor: "var(--ui-color-neutral-50)",
		});
	});

	test("an options object sets only the given background properties", () => {
		expect(styles(bg({ image: "url(/hero.jpg)", size: "cover", position: "center" }))).toEqual({
			backgroundImage: "url(/hero.jpg)",
			backgroundSize: "cover",
			backgroundPosition: "center",
		});
	});

	test("an options object's color key resolves the same way the bare-value form does", () => {
		expect(styles(bg({ color: "brand.tint" }))).toEqual({
			backgroundColor: "var(--ui-brand-bg-tint)",
		});
	});

	test("an options object can set repeat and attachment too", () => {
		expect(styles(bg({ repeat: "no-repeat", attachment: "fixed" }))).toEqual({
			backgroundRepeat: "no-repeat",
			backgroundAttachment: "fixed",
		});
	});

	test("clip sets background-clip", () => {
		expect(styles(bg({ clip: "content-box" }))).toEqual({
			backgroundClip: "content-box",
		});
	});

	test("clip combines with the other keys, and 'text' clips to the glyphs", () => {
		expect(
			styles(
				bg({ image: "linear-gradient(to right, red, blue)", clip: "text", color: "transparent" }),
			),
		).toEqual({
			backgroundImage: "linear-gradient(to right, red, blue)",
			backgroundColor: "transparent",
			backgroundClip: "text",
		});
	});
});
