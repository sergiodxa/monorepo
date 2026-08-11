/**
 * Unit tests for `detailsContent()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations, serialize } from "../internal/serialize";
import { overflow } from "../overflow/overflow";
import { bs } from "../size/bs";

import { detailsContent } from "./details-content";

describe("detailsContent", () => {
	test("emits an '&::details-content' block holding the merged input", async () => {
		expect(await serialize(detailsContent([overflow("clip"), bs(0)]))).toContain(
			"&::details-content {",
		);
		expect(await declarations(detailsContent([overflow("clip"), bs(0)]))).toEqual([
			"overflow: clip",
			"block-size: calc(var(--ui-spacing, 0.25rem) * 0)",
		]);
	});
});
