/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { block } from "./block";

describe("block", () => {
	test("sets display: block", async () => {
		expect(await declarations(block())).toEqual(["display: block"]);
	});
});
