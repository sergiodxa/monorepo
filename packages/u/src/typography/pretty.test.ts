/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { pretty } from "./pretty";

describe("pretty", () => {
	test("applies the pretty text-wrap declaration", async () => {
		expect(await declarations(pretty())).toEqual(["text-wrap: pretty"]);
	});
});
