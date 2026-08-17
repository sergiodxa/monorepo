/**
 * Tests for the named policies.
 *
 * Each one is pinned to its exact header value: these are the short answers call
 * sites reach for, so a policy quietly gaining `public` or losing `private` would
 * expose one client's response to another through a shared cache.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { Policies } from "./policies";

describe(Policies, () => {
	describe(Policies.noStore.name, () => {
		test("keeps the response out of every cache", () => {
			expect(Policies.noStore().toString()).toBe("no-store");
		});
	});

	describe(Policies.private.name, () => {
		test("stores only in the client's own cache, for the given age", () => {
			expect(Policies.private({ maxAge: "5 minutes" }).toString()).toBe("private, max-age=300");
		});

		test("never emits public", () => {
			expect(Policies.private({ maxAge: "1 hour" }).public).toBeUndefined();
		});
	});

	describe(Policies.immutable.name, () => {
		test("is public for a year and skips revalidation", () => {
			expect(Policies.immutable().toString()).toBe("public, max-age=31536000, immutable");
		});
	});

	describe(Policies.revalidate.name, () => {
		test("revalidates every reuse and stays out of shared caches", () => {
			expect(Policies.revalidate().toString()).toBe("private, no-cache");
		});

		test("never emits public, since it is the policy for authenticated content", () => {
			expect(Policies.revalidate().public).toBeUndefined();
		});
	});
});
