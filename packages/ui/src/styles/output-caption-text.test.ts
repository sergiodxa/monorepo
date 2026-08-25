import type { CSSMixinDescriptor } from "remix/ui";

/**
 * Covers `outputCaptionText()` as pure `css()` output: the exact property set
 * and values every `<output>` live readout host composes into its `mix`
 * array.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { outputCaptionText } from "./output-caption-text";

function styles(mixin: CSSMixinDescriptor): Record<string, unknown> {
	return mixin.args[0] as Record<string, unknown>;
}

describe("outputCaptionText", () => {
	test("is a 0.875rem run of text at a 1.25-to-0.875 line height, colored the neutral muted foreground", () => {
		expect(styles(outputCaptionText())).toEqual({
			fontSize: "var(--ui-text-sm, 0.875rem)",
			lineHeight: "var(--ui-leading-sm, calc(1.25 / 0.875))",
			color: "var(--ui-neutral-fg)",
		});
	});

	test("carries exactly the three typography properties, nothing else", () => {
		expect(Object.keys(styles(outputCaptionText())).sort()).toEqual(
			["color", "fontSize", "lineHeight"].sort(),
		);
	});

	test("takes no options", () => {
		expect(outputCaptionText.length).toBe(0);
	});
});
