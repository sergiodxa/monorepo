/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { visuallyHidden } from "./visually-hidden";

describe("visuallyHidden", () => {
	test("emits the full fixed nine-declaration clipping recipe", async () => {
		expect(await declarations(visuallyHidden())).toEqual([
			"position: absolute",
			"inline-size: 1px",
			"block-size: 1px",
			"padding: 0",
			"margin: -1px",
			"overflow: hidden",
			"clip: rect(0, 0, 0, 0)",
			"white-space: nowrap",
			"border-width: 0",
		]);
	});
});
