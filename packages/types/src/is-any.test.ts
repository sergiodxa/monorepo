/**
 * Type-level tests for the `any` detector: it answers `true` for `any` alone,
 * and `false` for `unknown`, `never` and every concrete type, which is the
 * distinction a conditional type needs when a value arrives untyped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expectTypeOf, test } from "vitest";

import type { IsAny } from "./is-any.js";

describe("IsAny", () => {
	test("answers true for any", () => {
		expectTypeOf<IsAny<any>>().toEqualTypeOf<true>();
	});

	test("answers false for the types any is mistaken for", () => {
		expectTypeOf<IsAny<unknown>>().toEqualTypeOf<false>();
		expectTypeOf<IsAny<never>>().toEqualTypeOf<false>();
		expectTypeOf<IsAny<object>>().toEqualTypeOf<false>();
	});

	test("answers false for a concrete type", () => {
		expectTypeOf<IsAny<string>>().toEqualTypeOf<false>();
		expectTypeOf<IsAny<string | number>>().toEqualTypeOf<false>();
	});

	test("branches a conditional type on an untyped value", () => {
		type Parsed<T> = IsAny<T> extends true ? unknown : T;

		expectTypeOf<Parsed<any>>().toEqualTypeOf<unknown>();
		expectTypeOf<Parsed<{ id: number }>>().toEqualTypeOf<{ id: number }>();
	});
});
