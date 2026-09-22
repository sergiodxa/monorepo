/**
 * Drives `managementRateLimit` through a small test router: an allowed request
 * passes through untouched, a denied one answers `429` with a `problem+json` body
 * and the rate limit headers `@sdxc/rate-limit` already knows how to write, and
 * the budget checked is the tenant's own plan tier.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RateLimiterBinding } from "@sdxc/rate-limit";
import type { Database } from "remix/data-table";
import type { Middleware } from "remix/router";

import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test } from "vitest";

import { database } from "~/app/http/middleware/database";
import { ManagementCallerContext } from "~/app/http/middleware/management-auth";
import Customer from "~/app/models/customer";
import Tenant from "~/app/models/tenant";
import { createTestDatabase } from "~/app/test/db";

import { managementRateLimit } from "./management-rate-limit";

let db: Database;
let tenantId: string;

beforeEach(async () => {
	db = await createTestDatabase();
	let customer = await Customer.create(db, { name: "Acme, Inc." });
	let tenant = await Tenant.create(db, {
		customerId: customer.id,
		name: "Acme, Inc.",
		slug: "acme",
		issuer: "https://acme.auth.example.com",
	});
	tenantId = tenant.id;
});

/** A fake binding answering the same decision on every call. */
function fakeLimiter(success: boolean): RateLimiterBinding {
	return { limit: async () => ({ success }) };
}

/** Publishes a caller directly, standing in for `managementAuth` in these unit tests. */
function stubManagementCaller(callerTenantId: string): Middleware {
	return (ctx, next) => {
		ctx.set(
			ManagementCallerContext,
			{ tenantId: callerTenantId, scopes: [], actor: { type: "client", id: "mgmt_client_1" } },
			{ property: "managementCaller" },
		);
		return next();
	};
}

function buildRouter(limiter: RateLimiterBinding, callerTenantId: string) {
	let router = createRouter({
		middleware: [
			database(() => db),
			stubManagementCaller(callerTenantId),
			managementRateLimit(limiter),
		],
	});
	router.get("/probe", () => new Response("ok"));
	router.post("/probe", () => new Response("ok"));
	return router;
}

describe("managementRateLimit", () => {
	test("passes an allowed request through untouched", async () => {
		let router = buildRouter(fakeLimiter(true), tenantId);

		let response = await router.fetch(new Request("https://api.example.com/probe"));

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("ok");
	});

	test("denies with a problem+json 429 carrying the rate limit headers", async () => {
		let router = buildRouter(fakeLimiter(false), tenantId);

		let response = await router.fetch(new Request("https://api.example.com/probe"));

		expect(response.status).toBe(429);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
		expect(response.headers.get("RateLimit")).toContain("limit=60");
		expect(response.headers.has("Retry-After")).toBe(true);

		let body = (await response.json()) as Record<string, unknown>;
		expect(body.status).toBe(429);
	});

	test("checks the write budget for a non-GET request", async () => {
		let router = buildRouter(fakeLimiter(false), tenantId);

		let response = await router.fetch(
			new Request("https://api.example.com/probe", { method: "POST" }),
		);

		expect(response.headers.get("RateLimit")).toContain("limit=20");
	});

	test("reads the tenant's own plan tier", async () => {
		await db.update(Tenant.table, { id: tenantId }, { plan_slug: "premium" });
		let router = buildRouter(fakeLimiter(false), tenantId);

		let response = await router.fetch(new Request("https://api.example.com/probe"));

		expect(response.headers.get("RateLimit")).toContain("limit=1800");
	});

	test("falls back to the free tier for an unresolvable tenant", async () => {
		let router = buildRouter(fakeLimiter(false), "ten_missing");

		let response = await router.fetch(new Request("https://api.example.com/probe"));

		expect(response.headers.get("RateLimit")).toContain("limit=60");
	});

	test("lets the request through when the limiter binding cannot answer", async () => {
		let brokenLimiter: RateLimiterBinding = {
			limit: async () => {
				throw new Error("binding unavailable");
			},
		};
		let router = buildRouter(brokenLimiter, tenantId);

		let response = await router.fetch(new Request("https://api.example.com/probe"));

		expect(response.status).toBe(200);
	});
});
