/**
 * Unit tests for `hstack()`'s base flex-row declaration plus its optional
 * `gap`/`align`/`justify` composition, including the `between`/`around`/
 * `evenly` aliasing `u.justify()` applies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { hstack } from "./hstack";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("hstack", () => {
	test("no options sets only display and flex-direction", () => {
		expect(styles(hstack())).toEqual({ display: "flex", flexDirection: "row" });
	});

	test("gap only", () => {
		expect(styles(hstack({ gap: 4 }))).toEqual({
			display: "flex",
			flexDirection: "row",
			gap: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("align only", () => {
		expect(styles(hstack({ align: "center" }))).toEqual({
			display: "flex",
			flexDirection: "row",
			alignItems: "center",
		});
	});

	test("justify only, plain keyword", () => {
		expect(styles(hstack({ justify: "center" }))).toEqual({
			display: "flex",
			flexDirection: "row",
			justifyContent: "center",
		});
	});

	test("justify only, aliasing between to space-between", () => {
		expect(styles(hstack({ justify: "between" }))).toEqual({
			display: "flex",
			flexDirection: "row",
			justifyContent: "space-between",
		});
	});

	test("justify only, aliasing around to space-around", () => {
		expect(styles(hstack({ justify: "around" }))).toEqual({
			display: "flex",
			flexDirection: "row",
			justifyContent: "space-around",
		});
	});

	test("justify only, aliasing evenly to space-evenly", () => {
		expect(styles(hstack({ justify: "evenly" }))).toEqual({
			display: "flex",
			flexDirection: "row",
			justifyContent: "space-evenly",
		});
	});

	test("gap, align, and justify all together", () => {
		expect(styles(hstack({ gap: 4, align: "center", justify: "between" }))).toEqual({
			display: "flex",
			flexDirection: "row",
			gap: "calc(var(--ui-spacing, 0.25rem) * 4)",
			alignItems: "center",
			justifyContent: "space-between",
		});
	});
});
