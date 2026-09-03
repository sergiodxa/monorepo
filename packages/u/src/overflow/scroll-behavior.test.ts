/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize.js";

import { scrollBehavior } from "./scroll-behavior.js";

describe("scrollBehavior", () => {
	test("no-arg defaults to smooth", async () => {
		expect(await declarations(scrollBehavior())).toEqual(["scroll-behavior: smooth"]);
	});

	test("auto", async () => {
		expect(await declarations(scrollBehavior("auto"))).toEqual(["scroll-behavior: auto"]);
	});
});
