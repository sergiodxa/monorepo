/**
 * Drives `GET /health` through the real router inside workerd, so every probe reaches the
 * real local D1, KV, R2 and Secrets Store bindings, with the identity provider behind MSW:
 * the report when everything answers, when a secret is gone, and when sign-in is down.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";

/** The method miniflare's local Secrets Store binding exposes to create and delete secrets. */
const ADMIN_API = "SecretsStoreSecret::admin_api";

/** Every Secrets Store binding the blog reads, each probed by `GET /health`. */
const SECRETS = [
	"CLIENT_ID",
	"CLIENT_SECRET",
	"COOKIE_SESSION_SECRET",
	"WAYBACK_ACCESS_KEY",
	"WAYBACK_SECRET_KEY",
	"ACTIVITYPUB_PRIVATE_KEY",
] as const;

/** The admin calls a local secret answers over RPC, which seed it the way production stores it. */
interface SecretAdmin {
	create(value: string): Promise<string>;
	delete(id: string): Promise<void>;
}

/** MSW server standing in for the identity provider. */
let server = setupServer();

/** The id each seeded secret was created under, so a test can delete one. */
let secretIds = new Map<(typeof SECRETS)[number], string>();

/** The admin API of one local Secrets Store binding. */
function admin(name: (typeof SECRETS)[number]): Promise<SecretAdmin> {
	let binding = env[name] as unknown as Record<typeof ADMIN_API, () => Promise<SecretAdmin>>;
	return binding[ADMIN_API]();
}

/** A full `App.Env` over the real bindings, with the secrets a local run cannot read. */
function environment(): App.Env {
	return {
		IS_PROD: false,
		CLIENT_ID: "test",
		CLIENT_SECRET: "test",
		COOKIE_SESSION_SECRET: "test",
		AUTH: env.AUTH,
		REDIRECTS: env.REDIRECTS,
		CACHE: env.CACHE,
		MCP_RATE_LIMITER: undefined,
		waitUntil: () => {},
	};
}

/** The identity provider answering its own health route with `status`. */
function authProvider(status: "pass" | "fail", httpStatus: number) {
	return http.get("https://auth.sergiodxa.com/health", () =>
		HttpResponse.json(
			{ status, serviceId: "auth" },
			{ status: httpStatus, headers: { "Content-Type": "application/health+json" } },
		),
	);
}

/** Requests the health report through the router the Worker entrypoint builds. */
function requestHealth(): Promise<Response> {
	return createWebRouter(environment()).fetch(new Request("https://blog.test/health"));
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(async () => {
	for (let name of SECRETS) {
		secretIds.set(name, await (await admin(name)).create(`${name.toLowerCase()}-value`));
	}
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("GET /health", () => {
	test("passes when every binding and the identity provider answer", async () => {
		server.use(authProvider("pass", 200));

		let response = await requestHealth();
		let report = await response.json<{
			status: string;
			serviceId: string;
			releaseId: string;
			checks: Record<string, [{ status: string }]>;
		}>();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/health+json");
		expect(report.status).toBe("pass");
		expect(report.serviceId).toBe("blog");
		expect(report.releaseId).toBe(env.CF_VERSION_METADATA.id);
		expect(
			Object.fromEntries(
				Object.entries(report.checks).map(([key, [check]]) => [key, check.status]),
			),
		).toEqual({
			"database:responseTime": "pass",
			"cache:responseTime": "pass",
			"auth:responseTime": "pass",
			"redirects:responseTime": "pass",
			"backups:responseTime": "pass",
			"social-cards:responseTime": "pass",
			"client-id:responseTime": "pass",
			"client-secret:responseTime": "pass",
			"cookie-session-secret:responseTime": "pass",
			"wayback-access-key:responseTime": "pass",
			"wayback-secret-key:responseTime": "pass",
			"activitypub-private-key:responseTime": "pass",
			"auth-provider:responseTime": "pass",
		});
	});

	test("fails with 503 when a secret the pages read is missing", async () => {
		server.use(authProvider("pass", 200));
		await (
			await admin("ACTIVITYPUB_PRIVATE_KEY")
		).delete(secretIds.get("ACTIVITYPUB_PRIVATE_KEY") ?? "");

		let response = await requestHealth();
		let report = await response.json<{
			status: string;
			checks: Record<string, [{ status: string; output?: string }]>;
		}>();

		expect(response.status).toBe(503);
		expect(report.status).toBe("fail");
		expect(report.checks["activitypub-private-key:responseTime"]).toEqual([
			expect.objectContaining({ status: "fail", output: "error" }),
		]);
		expect(report.checks["client-id:responseTime"]).toEqual([
			expect.objectContaining({ status: "pass" }),
		]);
	});

	test("warns with 200 when only the identity provider is down", async () => {
		server.use(authProvider("fail", 503));

		let response = await requestHealth();
		let report = await response.json<{
			status: string;
			output: string;
			checks: Record<string, [{ status: string; affectedEndpoints?: string[] }]>;
		}>();

		expect(response.status).toBe(200);
		expect(report.status).toBe("warn");
		expect(report.output).toBe("Checks not passing: auth-provider:responseTime");
		expect(report.checks["auth-provider:responseTime"]).toEqual([
			expect.objectContaining({
				status: "warn",
				affectedEndpoints: ["/login", "/auth/callback"],
			}),
		]);
	});
});
