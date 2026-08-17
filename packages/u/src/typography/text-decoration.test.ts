/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { textDecoration } from "./text-decoration";

describe("textDecoration", () => {
	test("no-arg defaults to underline", async () => {
		expect(await declarations(textDecoration())).toEqual(["text-decoration-line: underline"]);
	});

	test("applies the given text-decoration-line value", async () => {
		expect(await declarations(textDecoration("underline"))).toEqual([
			"text-decoration-line: underline",
		]);
	});

	test("accepts 'none' to remove a decoration", async () => {
		expect(await declarations(textDecoration("none"))).toEqual(["text-decoration-line: none"]);
	});

	test("an options object's line key matches the bare-value form", async () => {
		expect(await declarations(textDecoration({ line: "line-through" }))).toEqual([
			"text-decoration-line: line-through",
		]);
	});

	test("a bare tone color resolves through the token layer's fg default", async () => {
		expect(await declarations(textDecoration({ color: "brand" }))).toEqual([
			"text-decoration-color: var(--ui-brand-fg)",
		]);
	});

	test("an explicit color suffix is respected", async () => {
		expect(await declarations(textDecoration({ color: "danger.muted" }))).toEqual([
			"text-decoration-color: var(--ui-danger-fg-muted)",
		]);
	});

	test("style sets text-decoration-style", async () => {
		expect(await declarations(textDecoration({ style: "wavy" }))).toEqual([
			"text-decoration-style: wavy",
		]);
	});

	test("a numeric thickness is treated as pixels", async () => {
		expect(await declarations(textDecoration({ thickness: 2 }))).toEqual([
			"text-decoration-thickness: 2px",
		]);
	});

	test("a string thickness passes through unchanged", async () => {
		expect(await declarations(textDecoration({ thickness: "from-font" }))).toEqual([
			"text-decoration-thickness: from-font",
		]);
	});

	test("a numeric offset is treated as pixels", async () => {
		expect(await declarations(textDecoration({ offset: 3 }))).toEqual([
			"text-underline-offset: 3px",
		]);
	});

	test("a string offset passes through unchanged", async () => {
		expect(await declarations(textDecoration({ offset: "auto" }))).toEqual([
			"text-underline-offset: auto",
		]);
	});

	test("an options object sets only the given keys", async () => {
		expect(
			await declarations(
				textDecoration({ line: "underline", color: "brand", style: "solid", offset: 3 }),
			),
		).toEqual([
			"text-decoration-line: underline",
			"text-decoration-color: var(--ui-brand-fg)",
			"text-decoration-style: solid",
			"text-underline-offset: 3px",
		]);
	});

	test("an empty options object sets nothing", async () => {
		expect(await declarations(textDecoration({}))).toEqual([]);
	});
});
