/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { container } from "./container.js";

describe("container", () => {
	test("defaults to an inline-size container type", async () => {
		expect(await declarations(container("sidebar"))).toEqual(["container: sidebar / inline-size"]);
	});

	test("an explicit container type", async () => {
		expect(await declarations(container("sidebar", "size"))).toEqual(["container: sidebar / size"]);
	});
});
