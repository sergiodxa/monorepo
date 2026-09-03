/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { sticky } from "./sticky.js";

describe("sticky", () => {
	test("sets position: sticky", async () => {
		expect(await declarations(sticky())).toEqual(["position: sticky"]);
	});
});
