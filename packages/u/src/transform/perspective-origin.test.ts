/**
 * Unit tests for `perspectiveOrigin()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { perspectiveOrigin } from "./perspective-origin";

describe("perspectiveOrigin", () => {
	test("defaults to center", async () => {
		expect(await declarations(perspectiveOrigin())).toEqual(["perspective-origin: center"]);
	});

	test("accepts a single edge keyword", async () => {
		expect(await declarations(perspectiveOrigin("top"))).toEqual(["perspective-origin: top"]);
	});

	test("accepts a two-keyword corner", async () => {
		expect(await declarations(perspectiveOrigin("top left"))).toEqual([
			"perspective-origin: top left",
		]);
	});

	test("passes a percentage pair through unchanged", async () => {
		expect(await declarations(perspectiveOrigin("25% 75%"))).toEqual([
			"perspective-origin: 25% 75%",
		]);
	});

	test("passes a custom property reference through unchanged", async () => {
		expect(await declarations(perspectiveOrigin("var(--ui-origin)"))).toEqual([
			"perspective-origin: var(--ui-origin)",
		]);
	});
});
