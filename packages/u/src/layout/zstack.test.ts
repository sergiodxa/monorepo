/**
 * Unit tests for `zstack()`'s grid-overlay CSS: the `"& > *"` cell assignment
 * must always be present in the emitted stylesheet regardless of options, and
 * `justify` must map straight to `justify-items` using the self-alignment
 * keyword set shared with `u.items()`/`u.self()` — NOT the
 * `between`/`around`/`evenly` distribution keywords
 * `u.justify()`/`u.hstack()`/`u.vstack()` use, since `justify-items` positions
 * a grid item within its own cell rather than distributing space along a
 * track.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { UtilityMixin } from "../internal/descriptor";

import { declarations, serialize } from "../internal/serialize";

import { zstack } from "./zstack";

/**
 * The serialized stylesheet with its indentation collapsed, so the nested
 * `& > *` block can be matched as a single string. The nested selector is the
 * point of this mixin, so it has to be asserted on the full text rather than
 * on the flattened declaration list.
 */
async function stylesheet(mixin: UtilityMixin): Promise<string> {
	return (await serialize(mixin)).replace(/\s+/g, " ");
}

/** The `& > *` block every `zstack()` variant must emit, once normalized. */
const OVERLAY = "& > * { grid-area: 1 / 1; }";

describe("zstack", () => {
	test("no options still stacks every direct child into the same grid cell", async () => {
		expect(await declarations(zstack())).toEqual(["display: grid", "grid-area: 1 / 1"]);
		expect(await stylesheet(zstack())).toContain(OVERLAY);
	});

	test("align only sets align-items and keeps the cell assignment", async () => {
		expect(await declarations(zstack({ align: "center" }))).toEqual([
			"display: grid",
			"align-items: center",
			"grid-area: 1 / 1",
		]);
		expect(await stylesheet(zstack({ align: "center" }))).toContain(OVERLAY);
	});

	test("justify only sets justify-items using the self-alignment keyword directly, not distribution aliasing", async () => {
		expect(await declarations(zstack({ justify: "start" }))).toEqual([
			"display: grid",
			"justify-items: start",
			"grid-area: 1 / 1",
		]);
		expect(await stylesheet(zstack({ justify: "start" }))).toContain(OVERLAY);
	});

	test("justify accepts stretch and baseline, the self-alignment keywords justify-content doesn't", async () => {
		expect(await declarations(zstack({ justify: "stretch" }))).toEqual([
			"display: grid",
			"justify-items: stretch",
			"grid-area: 1 / 1",
		]);
		expect(await stylesheet(zstack({ justify: "stretch" }))).toContain(OVERLAY);

		expect(await declarations(zstack({ justify: "baseline" }))).toEqual([
			"display: grid",
			"justify-items: baseline",
			"grid-area: 1 / 1",
		]);
		expect(await stylesheet(zstack({ justify: "baseline" }))).toContain(OVERLAY);
	});

	test("align and justify together, plus the cell assignment", async () => {
		expect(await declarations(zstack({ align: "center", justify: "end" }))).toEqual([
			"display: grid",
			"align-items: center",
			"justify-items: end",
			"grid-area: 1 / 1",
		]);
		expect(await stylesheet(zstack({ align: "center", justify: "end" }))).toContain(OVERLAY);
	});
});
