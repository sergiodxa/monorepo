/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { stroke } from "./stroke";

describe("stroke", () => {
	test("no-arg resolves the system default", async () => {
		expect(await declarations(stroke())).toEqual(["stroke: var(--ui-fg, CanvasText)"]);
	});

	test("a bare tone defaults to that tone's plain fg weight", async () => {
		expect(await declarations(stroke("brand"))).toEqual(["stroke: var(--ui-brand-fg)"]);
	});

	test("an explicit tint suffix aliases to the bg-tint property", async () => {
		expect(await declarations(stroke("neutral.tint"))).toEqual([
			"stroke: var(--ui-neutral-bg-tint)",
		]);
	});

	test("'none' passes through literally instead of resolving as a tone name", async () => {
		expect(await declarations(stroke("none"))).toEqual(["stroke: none"]);
	});
});
