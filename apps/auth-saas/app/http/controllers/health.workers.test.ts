/**
 * Drives `GET /health` through the platform router inside workerd, so the binding probes reach
 * the real D1 database, KV namespaces, R2 bucket and tenant Durable Object this app binds,
 * while Polar stands behind MSW.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Health } from "@sdxc/health";

import { HEALTH_MEDIA_TYPE } from "@sdxc/health";
import { env } from "cloudflare:test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { webRouter } from "~/app/initializers/router";

/** Polar's liveness endpoint. */
const POLAR_HEALTH = "https://api.polar.sh/healthz";

/** MSW server standing in for Polar. */
let server = setupServer(http.get(POLAR_HEALTH, () => HttpResponse.json({ status: "ok" })));

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
	server.resetHandlers();
	vi.restoreAllMocks();
});
afterAll(() => server.close());

/** Answers `GET /health` on the platform host and reads the report it sent. */
async function check(): Promise<{ response: Response; report: Health.Report }> {
	let response = await webRouter.fetch(
		new Request(new URL("/health", `https://${env.PLATFORM_DOMAIN}`)),
	);
	let report = (await response.json()) as Health.Report;
	return { response, report };
}

/** The status the report gave one probe. */
function statusOf(report: Health.Report, name: string): Health.Status | undefined {
	return report.checks?.[`${name}:responseTime`]?.[0]?.status;
}

describe("GET /health", () => {
	test("passes every probe against the real bindings while Polar is up", async () => {
		let { response, report } = await check();

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe(HEALTH_MEDIA_TYPE);
		expect(report.status).toBe("pass");
		expect(report.serviceId).toBe("auth-saas");
		expect(report.releaseId).toBe(env.CF_VERSION_METADATA.id);
		for (let name of [
			"platform-db",
			"r2",
			"tenant",
			"polar",
			"hostnames_kv",
			"flags",
			"mail_rate_limit_kv",
			"turnstile_challenge_kv",
			"device_approval_session_rate_limit_kv",
			"device_approval_address_rate_limit_kv",
			"magic_link_rate_limit_kv",
		]) {
			expect(statusOf(report, name), name).toBe("pass");
		}
	});

	test("fails with 503 when a critical binding cannot answer", async () => {
		vi.spyOn(env.R2, "head").mockRejectedValue(new Error("R2 unavailable"));

		let { response, report } = await check();

		expect(response.status).toBe(503);
		expect(report.status).toBe("fail");
		expect(statusOf(report, "r2")).toBe("fail");
	});

	test("warns and stays 200 when Polar is down", async () => {
		server.use(http.get(POLAR_HEALTH, () => new HttpResponse(null, { status: 503 })));

		let { response, report } = await check();

		expect(response.status).toBe(200);
		expect(report.status).toBe("warn");
		expect(statusOf(report, "polar")).toBe("warn");
	});
});

describe("the tenant Durable Object ping", () => {
	test("answers from the storage of an instance no tenant was provisioned in", async () => {
		await expect(env.TENANT.getByName("healthcheck").ping()).resolves.toBeUndefined();
	});
});
