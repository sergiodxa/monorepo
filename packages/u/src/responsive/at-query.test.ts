/**
 * Unit tests for `at-query.ts`, the literal-escape-hatch container-query
 * wrapper.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { p } from "../size/p";

import { atQuery } from "./at-query";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("atQuery", () => {
	test("nests the wrapped utility's styles under the literal query, unwrapped", () => {
		expect(styles(atQuery("(min-width: 40rem)", p(4)))).toEqual({
			"@container (min-width: 40rem)": {
				padding: "calc(var(--ui-spacing, 0.25rem) * 4)",
			},
		});
	});

	test("never wraps the literal length in var(--ui-container-*, ...)", () => {
		let result = styles(atQuery("(min-width: 40rem)", p(4)));
		expect(JSON.stringify(result)).not.toContain("var(--ui-container-");
	});

	test("passes a named-container segment through verbatim alongside the literal length", () => {
		expect(styles(atQuery("sidebar (min-width: 40rem)", p(4)))).toEqual({
			"@container sidebar (min-width: 40rem)": {
				padding: "calc(var(--ui-spacing, 0.25rem) * 4)",
			},
		});
	});
});
