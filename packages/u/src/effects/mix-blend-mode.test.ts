/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { mixBlendMode } from "./mix-blend-mode";

describe("mixBlendMode", () => {
	test("no-arg defaults to multiply", async () => {
		expect(await declarations(mixBlendMode())).toEqual(["mix-blend-mode: multiply"]);
	});

	test("an explicit separable blend mode", async () => {
		expect(await declarations(mixBlendMode("screen"))).toEqual(["mix-blend-mode: screen"]);
	});

	test("a non-separable blend mode", async () => {
		expect(await declarations(mixBlendMode("luminosity"))).toEqual(["mix-blend-mode: luminosity"]);
	});

	test("a plus-* compositing mode", async () => {
		expect(await declarations(mixBlendMode("plus-lighter"))).toEqual([
			"mix-blend-mode: plus-lighter",
		]);
	});

	test("normal, the value that opts back out of blending", async () => {
		expect(await declarations(mixBlendMode("normal"))).toEqual(["mix-blend-mode: normal"]);
	});
});
