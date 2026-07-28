/**
 * Unit tests for `mask()` mirroring every mask property onto both the standard
 * and `-webkit-` prefixed spelling, in both its bare-image and options forms.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import type { CSSStyles } from "../internal/css-styles";

import { mask } from "./mask";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): CSSStyles {
	return descriptor.args[0] as CSSStyles;
}

describe("mask", () => {
	test("mirrors a gradient onto both the standard and webkit-prefixed properties", () => {
		expect(styles(mask("linear-gradient(to bottom, transparent, black)"))).toEqual({
			maskImage: "linear-gradient(to bottom, transparent, black)",
			WebkitMaskImage: "linear-gradient(to bottom, transparent, black)",
		});
	});

	test("mirrors a url() reference the same way", () => {
		expect(styles(mask("url(#ring-mask)"))).toEqual({
			maskImage: "url(#ring-mask)",
			WebkitMaskImage: "url(#ring-mask)",
		});
	});
});

describe("mask options", () => {
	test("an options object with only an image matches the bare-string form", () => {
		expect(styles(mask({ image: "url(#ring-mask)" }))).toEqual(styles(mask("url(#ring-mask)")));
	});

	test("sets and mirrors every given property", () => {
		expect(
			styles(
				mask({
					image: "url(/badge.png)",
					size: "contain",
					position: "center",
					repeat: "no-repeat",
					mode: "luminance",
				}),
			),
		).toEqual({
			maskImage: "url(/badge.png)",
			WebkitMaskImage: "url(/badge.png)",
			maskSize: "contain",
			WebkitMaskSize: "contain",
			maskPosition: "center",
			WebkitMaskPosition: "center",
			maskRepeat: "no-repeat",
			WebkitMaskRepeat: "no-repeat",
			maskMode: "luminance",
			WebkitMaskMode: "luminance",
		});
	});

	test("only the given keys are set", () => {
		expect(styles(mask({ size: "24px 24px", repeat: "space" }))).toEqual({
			maskSize: "24px 24px",
			WebkitMaskSize: "24px 24px",
			maskRepeat: "space",
			WebkitMaskRepeat: "space",
		});
	});

	test("an empty options object sets nothing", () => {
		expect(styles(mask({}))).toEqual({});
	});
});
