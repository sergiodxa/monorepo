/**
 * Behavioural tests for `checkRateLimit`: which limiter binding each request path is
 * routed to, how the client-IP rate-limit key is derived, and the 429 response
 * (status, body, Retry-After) returned when a limiter denies a request. Limiters are
 * injected fakes that record their calls; no Cloudflare binding is used.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { checkRateLimit } from "./rate-limit";

/** A recording fake of a single `RateLimit` binding. */
function fakeLimiter(allow: boolean) {
	let calls: Array<{ key: string }> = [];
	let limiter = {
		calls,
		async limit(options: { key: string }) {
			calls.push(options);
			return { success: allow };
		},
	};
	return limiter;
}

/** Builds a trio of limiters, each allowing or denying per the flags given. */
function buildLimiters(flags?: { auth?: boolean; strict?: boolean; management?: boolean }) {
	let authLimiter = fakeLimiter(flags?.auth ?? true);
	let strictLimiter = fakeLimiter(flags?.strict ?? true);
	let managementLimiter = fakeLimiter(flags?.management ?? true);
	return { authLimiter, strictLimiter, managementLimiter };
}

/** Builds a request for a path with an optional client IP header. */
function request(pathname: string, ip?: string) {
	let headers = new Headers();
	if (ip) headers.set("cf-connecting-ip", ip);
	return new Request(`https://auth.example.test${pathname}`, { headers });
}

describe("checkRateLimit routing", () => {
	test("routes /api/ requests to the management limiter", async () => {
		let limiters = buildLimiters();
		let result = await checkRateLimit(request("/api/tenants", "1.2.3.4"), limiters as never);

		expect(result).toBeNull();
		expect(limiters.managementLimiter.calls).toEqual([{ key: "1.2.3.4:/api" }]);
		expect(limiters.authLimiter.calls).toHaveLength(0);
		expect(limiters.strictLimiter.calls).toHaveLength(0);
	});

	test("routes an auth path to the auth limiter with a path-scoped key", async () => {
		let limiters = buildLimiters();
		let result = await checkRateLimit(request("/oauth/token", "9.9.9.9"), limiters as never);

		expect(result).toBeNull();
		expect(limiters.authLimiter.calls).toEqual([{ key: "9.9.9.9:/oauth/token" }]);
		expect(limiters.strictLimiter.calls).toHaveLength(0);
	});

	test("routes a strict path to the strict limiter", async () => {
		let limiters = buildLimiters();
		let result = await checkRateLimit(request("/verify-email", "5.5.5.5"), limiters as never);

		expect(result).toBeNull();
		expect(limiters.strictLimiter.calls).toEqual([{ key: "5.5.5.5:/verify-email" }]);
		expect(limiters.authLimiter.calls).toHaveLength(0);
	});

	test("matches auth sub-paths (path + slash) too", async () => {
		let limiters = buildLimiters();
		await checkRateLimit(request("/webauthn/register/options", "1.1.1.1"), limiters as never);
		expect(limiters.authLimiter.calls).toEqual([{ key: "1.1.1.1:/webauthn/register/options" }]);
	});

	test("does not rate limit an unmatched path", async () => {
		let limiters = buildLimiters();
		let result = await checkRateLimit(request("/dashboard", "1.2.3.4"), limiters as never);

		expect(result).toBeNull();
		expect(limiters.authLimiter.calls).toHaveLength(0);
		expect(limiters.strictLimiter.calls).toHaveLength(0);
		expect(limiters.managementLimiter.calls).toHaveLength(0);
	});

	test("falls back to an unknown IP when the header is absent", async () => {
		let limiters = buildLimiters();
		await checkRateLimit(request("/oauth/authorize"), limiters as never);
		expect(limiters.authLimiter.calls).toEqual([{ key: "unknown:/oauth/authorize" }]);
	});
});

describe("checkRateLimit denial responses", () => {
	test("returns 429 with Retry-After 60 when the management limiter denies", async () => {
		let limiters = buildLimiters({ management: false });
		let result = await checkRateLimit(request("/api/tenants", "1.2.3.4"), limiters as never);

		expect(result).not.toBeNull();
		expect(result!.status).toBe(429);
		expect(result!.headers.get("Retry-After")).toBe("60");
		expect(result!.headers.get("Content-Type")).toBe("application/json");
		expect(await result!.json()).toEqual({ error: "rate_limit_exceeded" });
	});

	test("returns 429 with Retry-After 60 when the strict limiter denies", async () => {
		let limiters = buildLimiters({ strict: false });
		let result = await checkRateLimit(request("/verify-email", "5.5.5.5"), limiters as never);

		expect(result!.status).toBe(429);
		expect(result!.headers.get("Retry-After")).toBe("60");
	});

	test("returns 429 with Retry-After 10 when the auth limiter denies", async () => {
		let limiters = buildLimiters({ auth: false });
		let result = await checkRateLimit(request("/oauth/token", "9.9.9.9"), limiters as never);

		expect(result!.status).toBe(429);
		expect(result!.headers.get("Retry-After")).toBe("10");
		expect(await result!.json()).toEqual({ error: "rate_limit_exceeded" });
	});

	test("management denial short-circuits before auth/strict limiters run", async () => {
		let limiters = buildLimiters({ management: false });
		await checkRateLimit(request("/api/tenants", "1.2.3.4"), limiters as never);
		expect(limiters.authLimiter.calls).toHaveLength(0);
		expect(limiters.strictLimiter.calls).toHaveLength(0);
	});
});
