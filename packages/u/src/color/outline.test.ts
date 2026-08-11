/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { outline } from "./outline";

describe("outline", () => {
	test("no-arg resolves the system default color, 2px solid, no offset", async () => {
		expect(await declarations(outline())).toEqual([
			"outline-color: var(--ui-ring, Highlight)",
			"outline-width: 2px",
			"outline-style: solid",
		]);
	});

	test("resolves an explicit color, width, style, and offset together", async () => {
		expect(
			await declarations(outline({ color: "danger", width: 3, style: "dashed", offset: 4 })),
		).toEqual([
			"outline-color: var(--ui-danger-ring)",
			"outline-width: 3px",
			"outline-style: dashed",
			"outline-offset: 4px",
		]);
	});

	test("a bare string sets the color", async () => {
		expect(await declarations(outline("danger"))).toEqual([
			"outline-color: var(--ui-danger-ring)",
			"outline-width: 2px",
			"outline-style: solid",
		]);
	});

	test("a bare number sets the width in pixels", async () => {
		expect(await declarations(outline(4))).toEqual([
			"outline-color: var(--ui-ring, Highlight)",
			"outline-width: 4px",
			"outline-style: solid",
		]);
	});

	test("a color and a width together set both", async () => {
		expect(await declarations(outline("danger", 4))).toEqual([
			"outline-color: var(--ui-danger-ring)",
			"outline-width: 4px",
			"outline-style: solid",
		]);
	});

	test("offset accepts a raw CSS length string", async () => {
		expect(await declarations(outline({ offset: "0.25rem" }))).toContain("outline-offset: 0.25rem");
	});

	test("width and offset default to no unit only when given as a raw string", async () => {
		expect(await declarations(outline({ width: "0.125rem" }))).toContain("outline-width: 0.125rem");
	});

	test("'none' short-circuits to a bare outline reset, not a color branch", async () => {
		expect(await declarations(outline("none"))).toEqual(["outline: none"]);
	});
});
