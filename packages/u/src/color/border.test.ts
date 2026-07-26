/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { border } from "./border";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("border", () => {
	test("no-arg resolves the system default", () => {
		expect(styles(border())).toEqual({
			borderColor: "var(--ui-border, color-mix(in oklab, CanvasText 16%, transparent))",
		});
	});

	test("'none' short-circuits to a bare border reset, not a color branch", () => {
		expect(styles(border("none"))).toEqual({ border: "none" });
	});

	test("a bare tone defaults to that tone's plain border weight", () => {
		expect(styles(border("brand"))).toEqual({ borderColor: "var(--ui-brand-border)" });
	});

	test("an explicit strong suffix", () => {
		expect(styles(border("brand.strong"))).toEqual({
			borderColor: "var(--ui-brand-border-strong)",
		});
	});

	test("an options object with a numeric width defaults style to solid", () => {
		expect(styles(border({ color: "brand", width: 2 }))).toEqual({
			borderColor: "var(--ui-brand-border)",
			borderWidth: "2px",
			borderStyle: "solid",
		});
	});

	test("an options object's explicit style overrides the solid default", () => {
		expect(styles(border({ width: 1, style: "dashed" }))).toEqual({
			borderWidth: "1px",
			borderStyle: "dashed",
		});
	});

	test("an options object only sets the given keys", () => {
		expect(styles(border({ color: "danger" }))).toEqual({ borderColor: "var(--ui-danger-border)" });
	});

	test("an options object's width accepts a raw CSS length string", () => {
		expect(styles(border({ width: "0.5rem" }))).toEqual({
			borderWidth: "0.5rem",
			borderStyle: "solid",
		});
	});

	test("width alone still defaults style to solid when noStyleDefault is absent", () => {
		expect(styles(border({ width: 2 }))).toEqual({
			borderWidth: "2px",
			borderStyle: "solid",
		});
	});

	test("noStyleDefault suppresses the solid default, leaving width-only output", () => {
		expect(styles(border({ width: 2, noStyleDefault: true }))).toEqual({
			borderWidth: "2px",
		});
	});

	test("noStyleDefault has no effect when style is also given explicitly", () => {
		expect(styles(border({ width: 2, style: "dashed", noStyleDefault: true }))).toEqual({
			borderWidth: "2px",
			borderStyle: "dashed",
		});
	});
});
