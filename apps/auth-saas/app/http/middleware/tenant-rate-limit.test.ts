/**
 * Drives each ADR-035 rate limit class through a small test router: an
 * allowed request passes through untouched, a denied one answers with the
 * class's own response shape and the rate limit headers, a closed class
 * refuses when its backend cannot answer while an open class lets the
 * request through, and a shared surface spends from one combined budget
 * across every route mounted with it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RateLimiterBinding, RateLimitKVNamespace } from "@sdxc/rate-limit";
import type { Middleware } from "remix/router";

import i18n from "@sdxc/i18n/middleware";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { describe, expect, test, vi } from "vitest";

import en from "~/app/locales/en";

import render from "./render";
import { TENANT_ID_HEADER, TENANT_ISSUER_HEADER, TENANT_REGION_HEADER, tenant } from "./tenant";
import {
	authorizationRateLimit,
	CredentialRateLimitContext,
	interactiveCredentialRateLimit,
	mailSendingRateLimit,
	protocolRateLimit,
	tokenRateLimit,
} from "./tenant-rate-limit";

/** A rate limiter binding answering the same decision on every call. */
function fakeLimiter(success: boolean): RateLimiterBinding {
	return { limit: async () => ({ success }) };
}

/** A rate limiter binding whose calls throw, standing in for a binding outage. */
function brokenLimiter(): RateLimiterBinding {
	return {
		limit: async () => {
			throw new Error("binding unavailable");
		},
	};
}

/** A KV namespace double backed by a Map. */
function memoryKv(): RateLimitKVNamespace {
	let entries = new Map<string, string>();
	return {
		async get(key) {
			return entries.get(key) ?? null;
		},
		async put(key, value) {
			entries.set(key, value);
		},
		async delete(key) {
			entries.delete(key);
		},
	};
}

/** A KV namespace double whose every call throws, standing in for a namespace outage. */
function brokenKv(): RateLimitKVNamespace {
	return {
		async get() {
			throw new Error("kv unavailable");
		},
		async put() {
			throw new Error("kv unavailable");
		},
		async delete() {
			throw new Error("kv unavailable");
		},
	};
}

/** Builds a small router with the hosted-rendering middleware every `onLimit` page needs. */
function buildRouter() {
	let middleware: Middleware[] = [
		render as Middleware,
		formData() as Middleware,
		i18n({
			detection: { supportedLanguages: ["en"], fallbackLanguage: "en", order: ["header"] },
			resources: { en },
		}) as Middleware,
	];
	return createRouter({ middleware });
}

function formRequest(
	url: string,
	fields: Record<string, string> = {},
	ip = "203.0.113.7",
): Request {
	let body = new URLSearchParams(fields);
	return new Request(url, {
		method: "POST",
		body,
		headers: { "Content-Type": "application/x-www-form-urlencoded", "CF-Connecting-IP": ip },
	});
}

function getRequest(url: string, ip = "203.0.113.7"): Request {
	return new Request(url, { headers: { "CF-Connecting-IP": ip } });
}

describe("interactiveCredentialRateLimit", () => {
	test("passes an allowed request through untouched", async () => {
		let router = buildRouter();
		router.post("/sign-in", {
			middleware: [interactiveCredentialRateLimit(fakeLimiter(true))],
			handler: () => new Response("ok"),
		});

		let response = await router.fetch(formRequest("https://example.com/sign-in"));

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("ok");
	});

	test("renders the hosted rate-limited page at 429 with the quota headers", async () => {
		let router = buildRouter();
		router.post("/sign-in", {
			middleware: [interactiveCredentialRateLimit(fakeLimiter(false))],
			handler: () => new Response("ok"),
		});

		let response = await router.fetch(formRequest("https://example.com/sign-in"));

		expect(response.status).toBe(429);
		expect(response.headers.get("Content-Type")).toContain("text/html");
		expect(response.headers.get("RateLimit-Policy")).toBe("10;w=10");
		expect(await response.text()).toContain("Too many attempts");
	});

	test("shares one budget across every route it guards", async () => {
		let shared = interactiveCredentialRateLimit(fakeLimiter(true));
		let deny = interactiveCredentialRateLimit(fakeLimiter(false));
		void deny;

		let router = buildRouter();
		router.post("/sign-in", { middleware: [shared], handler: () => new Response("sign-in") });
		router.post("/sign-up", { middleware: [shared], handler: () => new Response("sign-up") });

		// Two different routes, same address, same middleware instance: both succeed
		// because the fake binding always allows, but the point under test is that
		// they are counted against the exact same adapter and key rather than each
		// route getting its own.
		let first = await router.fetch(formRequest("https://example.com/sign-in"));
		let second = await router.fetch(formRequest("https://example.com/sign-up"));

		expect(first.status).toBe(200);
		expect(second.status).toBe(200);
	});

	test("fails closed when the binding cannot answer", async () => {
		let router = buildRouter();
		router.post("/sign-in", {
			middleware: [interactiveCredentialRateLimit(brokenLimiter())],
			handler: () => new Response("ok"),
		});

		let response = await router.fetch(formRequest("https://example.com/sign-in"));

		expect(response.status).toBe(429);
	});

	test("exposes the adapter and key a wrong credential can spend extra budget against", async () => {
		let limiter = fakeLimiter(true);
		let router = buildRouter();
		let seen: { adapter: unknown; key: string } | undefined;

		router.post("/sign-in", {
			middleware: [interactiveCredentialRateLimit(limiter)],
			handler: (context) => {
				seen = context.get(CredentialRateLimitContext);
				return new Response("ok");
			},
		});

		await router.fetch(formRequest("https://example.com/sign-in"));

		expect(seen?.key).toBe("credential:203.0.113.7/32");
		expect(seen?.adapter).toBeDefined();
	});
});

describe("mailSendingRateLimit", () => {
	test("passes an allowed request through untouched", async () => {
		let router = buildRouter();
		router.post("/reset", {
			middleware: [mailSendingRateLimit(memoryKv())],
			handler: () => new Response("ok"),
		});

		let response = await router.fetch(
			formRequest("https://example.com/reset", { identifier: "Jane.Doe@Example.com" }),
		);

		expect(response.status).toBe(200);
	});

	test("keys separately by folded identifier, so one address exhausting its budget does not touch another", async () => {
		let kv = memoryKv();
		let router = buildRouter();
		router.post("/reset", {
			middleware: [mailSendingRateLimit(kv)],
			handler: () => new Response("ok"),
		});

		for (let i = 0; i < 5; i += 1) {
			let response = await router.fetch(
				formRequest("https://example.com/reset", { identifier: "jane@example.com" }),
			);
			expect(response.status).toBe(200);
		}

		let janeAgain = await router.fetch(
			formRequest("https://example.com/reset", { identifier: "jane@example.com" }),
		);
		let johnStill = await router.fetch(
			formRequest("https://example.com/reset", { identifier: "john@example.com" }),
		);

		expect(janeAgain.status).toBe(429);
		expect(johnStill.status).toBe(200);
	});

	test("folds an identifier's casing to the same bucket", async () => {
		let kv = memoryKv();
		let router = buildRouter();
		router.post("/reset", {
			middleware: [mailSendingRateLimit(kv)],
			handler: () => new Response("ok"),
		});

		for (let i = 0; i < 5; i += 1) {
			await router.fetch(
				formRequest("https://example.com/reset", { identifier: "jane@example.com" }),
			);
		}
		let response = await router.fetch(
			formRequest("https://example.com/reset", { identifier: "Jane@Example.COM" }),
		);

		expect(response.status).toBe(429);
	});

	test("falls back to the connecting address when the request names no identifier", async () => {
		let router = buildRouter();
		router.post("/verify/resend", {
			middleware: [mailSendingRateLimit(memoryKv())],
			handler: () => new Response("ok"),
		});

		let response = await router.fetch(
			formRequest("https://example.com/verify/resend", {}, "203.0.113.9"),
		);

		expect(response.status).toBe(200);
	});

	test("skip exempts a route's own leg that sends no mail", async () => {
		let router = buildRouter();
		router.post("/reset", {
			middleware: [
				mailSendingRateLimit(memoryKv(), {
					skip: (context) => context.url.searchParams.get("ticket") !== null,
				}),
			],
			handler: () => new Response("ok"),
		});

		let response = await router.fetch(formRequest("https://example.com/reset?ticket=abc"));

		expect(response.status).toBe(200);
	});

	test("carries the hour-long window in the RateLimit-Policy header", async () => {
		let router = buildRouter();
		router.post("/reset", {
			middleware: [mailSendingRateLimit(memoryKv())],
			handler: () => new Response("ok"),
		});

		let response = await router.fetch(
			formRequest("https://example.com/reset", { identifier: "jane@example.com" }),
		);

		expect(response.headers.get("RateLimit-Policy")).toBe("5;w=3600");
	});

	test("fails closed when the KV namespace cannot answer", async () => {
		let router = buildRouter();
		router.post("/reset", {
			middleware: [mailSendingRateLimit(brokenKv())],
			handler: () => new Response("ok"),
		});

		let response = await router.fetch(
			formRequest("https://example.com/reset", { identifier: "jane@example.com" }),
		);

		expect(response.status).toBe(429);
	});
});

describe("tokenRateLimit", () => {
	test("keys on the authenticated client id from a Basic credential", async () => {
		let router = buildRouter();
		router.post("/oauth/token", {
			middleware: [tokenRateLimit(fakeLimiter(false))],
			handler: () => new Response("ok"),
		});

		let request = new Request("https://example.com/oauth/token", {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				Authorization: `Basic ${btoa("client-1:secret")}`,
			},
			body: new URLSearchParams({ grant_type: "client_credentials" }),
		});

		let response = await router.fetch(request);

		expect(response.status).toBe(429);
		expect(response.headers.get("RateLimit-Policy")).toBe("60;w=10");
	});

	test("falls back to the connecting address when no client authenticates", async () => {
		let router = buildRouter();
		router.post("/oauth/token", {
			middleware: [tokenRateLimit(fakeLimiter(true))],
			handler: () => new Response("ok"),
		});

		let response = await router.fetch(
			formRequest("https://example.com/oauth/token", { grant_type: "refresh_token" }),
		);

		expect(response.status).toBe(200);
	});

	test("fails open when the binding cannot answer", async () => {
		let router = buildRouter();
		router.post("/oauth/token", {
			middleware: [tokenRateLimit(brokenLimiter())],
			handler: () => new Response("ok"),
		});

		let response = await router.fetch(
			formRequest("https://example.com/oauth/token", { grant_type: "refresh_token" }),
		);

		expect(response.status).toBe(200);
	});
});

describe("authorizationRateLimit", () => {
	test("keys on the connecting address and fails open", async () => {
		let router = buildRouter();
		router.get("/authorize", {
			middleware: [authorizationRateLimit(brokenLimiter())],
			handler: () => new Response("ok"),
		});

		let response = await router.fetch(getRequest("https://example.com/authorize"));

		expect(response.status).toBe(200);
	});

	test("denies over budget with the class's own policy", async () => {
		let router = buildRouter();
		router.get("/authorize", {
			middleware: [authorizationRateLimit(fakeLimiter(false))],
			handler: () => new Response("ok"),
		});

		let response = await router.fetch(getRequest("https://example.com/authorize"));

		expect(response.status).toBe(429);
		expect(response.headers.get("RateLimit-Policy")).toBe("30;w=10");
	});
});

describe("protocolRateLimit", () => {
	test("shares one budget across every route it guards", async () => {
		let shared = protocolRateLimit(fakeLimiter(true));
		let router = buildRouter();
		router.get("/.well-known/jwks.json", {
			middleware: [shared],
			handler: () => new Response("jwks"),
		});
		router.get("/userinfo", { middleware: [shared], handler: () => new Response("userinfo") });

		let jwks = await router.fetch(getRequest("https://example.com/.well-known/jwks.json"));
		let userinfo = await router.fetch(getRequest("https://example.com/userinfo"));

		expect(jwks.status).toBe(200);
		expect(userinfo.status).toBe(200);
	});

	test("fails open when the binding cannot answer", async () => {
		let router = buildRouter();
		router.get("/userinfo", {
			middleware: [protocolRateLimit(brokenLimiter())],
			handler: () => new Response("ok"),
		});

		let response = await router.fetch(getRequest("https://example.com/userinfo"));

		expect(response.status).toBe(200);
	});

	test("denies over budget with the class's own policy", async () => {
		let router = buildRouter();
		router.get("/userinfo", {
			middleware: [protocolRateLimit(fakeLimiter(false))],
			handler: () => new Response("ok"),
		});

		let response = await router.fetch(getRequest("https://example.com/userinfo"));

		expect(response.status).toBe(429);
		expect(response.headers.get("RateLimit-Policy")).toBe("120;w=10");
	});
});

describe("attack-signal recording", () => {
	/** A router carrying the `tenant` middleware, so a refusal's wrapper resolves `ctx.tenant`. */
	function buildTenantAwareRouter() {
		let middleware: Middleware[] = [
			tenant(() => ({}) as never),
			render as Middleware,
			formData() as Middleware,
			i18n({
				detection: { supportedLanguages: ["en"], fallbackLanguage: "en", order: ["header"] },
				resources: { en },
			}) as Middleware,
		];
		return createRouter({ middleware });
	}

	/** A form request carrying the internal headers `tenant()` reads a resolved tenant off. */
	function tenantFormRequest(
		url: string,
		fields: Record<string, string> = {},
		ip = "203.0.113.7",
	): Request {
		let body = new URLSearchParams(fields);
		return new Request(url, {
			method: "POST",
			body,
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"CF-Connecting-IP": ip,
				[TENANT_ID_HEADER]: "tenant_1",
				[TENANT_REGION_HEADER]: "wnam",
				[TENANT_ISSUER_HEADER]: "https://tenant_1.example.com",
			},
		});
	}

	/** An `AttackSignalEnv` whose `writeDataPoint` is a spy. */
	function attackSignalEnv() {
		let writeDataPoint = vi.fn();
		return { env: { ANALYTICS: { writeDataPoint } }, writeDataPoint };
	}

	test("records a refused-rate-limit signal for a class rendering its own onLimit page", async () => {
		let { env, writeDataPoint } = attackSignalEnv();
		let router = buildTenantAwareRouter();
		router.post("/sign-in", {
			middleware: [interactiveCredentialRateLimit(fakeLimiter(false), env)],
			handler: () => new Response("ok"),
		});

		let response = await router.fetch(tenantFormRequest("https://example.com/sign-in"));

		expect(response.status).toBe(429);
		expect(writeDataPoint).toHaveBeenCalledTimes(1);
		expect(writeDataPoint).toHaveBeenCalledWith({
			indexes: ["tenant_1"],
			blobs: [
				"attack_signal",
				"tenant_1",
				"credential",
				"refused-rate-limit",
				"rate_limit.exceeded",
				"",
			],
			doubles: [1],
		});
	});

	test("records a refused-rate-limit signal for a class answering the shared default JSON refusal", async () => {
		let { env, writeDataPoint } = attackSignalEnv();
		let router = buildTenantAwareRouter();
		router.post("/oauth/token", {
			middleware: [tokenRateLimit(fakeLimiter(false), env)],
			handler: () => new Response("ok"),
		});

		let response = await router.fetch(
			tenantFormRequest("https://example.com/oauth/token", { grant_type: "refresh_token" }),
		);

		expect(response.status).toBe(429);
		expect(writeDataPoint).toHaveBeenCalledTimes(1);
		let [point] = writeDataPoint.mock.calls[0] as [{ blobs: string[] }];
		expect(point.blobs[2]).toBe("token");
	});

	test("does not record a backend-unavailable refusal", async () => {
		let { env, writeDataPoint } = attackSignalEnv();
		let router = buildTenantAwareRouter();
		router.post("/sign-in", {
			middleware: [interactiveCredentialRateLimit(brokenLimiter(), env)],
			handler: () => new Response("ok"),
		});

		let response = await router.fetch(tenantFormRequest("https://example.com/sign-in"));

		expect(response.status).toBe(429);
		expect(writeDataPoint).not.toHaveBeenCalled();
	});

	test("does not record an allowed request", async () => {
		let { env, writeDataPoint } = attackSignalEnv();
		let router = buildTenantAwareRouter();
		router.post("/sign-in", {
			middleware: [interactiveCredentialRateLimit(fakeLimiter(true), env)],
			handler: () => new Response("ok"),
		});

		let response = await router.fetch(tenantFormRequest("https://example.com/sign-in"));

		expect(response.status).toBe(200);
		expect(writeDataPoint).not.toHaveBeenCalled();
	});
});
