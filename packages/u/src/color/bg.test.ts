/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { bg } from "./bg";

describe("bg", () => {
	test("no-arg resolves the system default", async () => {
		expect(await declarations(bg())).toEqual(["background-color: var(--ui-bg, Canvas)"]);
	});

	test("a semantic tone with an explicit tint suffix", async () => {
		expect(await declarations(bg("brand.tint"))).toEqual([
			"background-color: var(--ui-brand-bg-tint)",
		]);
	});

	test("a semantic tone with an explicit solid suffix", async () => {
		expect(await declarations(bg("brand.solid"))).toEqual([
			"background-color: var(--ui-brand-bg-solid)",
		]);
	});

	test("a raw palette reference", async () => {
		expect(await declarations(bg("color.neutral.50"))).toEqual([
			"background-color: var(--ui-color-neutral-50)",
		]);
	});

	test("an options object sets only the given background properties", async () => {
		expect(
			await declarations(bg({ image: "url(/hero.jpg)", size: "cover", position: "center" })),
		).toEqual([
			"background-image: url(/hero.jpg)",
			"background-size: cover",
			"background-position: center",
		]);
	});

	test("an options object's color key resolves the same way the bare-value form does", async () => {
		expect(await declarations(bg({ color: "brand.tint" }))).toEqual([
			"background-color: var(--ui-brand-bg-tint)",
		]);
	});

	test("an options object can set repeat and attachment too", async () => {
		expect(await declarations(bg({ repeat: "no-repeat", attachment: "fixed" }))).toEqual([
			"background-repeat: no-repeat",
			"background-attachment: fixed",
		]);
	});

	test("clip sets background-clip", async () => {
		expect(await declarations(bg({ clip: "content-box" }))).toEqual([
			"background-clip: content-box",
		]);
	});

	test("clip combines with the other keys, and 'text' clips to the glyphs", async () => {
		expect(
			await declarations(
				bg({ image: "linear-gradient(to right, red, blue)", clip: "text", color: "transparent" }),
			),
		).toEqual([
			"background-color: transparent",
			"background-image: linear-gradient(to right, red, blue)",
			"background-clip: text",
		]);
	});
});
