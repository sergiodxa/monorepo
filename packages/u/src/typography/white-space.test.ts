/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { whiteSpace } from "./white-space";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("whiteSpace", () => {
	test("no-arg defaults to pre-wrap", () => {
		expect(styles(whiteSpace())).toEqual({ whiteSpace: "pre-wrap" });
	});

	test("normal", () => {
		expect(styles(whiteSpace("normal"))).toEqual({ whiteSpace: "normal" });
	});

	test("nowrap", () => {
		expect(styles(whiteSpace("nowrap"))).toEqual({ whiteSpace: "nowrap" });
	});

	test("pre", () => {
		expect(styles(whiteSpace("pre"))).toEqual({ whiteSpace: "pre" });
	});

	test("pre-wrap", () => {
		expect(styles(whiteSpace("pre-wrap"))).toEqual({ whiteSpace: "pre-wrap" });
	});

	test("pre-line", () => {
		expect(styles(whiteSpace("pre-line"))).toEqual({ whiteSpace: "pre-line" });
	});

	test("break-spaces", () => {
		expect(styles(whiteSpace("break-spaces"))).toEqual({ whiteSpace: "break-spaces" });
	});
});
