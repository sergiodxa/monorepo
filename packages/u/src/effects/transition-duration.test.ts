/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { declarations } from "../internal/serialize";

import { transitionDuration } from "./transition-duration";

describe("transitionDuration", () => {
	test("sets only transition-duration", async () => {
		expect(await declarations(transitionDuration("0s"))).toEqual(["transition-duration: 0s"]);
	});

	test("passes through an arbitrary duration string unchanged", async () => {
		expect(await declarations(transitionDuration("300ms"))).toEqual(["transition-duration: 300ms"]);
	});
});
