/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { overscrollBehavior } from "./overscroll-behavior";

describe("overscrollBehavior", () => {
	test("no-arg defaults to contain", async () => {
		expect(await declarations(overscrollBehavior())).toEqual(["overscroll-behavior: contain"]);
	});

	test("none", async () => {
		expect(await declarations(overscrollBehavior("none"))).toEqual(["overscroll-behavior: none"]);
	});

	test("auto", async () => {
		expect(await declarations(overscrollBehavior("auto"))).toEqual(["overscroll-behavior: auto"]);
	});
});
