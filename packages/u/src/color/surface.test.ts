/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { surface } from "./surface";

describe("surface", () => {
	test("default recipe uses the system bg/fg/border trio", async () => {
		expect(await declarations(surface())).toEqual([
			"background-color: var(--ui-bg, Canvas)",
			"color: var(--ui-fg, CanvasText)",
			"border-color: var(--ui-border, color-mix(in oklab, CanvasText 16%, transparent))",
		]);
	});

	test("muted recipe uses the neutral tone", async () => {
		expect(await declarations(surface("muted"))).toEqual([
			"background-color: var(--ui-neutral-bg-tint)",
			"color: var(--ui-neutral-fg)",
			"border-color: var(--ui-neutral-border)",
		]);
	});

	test("a bare tone resolves the solid recipe", async () => {
		expect(await declarations(surface("brand"))).toEqual([
			"background-color: var(--ui-brand-bg-solid)",
			"color: var(--ui-brand-fg-on-solid)",
			"border-color: var(--ui-brand-bg-solid)",
		]);
	});

	test("a tinted brand recipe", async () => {
		expect(await declarations(surface("brand.tinted"))).toEqual([
			"background-color: var(--ui-brand-bg-tint)",
			"color: var(--ui-brand-fg-emphasis)",
			"border-color: var(--ui-brand-border)",
		]);
	});

	test("a tinted danger recipe", async () => {
		expect(await declarations(surface("danger.tinted"))).toEqual([
			"background-color: var(--ui-danger-bg-tint)",
			"color: var(--ui-danger-fg-emphasis)",
			"border-color: var(--ui-danger-border)",
		]);
	});
});
