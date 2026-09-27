/**
 * Drives the platform router's fallback through a router built the same way
 * `bootstrap/app.ts` assembles its own, confirming an allowlisted `/u/` path on
 * the platform's bare domain reaches the real hosted controller — resolving
 * against the platform tenant's own subject store, addressed by the fixed
 * Durable Object name every other platform-tenant call already uses — while a
 * hosted path outside the allowlist, and any other unmatched path, both still
 * answer a plain `404`.
 *
 * `cloudflare:workers` is mocked with every binding the real tenant router
 * needs at module load — rate limiters and their backing KV namespaces, since
 * that router builds its per-route budgets once, at import time, rather than
 * per request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import {
	createAnalyticsEngine,
	createD1Database,
	createDurableObjectNamespace,
	createDurableObjectState,
	createEnv,
	createFetcher,
	createKVNamespace,
	createQueue,
	createR2Bucket,
	createRateLimit,
	createSendEmail,
} from "@sdxc/cloudflare-mocks";
import { randomToken } from "@sdxc/crypto";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type Tenant from "~/database/tenant-do";

const PLATFORM_DOMAIN = "auth.sergiodxa.com";

/** Replaced fresh in `beforeEach`; the mock below closes over this one reference. */
let platformTenantDO: InstanceType<typeof Tenant>;

/**
 * Binds the RPC methods the sign-in flow calls through the namespace as the
 * tenant object's own properties, the way a Durable Object stub's own
 * `Object.assign` copy only reaches own properties, never a class instance's
 * prototype methods.
 */
function platformTenantStub(tenantDO: InstanceType<typeof Tenant>) {
	return {
		createSubject: tenantDO.createSubject.bind(tenantDO),
		addIdentifier: tenantDO.addIdentifier.bind(tenantDO),
		setPassword: tenantDO.setPassword.bind(tenantDO),
		verifyIdentifier: tenantDO.verifyIdentifier.bind(tenantDO),
		signInWithPassword: tenantDO.signInWithPassword.bind(tenantDO),
	};
}

let tenantNamespace = createDurableObjectNamespace<Tenant>((name) => {
	if (name === PLATFORM_DOMAIN) return platformTenantStub(platformTenantDO);
	throw new Error(`unexpected tenant lookup for "${name}"`);
});

vi.doMock("cloudflare:workers", async (importOriginal) => {
	let actual = await importOriginal<typeof import("cloudflare:workers")>();
	return {
		...actual,
		env: createEnv<Cloudflare.Env>({
			PLATFORM_DOMAIN,
			EMAIL_FROM: "Auth SaaS <noreply@auth.sergiodxa.com>",
			SESSION_SECRET: "test-session-secret",
			TURNSTILE_SITE_KEY: "test-site-key",
			TURNSTILE_SECRET_KEY: "test-secret-key",
			TENANT: tenantNamespace,
			SEND_EMAIL: createSendEmail(),
			CREDENTIAL_RATE_LIMITER: createRateLimit(),
			MANAGEMENT_RATE_LIMITER: createRateLimit(),
			TOKEN_RATE_LIMITER: createRateLimit(),
			AUTHORIZATION_RATE_LIMITER: createRateLimit(),
			PROTOCOL_RATE_LIMITER: createRateLimit(),
			DEVICE_AUTHORIZATION_RATE_LIMITER: createRateLimit(),
			MAIL_RATE_LIMIT_KV: createKVNamespace(),
			TURNSTILE_CHALLENGE_KV: createKVNamespace(),
			DEVICE_APPROVAL_SESSION_RATE_LIMIT_KV: createKVNamespace(),
			DEVICE_APPROVAL_ADDRESS_RATE_LIMIT_KV: createKVNamespace(),
			MAGIC_LINK_RATE_LIMIT_KV: createKVNamespace(),
			POLAR_ACCESS_TOKEN: "test-polar-token",
			POLAR_WEBHOOK_SECRET: "test-polar-webhook-secret",
			POLAR_PRODUCT_IDS: "{}",
			POLAR_FEATURE_IDS: "{}",
			POLAR_METER_IDS: "{}",
			PLATFORM_DB: createD1Database(),
			HOSTNAMES_KV: createKVNamespace(),
			FLAGS: createKVNamespace(),
			R2: createR2Bucket(),
			ANALYTICS: createAnalyticsEngine(),
			QUEUE: createQueue(),
			ASSETS: createFetcher(async () => new Response("Not found", { status: 404 })),
			INTERNAL_SECRET: "test-internal-secret",
			TOTP_SEAL_KEY: "test-totp-seal-key",
			TRUSTED_DEVICE_SECRET: "test-trusted-device-secret",
			MAGIC_LINK_NONCE_SECRET: "test-magic-link-nonce-secret",
			CF_API_TOKEN: "test-cf-api-token",
			CF_ZONE_ID: "test-cf-zone-id",
			CF_ACCOUNT_ID: "test-cf-account-id",
			INTERNAL_TENANT_IDS: "",
		}),
	};
});

let { database } = await import("~/app/http/middleware/database");
let render = (await import("~/app/http/middleware/render")).default;
let { platformTenantForward } = await import("~/bootstrap/app");
let { createTestDatabase } = await import("~/app/test/db");
let TenantObject = (await import("~/database/tenant-do")).default;

let db: Awaited<ReturnType<typeof createTestDatabase>>;

/** Builds a router the same way `bootstrap/app.ts`'s own is assembled, minus the middleware unrelated to the fallback under test. */
function buildRouter() {
	/** Kept as a non-tuple `Middleware[]` so the router context stays the base `RequestContext`, matching `platformTenantForward`'s own type. */
	let middleware: Middleware[] = [
		database(() => db),
		render as Middleware,
		formData() as Middleware,
	];

	return createRouter({ middleware, defaultHandler: platformTenantForward });
}

/** A request to the platform's own bare domain. */
function platformRequest(path: string, init?: RequestInit): Request {
	return new Request(`https://${PLATFORM_DOMAIN}${path}`, init);
}

beforeEach(async () => {
	db = await createTestDatabase();

	let state = createDurableObjectState();
	platformTenantDO = new TenantObject(state, {
		TOTP_SEAL_KEY: randomToken({ bytes: 32 }),
	} as Cloudflare.Env);
	tenantNamespace.reset();
});

describe("the platform router's fallback", () => {
	test("forwards an allowlisted hosted path to the real hosted sign-in page", async () => {
		let response = await buildRouter().fetch(platformRequest("/u/sign-in?return_to=%2F"));

		expect(response.status).toBe(200);
		let body = await response.text();
		expect(body).toContain("Sign in");
	});

	test("a subsequent sign-in resolves against the platform tenant's own subject store", async () => {
		let created = await platformTenantDO.createSubject({
			identifiers: [{ kind: "email", value: "owner@example.com" }],
		});
		if (!created.ok) throw new Error("unreachable");

		let added = await platformTenantDO.addIdentifier({
			subjectId: created.subjectId,
			kind: "email",
			value: "owner@example.com",
			actor: { kind: "subject" },
		});
		if (!added.ok || added.kind !== "email") throw new Error("unreachable");
		await platformTenantDO.verifyIdentifier({ ticket: added.ticket });

		let written = await platformTenantDO.setPassword({
			subjectId: created.subjectId,
			password: "correct horse battery staple",
			actor: { kind: "subject" },
		});
		if (!written.ok) throw new Error("unreachable");

		let body = new FormData();
		body.set("identifier", "owner@example.com");
		body.set("password", "correct horse battery staple");

		let response = await buildRouter().fetch(
			platformRequest("/u/sign-in?return_to=%2F", { method: "POST", body }),
		);

		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toBe("https://auth.sergiodxa.com/");
		expect(response.headers.get("Set-Cookie")).toMatch(/^__Host-session=/);
	});

	test("a hosted path outside the allowlist still answers 404", async () => {
		let response = await buildRouter().fetch(platformRequest("/u/sign-up"));

		expect(response.status).toBe(404);
	});

	test("a made-up path still answers 404", async () => {
		let response = await buildRouter().fetch(platformRequest("/nonexistent"));

		expect(response.status).toBe(404);
	});
});
