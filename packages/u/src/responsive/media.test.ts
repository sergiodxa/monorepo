/**
 * Unit tests for `media.ts`, the raw viewport/feature media-query escape hatch.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { border } from "../color/border";

import { media } from "./media";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("media", () => {
	test("nests the wrapped utility's styles under '@media <query>'", () => {
		expect(styles(media("(prefers-contrast: more)", border("brand.strong")))).toEqual({
			"@media (prefers-contrast: more)": { borderColor: "var(--ui-brand-border-strong)" },
		});
	});
});
