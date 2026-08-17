/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { colorScheme } from "./color-scheme";

describe("colorScheme", () => {
	test("defaults to supporting both schemes", async () => {
		expect(await declarations(colorScheme())).toEqual(["color-scheme: light dark"]);
	});

	test("light forces light native chrome", async () => {
		expect(await declarations(colorScheme("light"))).toEqual(["color-scheme: light"]);
	});

	test("dark forces dark native chrome", async () => {
		expect(await declarations(colorScheme("dark"))).toEqual(["color-scheme: dark"]);
	});

	test("light dark supports both, preferring light when unspecified", async () => {
		expect(await declarations(colorScheme("light dark"))).toEqual(["color-scheme: light dark"]);
	});

	test("dark light supports both, preferring dark when unspecified", async () => {
		expect(await declarations(colorScheme("dark light"))).toEqual(["color-scheme: dark light"]);
	});

	test("normal declares no scheme at all", async () => {
		expect(await declarations(colorScheme("normal"))).toEqual(["color-scheme: normal"]);
	});

	test("only light opts out of automatic dark-mode adjustments", async () => {
		expect(await declarations(colorScheme("only light"))).toEqual(["color-scheme: only light"]);
	});

	test("only dark pins the dark scheme", async () => {
		expect(await declarations(colorScheme("only dark"))).toEqual(["color-scheme: only dark"]);
	});

	test("a raw string passes through unchanged", async () => {
		expect(await declarations(colorScheme("only dark light"))).toEqual([
			"color-scheme: only dark light",
		]);
	});
});
