/**
 * Unit tests for `fit()`'s `object-fit` resolution.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { fit } from "./fit";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("fit", () => {
	test("defaults to 'cover'", () => {
		expect(styles(fit())).toEqual({ objectFit: "cover" });
	});

	test("applies an explicit value", () => {
		expect(styles(fit("contain"))).toEqual({ objectFit: "contain" });
	});
});
