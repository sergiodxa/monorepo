/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { center } from "./center.js";

describe("center", () => {
	test("sets display: flex with both axes centered", async () => {
		expect(await declarations(center())).toEqual([
			"display: flex",
			"align-items: center",
			"justify-content: center",
		]);
	});
});
