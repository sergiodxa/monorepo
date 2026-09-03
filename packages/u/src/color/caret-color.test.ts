/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { caretColor } from "./caret-color.js";

describe("caretColor", () => {
	test("with no value it emits CSS's own auto default", async () => {
		expect(await declarations(caretColor())).toEqual(["caret-color: auto"]);
	});

	test("a bare tone resolves that tone's plain foreground weight", async () => {
		expect(await declarations(caretColor("brand"))).toEqual(["caret-color: var(--ui-brand-fg)"]);
	});

	test("an explicit suffix resolves through the alias table", async () => {
		expect(await declarations(caretColor("brand.emphasis"))).toEqual([
			"caret-color: var(--ui-brand-fg-emphasis)",
		]);
	});

	test("a raw palette reference resolves to its palette variable", async () => {
		expect(await declarations(caretColor("color.neutral.50"))).toEqual([
			"caret-color: var(--ui-color-neutral-50)",
		]);
	});

	test("transparent passes through as a CSS keyword", async () => {
		expect(await declarations(caretColor("transparent"))).toEqual(["caret-color: transparent"]);
	});
});
