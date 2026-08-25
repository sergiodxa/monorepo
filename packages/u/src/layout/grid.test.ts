/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { grid } from "./grid";

describe("grid", () => {
	test("sets display: grid", async () => {
		expect(await declarations(grid())).toEqual(["display: grid"]);
	});
});
