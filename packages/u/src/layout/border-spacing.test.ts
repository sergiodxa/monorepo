/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { borderSpacing } from "./border-spacing.js";

describe("borderSpacing", () => {
	test("sets a single-length value", async () => {
		expect(await declarations(borderSpacing("0.5rem"))).toEqual(["border-spacing: 0.5rem"]);
	});

	test("sets a two-length value", async () => {
		expect(await declarations(borderSpacing("0.5rem 1rem"))).toEqual([
			"border-spacing: 0.5rem 1rem",
		]);
	});
});
