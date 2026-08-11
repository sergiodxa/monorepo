/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { clip } from "./clip";

describe("clip", () => {
	test("sets overflow: clip", async () => {
		expect(await declarations(clip())).toEqual(["overflow: clip"]);
	});
});
