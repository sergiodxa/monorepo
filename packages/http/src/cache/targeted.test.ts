/**
 * Tests for `targetedPolicy()` and `parseTargetedPolicy()`.
 *
 * Targeted fields are Structured Field Dictionaries, so the cases pin the RFC 9213 rules
 * a Cache-Control parser would get wrong: invalid fields are ignored whole, and ill-typed
 * values are skipped rather than coerced.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { CacheControl } from "remix/headers";
import { describe, expect, test } from "vitest";

import { parseTargetedPolicy, targetedPolicy } from "./targeted.js";

describe(targetedPolicy, () => {
	test("writes an edge-only lifetime as whole seconds", () => {
		expect(targetedPolicy({ maxAge: "1 day" })).toBe("max-age=86400");
	});

	test("writes flags as bare keys ahead of the ages", () => {
		expect(
			targetedPolicy({
				visibility: "public",
				maxAge: "10 minutes",
				staleWhileRevalidate: "1 minute",
				mustRevalidate: true,
			}),
		).toBe("public, must-revalidate, max-age=600, stale-while-revalidate=60");
	});

	test("writes no-store on its own", () => {
		expect(targetedPolicy({ noStore: true })).toBe("no-store");
	});

	test("writes an empty value, which caches ignore, for an empty description", () => {
		expect(targetedPolicy()).toBe("");
	});

	test("clamps a negative age to zero instead of writing an invalid directive", () => {
		expect(targetedPolicy({ maxAge: -5_000 })).toBe("max-age=0");
	});

	test("round-trips through the parser", () => {
		let parsed = parseTargetedPolicy(
			targetedPolicy({ visibility: "public", maxAge: "1 hour", sMaxAge: "1 day", immutable: true }),
		);
		expect(parsed).toMatchObject({ public: true, maxAge: 3600, sMaxage: 86400, immutable: true });
	});
});

describe(parseTargetedPolicy, () => {
	test("returns a framework CacheControl", () => {
		expect(parseTargetedPolicy("max-age=60")).toBeInstanceOf(CacheControl);
	});

	test("reads ages and flags", () => {
		let parsed = parseTargetedPolicy("max-age=600, stale-if-error=30, no-transform");
		expect(parsed?.maxAge).toBe(600);
		expect(parsed?.staleIfError).toBe(30);
		expect(parsed?.noTransform).toBe(true);
	});

	test("ignores an absent field", () => {
		expect(parseTargetedPolicy(null)).toBeNull();
		expect(parseTargetedPolicy(undefined)).toBeNull();
	});

	test("ignores an empty field", () => {
		expect(parseTargetedPolicy("")).toBeNull();
		expect(parseTargetedPolicy("   ")).toBeNull();
	});

	test("ignores a field that is not a valid Dictionary", () => {
		expect(parseTargetedPolicy("max-age=60,")).toBeNull();
		expect(parseTargetedPolicy("Max-Age=60")).toBeNull();
		expect(parseTargetedPolicy('private="Set-Cookie')).toBeNull();
	});

	test("lets a field with no known directive govern, as the RFC's `none` example does", () => {
		let parsed = parseTargetedPolicy("none");
		expect(parsed).not.toBeNull();
		expect(parsed?.toString()).toBe("");
	});

	test("skips a decimal or negative age instead of coercing it", () => {
		expect(parseTargetedPolicy("max-age=60.5, s-maxage=-1")?.maxAge).toBeUndefined();
		expect(parseTargetedPolicy("max-age=60.5, s-maxage=-1")?.sMaxage).toBeUndefined();
	});

	test("skips a flag carrying a value", () => {
		expect(parseTargetedPolicy("no-store=?0")?.noStore).toBeUndefined();
		expect(parseTargetedPolicy("no-store=5")?.noStore).toBeUndefined();
	});

	test("reads private and no-cache with a field-name list as the unqualified directive", () => {
		let parsed = parseTargetedPolicy('private="Set-Cookie", no-cache="Authorization"');
		expect(parsed?.private).toBe(true);
		expect(parsed?.noCache).toBe(true);
	});

	test("ignores parameters and unknown directives", () => {
		let parsed = parseTargetedPolicy('max-age=60;foo=1, community="UCI", no-store;bar');
		expect(parsed?.maxAge).toBe(60);
		expect(parsed?.noStore).toBe(true);
	});

	test("skips an inner list", () => {
		expect(parseTargetedPolicy("max-age=(1 2)")?.maxAge).toBeUndefined();
	});
});
