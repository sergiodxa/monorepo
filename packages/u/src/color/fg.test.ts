/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { fg } from "./fg.js";

describe("fg", () => {
	test("no-arg resolves the system default", async () => {
		expect(await declarations(fg())).toEqual(["color: var(--ui-fg, CanvasText)"]);
	});

	test("a named or hex color passes through instead of resolving as a tone", async () => {
		expect(await declarations(fg("red"))).toEqual(["color: red"]);
		expect(await declarations(fg("#333"))).toEqual(["color: #333"]);
	});

	test("a bare tone defaults to that tone's plain fg weight", async () => {
		expect(await declarations(fg("brand"))).toEqual(["color: var(--ui-brand-fg)"]);
	});

	test("an explicit muted suffix", async () => {
		expect(await declarations(fg("brand.muted"))).toEqual(["color: var(--ui-brand-fg-muted)"]);
	});

	test("an explicit emphasis suffix", async () => {
		expect(await declarations(fg("brand.emphasis"))).toEqual([
			"color: var(--ui-brand-fg-emphasis)",
		]);
	});
});
