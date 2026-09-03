/**
 * Tests for `policy()`.
 *
 * The serialized output is asserted directly, because these strings are what an
 * edge cache reads to decide whether a request reaches the origin at all, and a
 * missing or extra directive changes that decision rather than just a hint.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { CacheControl } from "remix/headers";
import { describe, expect, test } from "vitest";

import { policy } from "./policy.js";

describe(policy, () => {
	test("returns a framework CacheControl so it composes with remix/headers", () => {
		expect(policy({ visibility: "public", maxAge: "1 hour" })).toBeInstanceOf(CacheControl);
	});

	test("emits nothing when no options are given", () => {
		expect(policy().toString()).toBe("");
	});

	test("never defaults to public", () => {
		expect(policy({ maxAge: "1 hour" }).toString()).toBe("max-age=3600");
	});

	test("spells out public visibility", () => {
		expect(policy({ visibility: "public", maxAge: "1 hour" }).toString()).toBe(
			"public, max-age=3600",
		);
	});

	test("spells out private visibility", () => {
		expect(policy({ visibility: "private", maxAge: "5 minutes" }).toString()).toBe(
			"private, max-age=300",
		);
	});

	test("converts every age from a duration to whole seconds", () => {
		let value = policy({
			visibility: "public",
			maxAge: "1 hour",
			sMaxAge: "1 day",
			staleWhileRevalidate: "1 week",
			staleIfError: "1 week",
		});

		expect(value.toString()).toBe(
			"public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800",
		);
	});

	test("reads a bare number as milliseconds", () => {
		expect(policy({ maxAge: 5000 }).toString()).toBe("max-age=5");
	});

	test("keeps a zero age instead of dropping the directive", () => {
		expect(policy({ visibility: "private", maxAge: 0 }).toString()).toBe("private, max-age=0");
	});

	test("emits the boolean directives that are asked for", () => {
		let value = policy({
			noCache: true,
			noTransform: true,
			mustRevalidate: true,
			proxyRevalidate: true,
			immutable: true,
		});

		expect(value.toString()).toBe(
			"no-cache, no-transform, must-revalidate, proxy-revalidate, immutable",
		);
	});

	test("omits boolean directives that are false", () => {
		expect(policy({ maxAge: "1 hour", noStore: false, immutable: false }).toString()).toBe(
			"max-age=3600",
		);
	});

	test("exposes the directives as fields, not only as a string", () => {
		let value = policy({ visibility: "public", maxAge: "1 hour", sMaxAge: "1 day" });

		expect(value.public).toBe(true);
		expect(value.maxAge).toBe(3600);
		expect(value.sMaxage).toBe(86400);
		expect(value.private).toBeUndefined();
	});
});
