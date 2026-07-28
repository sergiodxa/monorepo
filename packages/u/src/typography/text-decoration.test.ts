/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { textDecoration } from "./text-decoration";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("textDecoration", () => {
	test("no-arg defaults to underline", () => {
		expect(styles(textDecoration())).toEqual({ textDecorationLine: "underline" });
	});

	test("applies the given text-decoration-line value", () => {
		expect(styles(textDecoration("underline"))).toEqual({ textDecorationLine: "underline" });
	});

	test("accepts 'none' to remove a decoration", () => {
		expect(styles(textDecoration("none"))).toEqual({ textDecorationLine: "none" });
	});

	test("an options object's line key matches the bare-value form", () => {
		expect(styles(textDecoration({ line: "line-through" }))).toEqual({
			textDecorationLine: "line-through",
		});
	});

	test("a bare tone color resolves through the token layer's fg default", () => {
		expect(styles(textDecoration({ color: "brand" }))).toEqual({
			textDecorationColor: "var(--ui-brand-fg)",
		});
	});

	test("an explicit color suffix is respected", () => {
		expect(styles(textDecoration({ color: "danger.muted" }))).toEqual({
			textDecorationColor: "var(--ui-danger-fg-muted)",
		});
	});

	test("style sets text-decoration-style", () => {
		expect(styles(textDecoration({ style: "wavy" }))).toEqual({
			textDecorationStyle: "wavy",
		});
	});

	test("a numeric thickness is treated as pixels", () => {
		expect(styles(textDecoration({ thickness: 2 }))).toEqual({
			textDecorationThickness: "2px",
		});
	});

	test("a string thickness passes through unchanged", () => {
		expect(styles(textDecoration({ thickness: "from-font" }))).toEqual({
			textDecorationThickness: "from-font",
		});
	});

	test("a numeric offset is treated as pixels", () => {
		expect(styles(textDecoration({ offset: 3 }))).toEqual({
			textUnderlineOffset: "3px",
		});
	});

	test("a string offset passes through unchanged", () => {
		expect(styles(textDecoration({ offset: "auto" }))).toEqual({
			textUnderlineOffset: "auto",
		});
	});

	test("an options object sets only the given keys", () => {
		expect(
			styles(textDecoration({ line: "underline", color: "brand", style: "solid", offset: 3 })),
		).toEqual({
			textDecorationLine: "underline",
			textDecorationColor: "var(--ui-brand-fg)",
			textDecorationStyle: "solid",
			textUnderlineOffset: "3px",
		});
	});

	test("an empty options object sets nothing", () => {
		expect(styles(textDecoration({}))).toEqual({});
	});
});
