/**
 * Type-level checks for `MergePatchOf`: which patches a client may write for a resource.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expectTypeOf, test } from "vitest";

import type { MergePatchOf } from "./merge-patch-of.js";

interface Subject {
	email: string;
	displayName?: string;
	profile: { locale: string; avatarUrl?: string };
	roles: string[];
}

describe("MergePatchOf", () => {
	test("makes every member optional and nullable only where the member is optional", () => {
		expectTypeOf<{ displayName: null }>().toExtend<MergePatchOf<Subject>>();
		expectTypeOf<{ profile: { avatarUrl: null } }>().toExtend<MergePatchOf<Subject>>();
		expectTypeOf<{}>().toExtend<MergePatchOf<Subject>>();
		expectTypeOf<{ email: null }>().not.toExtend<MergePatchOf<Subject>>();
		expectTypeOf<{ profile: { locale: null } }>().not.toExtend<MergePatchOf<Subject>>();
	});

	test("replaces arrays whole", () => {
		expectTypeOf<{ roles: string[] }>().toExtend<MergePatchOf<Subject>>();
		expectTypeOf<{ roles: number[] }>().not.toExtend<MergePatchOf<Subject>>();
	});
});
