/**
 * Type-level tests for the resolved-type helper: it unwraps one promise from an
 * async function's return type, reaches through indexed access into the value,
 * and keeps a generic function's inference intact.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expectTypeOf, test } from "vitest";

import type { ResolvedType } from "./resolved-type.js";

declare function fetchUser(id: string): Promise<{ name: string; email: string }>;
declare function listPosts(): Promise<{ posts: Array<{ id: number; title: string }> }>;
declare function load(): Promise<Promise<number>>;

describe("ResolvedType", () => {
	test("names the value an async function resolves to", () => {
		expectTypeOf<ResolvedType<typeof fetchUser>>().toEqualTypeOf<{
			name: string;
			email: string;
		}>();
	});

	test("reaches a single item through indexed access", () => {
		expectTypeOf<ResolvedType<typeof listPosts>["posts"][number]>().toEqualTypeOf<{
			id: number;
			title: string;
		}>();
	});

	test("unwraps a nested promise, matching what await returns", () => {
		expectTypeOf<ResolvedType<typeof load>>().toEqualTypeOf<number>();
	});
});
