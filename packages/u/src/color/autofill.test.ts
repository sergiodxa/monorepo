/**
 * Unit tests for `autofill()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations, serialize } from "../internal/serialize";

import { autofill } from "./autofill";

describe("autofill", () => {
	test("defaults to the system background/foreground tokens, nested under &:-webkit-autofill", async () => {
		expect(await serialize(autofill())).toContain("&:-webkit-autofill");
		expect(await declarations(autofill())).toEqual([
			"box-shadow: 0 0 0 1000px var(--ui-bg, Canvas) inset !important",
			"-webkit-box-shadow: 0 0 0 1000px var(--ui-bg, Canvas) inset !important",
			"-webkit-text-fill-color: var(--ui-fg, CanvasText) !important",
		]);
	});

	test("resolves explicit background and foreground tones", async () => {
		expect(await serialize(autofill("neutral.tint", "neutral"))).toContain("&:-webkit-autofill");
		expect(await declarations(autofill("neutral.tint", "neutral"))).toEqual([
			"box-shadow: 0 0 0 1000px var(--ui-neutral-bg-tint) inset !important",
			"-webkit-box-shadow: 0 0 0 1000px var(--ui-neutral-bg-tint) inset !important",
			"-webkit-text-fill-color: var(--ui-neutral-fg) !important",
		]);
	});
});
