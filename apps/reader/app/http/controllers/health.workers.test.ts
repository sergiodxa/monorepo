/**
 * Drives `GET /health` through the app's router inside workerd, so the binding probes reach
 * the real KV namespace, D1 catalog and Durable Objects this app binds, while the identity
 * provider and the payment platform stand behind MSW.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Health } from "@sdxc/health";

import { HEALTH_MEDIA_TYPE } from "@sdxc/health";
import { env } from "cloudflare:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";

/** The origin the app is reached at in a test. */
const ORIGIN = "https://reader.test";

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

/** The id the unsubscribe secret was seeded under, so a test can delete and restore it. */
let secretId = "";

/** MSW server standing in for the identity provider and the payment platform. */
let server = setupServer(
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
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

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
		expect(report.serviceId).toBe("reader");
		expect(report.releaseId).toBe(env.CF_VERSION_METADATA.id);
		for (let name of ["catalog", "kv", "user-store", "feed-store", "unsubscribe-secret"]) {
			expect(statusOf(report, name), name).toBe("pass");
		}
	});

	test("passes the identity provider and the payment platform while both are up", async () => {
		let { report } = await check();

		expect(statusOf(report, "auth-provider")).toBe("pass");
		expect(statusOf(report, "polar")).toBe("pass");
	});

	test("fails with 503 when the identity provider is down", async () => {
		server.use(http.get(AUTH_HEALTH, () => new HttpResponse(null, { status: 502 })));

		let { response, report } = await check();

		expect(response.status).toBe(503);
		expect(report.status).toBe("fail");
		expect(statusOf(report, "auth-provider")).toBe("fail");
	});

	test("fails when the identity provider reports itself failing", async () => {
		server.use(
			http.get(AUTH_HEALTH, () =>
				HttpResponse.json(
					{ status: "fail" },
					{ status: 503, headers: { "Content-Type": HEALTH_MEDIA_TYPE } },
				),
			),
		);

		let { response, report } = await check();

		expect(response.status).toBe(503);
		expect(statusOf(report, "auth-provider")).toBe("fail");
	});

	test("warns and stays 200 when the payment platform is down", async () => {
		server.use(http.get(POLAR_HEALTH, () => new HttpResponse(null, { status: 503 })));

		let { response, report } = await check();

		expect(response.status).toBe(200);
		expect(report.status).toBe("warn");
		expect(statusOf(report, "polar")).toBe("warn");
		expect(report.checks?.["polar:responseTime"]?.[0]?.affectedEndpoints).toEqual([
			"/billing/checkout/{plan}",
			"/billing/portal",
		]);
	});
});

describe("the unsubscribe secret probe", () => {
	test("fails with 503 when the secret is unset", async () => {
		let admin = await secretAdmin();
		await admin.delete(secretId);

		try {
			let { response, report } = await check();

			expect(response.status).toBe(503);
			expect(statusOf(report, "unsubscribe-secret")).toBe("fail");
		} finally {
			secretId = await admin.create("test-unsubscribe-secret");
		}
	});
});

describe("the Durable Object ping", () => {
	test("answers from a user object's storage", async () => {
		await expect(env.USER.getByName("healthcheck").ping()).resolves.toBeUndefined();
	});

	test("answers from a feed object's storage", async () => {
		await expect(env.FEED.getByName("healthcheck").ping()).resolves.toBeUndefined();
	});
});
