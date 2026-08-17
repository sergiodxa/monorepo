/**
 * Unit tests for `thinScrollbar()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { thinScrollbar } from "./thin-scrollbar";

describe("thinScrollbar", () => {
	test("requests a thin, layout-stable scrollbar", async () => {
		expect(await declarations(thinScrollbar())).toEqual([
			"scrollbar-width: thin",
			"scrollbar-gutter: stable",
		]);
	});
});
