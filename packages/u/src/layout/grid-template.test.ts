/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { gridTemplate } from "./grid-template";

describe("gridTemplate", () => {
	test("no-arg sets nothing", async () => {
		expect(await declarations(gridTemplate())).toEqual([]);
	});

	test("columns alone", async () => {
		expect(await declarations(gridTemplate({ columns: "1fr 2fr" }))).toEqual([
			"grid-template-columns: 1fr 2fr",
		]);
	});

	test("rows alone", async () => {
		expect(await declarations(gridTemplate({ rows: "auto 1fr" }))).toEqual([
			"grid-template-rows: auto 1fr",
		]);
	});

	test("areas alone", async () => {
		expect(await declarations(gridTemplate({ areas: '"header header" "sidebar main"' }))).toEqual([
			'grid-template-areas: "header header" "sidebar main"',
		]);
	});

	test("columns and rows together", async () => {
		expect(await declarations(gridTemplate({ columns: "1fr 2fr", rows: "auto 1fr" }))).toEqual([
			"grid-template-columns: 1fr 2fr",
			"grid-template-rows: auto 1fr",
		]);
	});

	test("all three keys together", async () => {
		expect(
			await declarations(
				gridTemplate({
					columns: "1fr 1fr",
					rows: "auto",
					areas: '"a b"',
				}),
			),
		).toEqual([
			"grid-template-columns: 1fr 1fr",
			"grid-template-rows: auto",
			'grid-template-areas: "a b"',
		]);
	});
});
