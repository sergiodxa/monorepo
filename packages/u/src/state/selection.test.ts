/**
 * Unit tests for `selection.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { bg } from "../color/bg";
import { declarations, serialize } from "../internal/serialize";

import { selection } from "./selection";

describe("selection", () => {
	test("emits an '&::selection' block around the input's declarations", async () => {
		expect(await serialize(selection(bg("brand.solid")))).toContain("&::selection {");
		expect(await declarations(selection(bg("brand.solid")))).toEqual([
			"background-color: var(--ui-brand-bg-solid)",
		]);
	});
});
