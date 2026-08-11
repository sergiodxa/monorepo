/**
 * Unit tests for `mask()` mirroring every mask property onto both the standard
 * and `-webkit-` prefixed spelling, in both its bare-image and options forms.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { declarations } from "../internal/serialize";

import { mask } from "./mask";

describe("mask", () => {
	test("mirrors a gradient onto both the standard and webkit-prefixed properties", async () => {
		expect(await declarations(mask("linear-gradient(to bottom, transparent, black)"))).toEqual([
			"mask-image: linear-gradient(to bottom, transparent, black)",
			"-webkit-mask-image: linear-gradient(to bottom, transparent, black)",
		]);
	});

	test("mirrors a url() reference the same way", async () => {
		expect(await declarations(mask("url(#ring-mask)"))).toEqual([
			"mask-image: url(#ring-mask)",
			"-webkit-mask-image: url(#ring-mask)",
		]);
	});
});

describe("mask options", () => {
	test("an options object with only an image matches the bare-string form", async () => {
		expect(await declarations(mask({ image: "url(#ring-mask)" }))).toEqual(
			await declarations(mask("url(#ring-mask)")),
		);
	});

	test("sets and mirrors every given property", async () => {
		expect(
			await declarations(
				mask({
					image: "url(/badge.png)",
					size: "contain",
					position: "center",
					repeat: "no-repeat",
					mode: "luminance",
				}),
			),
		).toEqual([
			"mask-image: url(/badge.png)",
			"-webkit-mask-image: url(/badge.png)",
			"mask-size: contain",
			"-webkit-mask-size: contain",
			"mask-position: center",
			"-webkit-mask-position: center",
			"mask-repeat: no-repeat",
			"-webkit-mask-repeat: no-repeat",
			"mask-mode: luminance",
			"-webkit-mask-mode: luminance",
		]);
	});

	test("only the given keys are set", async () => {
		expect(await declarations(mask({ size: "24px 24px", repeat: "space" }))).toEqual([
			"mask-size: 24px 24px",
			"-webkit-mask-size: 24px 24px",
			"mask-repeat: space",
			"-webkit-mask-repeat: space",
		]);
	});

	test("an empty options object sets nothing", async () => {
		expect(await declarations(mask({}))).toEqual([]);
	});
});
