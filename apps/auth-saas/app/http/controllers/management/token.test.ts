/**
 * Drives `POST /oauth/token` through the management router: the HTTP-layer form
 * parsing and client-authentication detection `app/http/controllers/oauth/token.ts`
 * already established, now against the platform tenant's own ordinary
 * client-credentials grant, answering with a token that tenant signs under its
 * own key.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";
import type { Middleware } from "remix/router";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { Base64, randomToken } from "@sdxc/crypto";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test } from "vitest";

import { conformance } from "~/app/http/controllers/management/test-harness";
import { database } from "~/app/http/middleware/database";
import { usePlatformTenantForTesting } from "~/app/lib/platform-tenant";
import { createTestDatabase } from "~/app/test/db";
import TenantObject from "~/database/tenant-do";
import routes from "~/routes/management";

import token from "./token";

const PLATFORM_ISSUER = "https://platform.example.com";

let db: Database;
let platformTenantDO: TenantObject;

beforeEach(async () => {
	db = await createTestDatabase();

	let state = createDurableObjectState();
	platformTenantDO = new TenantObject(state, {
		TOTP_SEAL_KEY: randomToken({ bytes: 32 }),
	} as Cloudflare.Env);
	await platformTenantDO.provision({ tenantId: "platform", issuer: PLATFORM_ISSUER });
	await platformTenantDO.applyEntitlements({
		plan: "pro",
		features: { machine_access: true },
		dauCap: null,
		auditRetentionDays: null,
		effectiveAt: Date.now(),
	});

	usePlatformTenantForTesting(
		() => platformTenantDO as unknown as DurableObjectStub<TenantObject>,
		PLATFORM_ISSUER,
	);
});

/** Builds a management router wired to the constructed database, with the same
 * form-data middleware the real management router runs every request through —
 * the token endpoint reads `ctx.formData`, populated there, rather than the
 * request body directly. */
function buildRouter() {
	let router = createRouter({
		middleware: [conformance, formData() as Middleware, database(() => db)],
	});
	router.map(routes.token, token);
	return router;
}

function tokenRequest(
	form: Record<string, string | string[]>,
	headers: Record<string, string> = {},
) {
	let body = new URLSearchParams();
	for (let [key, value] of Object.entries(form)) {
		for (let one of Array.isArray(value) ? value : [value]) body.append(key, one);
	}

	let requestHeaders = new Headers(headers);
	requestHeaders.set("Content-Type", "application/x-www-form-urlencoded");

	return new Request("https://api.example.com/oauth/token", {
		method: "POST",
		headers: requestHeaders,
		body: body.toString(),
	});
}

async function registerTestClient(
	scopes: string[] = ["subjects:read", "subjects:write"],
	tokenEndpointAuthMethod: "client_secret_basic" | "client_secret_post" = "client_secret_basic",
) {
	let result = await platformTenantDO.registerClient({
		name: "CI pipeline",
		kind: "confidential",
		redirectUris: [],
		postLogoutRedirectUris: [],
		grantTypes: ["client_credentials"],
		responseTypes: [],
		scopes,
		tokenEndpointAuthMethod,
		requireConsent: false,
	});
	if (!result.ok || result.secret === null) throw new Error("unreachable");
	return { client: result.client, secret: result.secret };
}

describe("POST /oauth/token", () => {
	test("mints an access token for client_credentials, authenticated with Basic", async () => {
		let { client, secret } = await registerTestClient();
		let router = buildRouter();

		let response = await router.fetch(
			tokenRequest(
				{ grant_type: "client_credentials" },
				{ Authorization: `Basic ${Base64.encode(`${client.id}:${secret}`)}` },
			),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store");

		let body = (await response.json()) as Record<string, unknown>;
		expect(body.token_type).toBe("Bearer");
		expect(typeof body.access_token).toBe("string");
		expect(body).not.toHaveProperty("refresh_token");
		expect(body).not.toHaveProperty("id_token");
	});

	test("mints an access token authenticated with client_secret_post", async () => {
		let { client, secret } = await registerTestClient(
			["subjects:read", "subjects:write"],
			"client_secret_post",
		);
		let router = buildRouter();

		let response = await router.fetch(
			tokenRequest({
				grant_type: "client_credentials",
				client_id: client.id,
				client_secret: secret,
			}),
		);

		expect(response.status).toBe(200);
	});

	test("refuses any grant type other than client_credentials", async () => {
		let router = buildRouter();

		let response = await router.fetch(
			tokenRequest({
				grant_type: "authorization_code",
				code: "whatever",
				code_verifier: "whatever",
				redirect_uri: "https://example.com",
				client_id: "client_whatever",
			}),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe("unsupported_grant_type");
	});

	test("refuses a caller that presents no credential", async () => {
		let router = buildRouter();

		let response = await router.fetch(
			tokenRequest({ grant_type: "client_credentials", client_id: "client_whatever" }),
		);

		expect(response.status).toBe(401);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe("invalid_client");
	});

	test("refuses a scope outside the client's own ceiling", async () => {
		let { client, secret } = await registerTestClient(["subjects:read"], "client_secret_post");
		let router = buildRouter();

		let response = await router.fetch(
			tokenRequest({
				grant_type: "client_credentials",
				client_id: client.id,
				client_secret: secret,
				scope: "subjects:read subjects:write",
			}),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe("invalid_scope");
	});

	test("refuses an unknown client", async () => {
		let router = buildRouter();

		let response = await router.fetch(
			tokenRequest(
				{ grant_type: "client_credentials" },
				{ Authorization: `Basic ${Base64.encode("client_missing:whatever")}` },
			),
		);

		expect(response.status).toBe(401);
	});
});
