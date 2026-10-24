/**
 * Drives `GET /health` through the app's router inside workerd, so the binding probes reach
 * the real D1 database, KV namespace, R2 buckets, Secrets Store secret and geo-fetch Durable
 * Object this app binds, while the Analytics Engine SQL API and third parties stand behind MSW.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Health } from "@sdxc/health";

import { HEALTH_MEDIA_TYPE } from "@sdxc/health";
import { env } from "cloudflare:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Database } from "remix/data-table";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { createWebRouter } from "~/app/initializers/router";

/** The origin the app is reached at in a test. */
const ORIGIN = "https://uptime.test";

/** The Analytics Engine SQL API, whatever account the test environment names. */
const ANALYTICS_SQL = "https://api.cloudflare.com/client/v4/accounts/*/analytics_engine/sql";

/** The identity provider's own health report, as it answers while up. */
const AUTH_HEALTH = "https://auth.sergiodxa.com/health";

/** The payment platform's liveness endpoint. */
const POLAR_HEALTH = "https://api.polar.sh/healthz";

/** The method miniflare's local Secrets Store binding exposes to create and delete secrets. */
const ADMIN_API = "SecretsStoreSecret::admin_api";

/** The admin calls a local secret answers over RPC, which seed it the way production stores it. */
interface SecretAdmin {
	create(value: string): Promise<string>;
	delete(id: string): Promise<void>;
}

/** The admin API of the local unsubscribe secret, which starts out unset. */
function secretAdmin(): Promise<SecretAdmin> {
	let binding = env.UNSUBSCRIBE_SECRET as unknown as Record<
		typeof ADMIN_API,
		() => Promise<SecretAdmin>
	>;
	return binding[ADMIN_API]();
}

/** The id the unsubscribe secret was seeded under, so it is removed once the file finishes. */
let secretId = "";

/** MSW server standing in for the Analytics Engine read API and both third parties. */
let server = setupServer(
	http.post(ANALYTICS_SQL, () => HttpResponse.json({ data: [{ count: 42 }] })),
	http.get(AUTH_HEALTH, () =>
		HttpResponse.json(
			{ status: "pass", serviceId: "auth" },
			{ headers: { "Content-Type": HEALTH_MEDIA_TYPE } },
		),
	),
	http.get(POLAR_HEALTH, () => HttpResponse.json({ status: "ok" })),
);

beforeAll(async () => {
	server.listen({ onUnhandledRequest: "error" });
	secretId = await (await secretAdmin()).create("test-unsubscribe-secret");
});
afterEach(() => {
	server.resetHandlers();
	vi.restoreAllMocks();
});
afterAll(async () => {
	server.close();
	await (await secretAdmin()).delete(secretId);
});

/** Answers `GET /health` through the app and reads the report it sent. */
async function check(): Promise<{ response: Response; report: Health.Report }> {
	let router = createWebRouter({ kv: env.KV, cookieSecret: "test-cookie-secret", secure: false });
	let response = await router.fetch(new Request(new URL("/health", ORIGIN)));
	let report = (await response.json()) as Health.Report;
	return { response, report };
}

/** The status the report gave one probe. */
function statusOf(report: Health.Report, name: string): Health.Status | undefined {
	return report.checks?.[`${name}:responseTime`]?.[0]?.status;
}

describe("GET /health", () => {
	test("passes every probe against the real bindings, without a session", async () => {
		let { response, report } = await check();

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe(HEALTH_MEDIA_TYPE);
		expect(report.status).toBe("pass");
		expect(report.serviceId).toBe("ping");
		expect(report.releaseId).toBe(env.CF_VERSION_METADATA.id);
		for (let name of [
			"database",
			"kv",
			"social-cards",
			"flow-traces",
			"geo-fetch",
			"unsubscribe-secret",
			"analytics-engine",
			"auth-provider",
			"polar",
		]) {
			expect(statusOf(report, name), name).toBe("pass");
		}
	});

	test("fails with 503 when the database cannot be read", async () => {
		vi.spyOn(Database.prototype, "exec").mockRejectedValue(new Error("D1_ERROR: unavailable"));

		let { response, report } = await check();

		expect(response.status).toBe(503);
		expect(report.status).toBe("fail");
		expect(statusOf(report, "database")).toBe("fail");
	});

	test("warns and stays 200 when the Analytics Engine read API fails", async () => {
		server.use(http.post(ANALYTICS_SQL, () => new HttpResponse(null, { status: 500 })));

		let { response, report } = await check();

		expect(response.status).toBe(200);
		expect(report.status).toBe("warn");
		expect(statusOf(report, "analytics-engine")).toBe("warn");
	});

	test("warns and stays 200 when the identity provider and Polar are down", async () => {
		server.use(
			http.get(AUTH_HEALTH, () => new HttpResponse(null, { status: 502 })),
			http.get(POLAR_HEALTH, () => HttpResponse.error()),
		);

		let { response, report } = await check();

		expect(response.status).toBe(200);
		expect(statusOf(report, "auth-provider")).toBe("warn");
		expect(statusOf(report, "polar")).toBe("warn");
	});
});

describe("GeoFetchDO.ping", () => {
	test("resolves once the object constructs", async () => {
		await expect(env.GEO_FETCH.getByName("health").ping()).resolves.toBeUndefined();
	});
});
