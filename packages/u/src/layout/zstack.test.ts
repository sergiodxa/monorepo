/**
 * Unit tests for `zstack()`'s grid-overlay declaration: the `"& > *"` cell
 * assignment must always be present regardless of options, and `justify`
 * must map straight to `justify-items` using the self-alignment keyword set
 * shared with `u.items()`/`u.self()` — NOT the `between`/`around`/`evenly`
 * distribution keywords `u.justify()`/`u.hstack()`/`u.vstack()` use, since
 * `justify-items` positions a grid item within its own cell rather than
 * distributing space along a track.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { zstack } from "./zstack";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("zstack", () => {
	test("no options still stacks every direct child into the same grid cell", () => {
		expect(styles(zstack())).toEqual({
			display: "grid",
			"& > *": { gridArea: "1 / 1" },
		});
	});

	test("align only sets align-items and keeps the cell assignment", () => {
		expect(styles(zstack({ align: "center" }))).toEqual({
			display: "grid",
			alignItems: "center",
			"& > *": { gridArea: "1 / 1" },
		});
	});

	test("justify only sets justify-items using the self-alignment keyword directly, not distribution aliasing", () => {
		expect(styles(zstack({ justify: "start" }))).toEqual({
			display: "grid",
			justifyItems: "start",
			"& > *": { gridArea: "1 / 1" },
		});
	});

	test("justify accepts stretch and baseline, the self-alignment keywords justify-content doesn't", () => {
		expect(styles(zstack({ justify: "stretch" }))).toEqual({
			display: "grid",
			justifyItems: "stretch",
			"& > *": { gridArea: "1 / 1" },
		});

		expect(styles(zstack({ justify: "baseline" }))).toEqual({
			display: "grid",
			justifyItems: "baseline",
			"& > *": { gridArea: "1 / 1" },
		});
	});

	test("align and justify together, plus the cell assignment", () => {
		expect(styles(zstack({ align: "center", justify: "end" }))).toEqual({
			display: "grid",
			alignItems: "center",
			justifyItems: "end",
			"& > *": { gridArea: "1 / 1" },
		});
	});
});
