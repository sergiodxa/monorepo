/**
 * Verifies `zstack()` always emits the `"& > *"` cell assignment regardless
 * of options, and that `justify` maps to `justify-items` using the same
 * self-alignment keywords `align-items` takes, since `justify-items`
 * positions each grid item within its own cell.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import type { UtilityMixin } from "../internal/descriptor.js";

import { declarations, serialize } from "../internal/serialize.js";

import { zstack } from "./zstack.js";

/**
 * Collapses indentation so the nested `& > *` block matches as a single
 * string. The full serialized stylesheet preserves this mixin's nested
 * selector, so tests assert against it directly.
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
