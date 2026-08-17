/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { borderEdge } from "./border-edge";

describe("borderEdge", () => {
	test("a numeric width defaults style to solid, on the inline-start edge", async () => {
		expect(await declarations(borderEdge("inline-start", { width: 1 }))).toEqual([
			"border-inline-start-width: 1px",
			"border-inline-start-style: solid",
		]);
	});

	test("the inline-end edge", async () => {
		expect(await declarations(borderEdge("inline-end", { width: 1 }))).toEqual([
			"border-inline-end-width: 1px",
			"border-inline-end-style: solid",
		]);
	});

	test("an explicit style overrides the solid default", async () => {
		expect(await declarations(borderEdge("block-start", { width: 1, style: "dashed" }))).toEqual([
			"border-block-start-width: 1px",
			"border-block-start-style: dashed",
		]);
	});

	test("a color resolves through the border property alias", async () => {
		expect(await declarations(borderEdge("block-end", { color: "brand" }))).toEqual([
			"border-block-end-color: var(--ui-brand-border)",
		]);
	});

	test("only sets the given keys", async () => {
		expect(await declarations(borderEdge("inline-start", {}))).toEqual([]);
	});

	test("accepts a physical edge, pinned regardless of writing mode", async () => {
		expect(
			await declarations(borderEdge("right", { width: 1, style: "solid", color: "neutral" })),
		).toEqual([
			"border-right-color: var(--ui-neutral-border)",
			"border-right-width: 1px",
			"border-right-style: solid",
		]);
	});

	test("width alone still defaults style to solid when noStyleDefault is absent", async () => {
		expect(await declarations(borderEdge("inline-start", { width: 2 }))).toEqual([
			"border-inline-start-width: 2px",
			"border-inline-start-style: solid",
		]);
	});

	test("noStyleDefault suppresses the solid default, leaving width-only output", async () => {
		expect(
			await declarations(borderEdge("inline-start", { width: 2, noStyleDefault: true })),
		).toEqual(["border-inline-start-width: 2px"]);
	});

	test("noStyleDefault has no effect when style is also given explicitly", async () => {
		expect(
			await declarations(
				borderEdge("block-start", { width: 2, style: "dashed", noStyleDefault: true }),
			),
		).toEqual(["border-block-start-width: 2px", "border-block-start-style: dashed"]);
	});
});
