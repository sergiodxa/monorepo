/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import type { CSSMixinDescriptor } from "remix/ui";

import { colorScheme } from "./color-scheme";

/** Unwraps a utility mixin back to the style tree it was built from. */
function styles(descriptor: CSSMixinDescriptor): Record<string, unknown> {
	return descriptor.args[0] as Record<string, unknown>;
}

describe("colorScheme", () => {
	test("defaults to supporting both schemes", () => {
		expect(styles(colorScheme())).toEqual({ colorScheme: "light dark" });
	});

	test("light forces light native chrome", () => {
		expect(styles(colorScheme("light"))).toEqual({ colorScheme: "light" });
	});

	test("dark forces dark native chrome", () => {
		expect(styles(colorScheme("dark"))).toEqual({ colorScheme: "dark" });
	});

	test("light dark supports both, preferring light when unspecified", () => {
		expect(styles(colorScheme("light dark"))).toEqual({ colorScheme: "light dark" });
	});

	test("dark light supports both, preferring dark when unspecified", () => {
		expect(styles(colorScheme("dark light"))).toEqual({ colorScheme: "dark light" });
	});

	test("normal declares no scheme at all", () => {
		expect(styles(colorScheme("normal"))).toEqual({ colorScheme: "normal" });
	});

	test("only light opts out of automatic dark-mode adjustments", () => {
		expect(styles(colorScheme("only light"))).toEqual({ colorScheme: "only light" });
	});

	test("only dark pins the dark scheme", () => {
		expect(styles(colorScheme("only dark"))).toEqual({ colorScheme: "only dark" });
	});

	test("a raw string passes through unchanged", () => {
		expect(styles(colorScheme("only dark light"))).toEqual({ colorScheme: "only dark light" });
	});
});
