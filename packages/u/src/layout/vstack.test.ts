/**
 * Unit tests for `vstack()`'s base flex-column declaration plus its
 * optional `gap`/`align`/`justify` composition, including the
 * `between`/`around`/`evenly` aliasing `u.justify()` applies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { vstack } from "./vstack";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("vstack", () => {
	test("no options sets only display and flex-direction", () => {
		expect(styles(vstack())).toEqual({ display: "flex", flexDirection: "column" });
	});

	test("gap only", () => {
		expect(styles(vstack({ gap: 4 }))).toEqual({
			display: "flex",
			flexDirection: "column",
			gap: "calc(var(--ui-spacing, 0.25rem) * 4)",
		});
	});

	test("align only", () => {
		expect(styles(vstack({ align: "stretch" }))).toEqual({
			display: "flex",
			flexDirection: "column",
			alignItems: "stretch",
		});
	});

	test("justify only, plain keyword", () => {
		expect(styles(vstack({ justify: "center" }))).toEqual({
			display: "flex",
			flexDirection: "column",
			justifyContent: "center",
		});
	});

	test("justify only, aliasing between to space-between", () => {
		expect(styles(vstack({ justify: "between" }))).toEqual({
			display: "flex",
			flexDirection: "column",
			justifyContent: "space-between",
		});
	});

	test("justify only, aliasing around to space-around", () => {
		expect(styles(vstack({ justify: "around" }))).toEqual({
			display: "flex",
			flexDirection: "column",
			justifyContent: "space-around",
		});
	});

	test("justify only, aliasing evenly to space-evenly", () => {
		expect(styles(vstack({ justify: "evenly" }))).toEqual({
			display: "flex",
			flexDirection: "column",
			justifyContent: "space-evenly",
		});
	});

	test("gap, align, and justify all together", () => {
		expect(styles(vstack({ gap: 2, align: "center", justify: "evenly" }))).toEqual({
			display: "flex",
			flexDirection: "column",
			gap: "calc(var(--ui-spacing, 0.25rem) * 2)",
			alignItems: "center",
			justifyContent: "space-evenly",
		});
	});
});
