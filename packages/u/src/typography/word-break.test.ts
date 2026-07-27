/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { wordBreak } from "./word-break";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("wordBreak", () => {
	test("no-arg defaults to normal", () => {
		expect(styles(wordBreak())).toEqual({ wordBreak: "normal" });
	});

	test("break-all", () => {
		expect(styles(wordBreak("break-all"))).toEqual({ wordBreak: "break-all" });
	});

	test("keep-all", () => {
		expect(styles(wordBreak("keep-all"))).toEqual({ wordBreak: "keep-all" });
	});

	test("break-word", () => {
		expect(styles(wordBreak("break-word"))).toEqual({ wordBreak: "break-word" });
	});
});
