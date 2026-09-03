/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { fill } from "./fill.js";

describe("fill", () => {
	test("no-arg resolves the system default", async () => {
		expect(await declarations(fill())).toEqual(["fill: var(--ui-fg, CanvasText)"]);
	});

	test("a bare tone defaults to that tone's plain fg weight", async () => {
		expect(await declarations(fill("brand"))).toEqual(["fill: var(--ui-brand-fg)"]);
	});

	test("an explicit tint suffix aliases to the bg-tint property", async () => {
		expect(await declarations(fill("neutral.tint"))).toEqual(["fill: var(--ui-neutral-bg-tint)"]);
	});

	test("'none' passes through literally instead of resolving as a tone name", async () => {
		expect(await declarations(fill("none"))).toEqual(["fill: none"]);
	});
});
