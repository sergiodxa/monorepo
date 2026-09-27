/**
 * Drives `POST /oauth/token` through the management router: the HTTP-layer form
 * parsing and client-authentication detection `app/http/controllers/oauth/token.ts`
 * already established, now over `management_clients` and answering with a token
 * bound to the client's own tenant.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";
import type { Middleware } from "remix/router";

import { Base64 } from "@sdxc/crypto";
import { env } from "cloudflare:workers";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test } from "vitest";

import { conformance } from "~/app/http/controllers/management/test-harness";
import { database } from "~/app/http/middleware/database";
import Customer from "~/app/models/customer";
import { registerManagementClient } from "~/app/models/management-client";
import { advancePlatformSigningKeys } from "~/app/models/platform-signing-key";
import Tenant from "~/app/models/tenant";
import { createTestDatabase } from "~/app/test/db";
import routes from "~/routes/management";

import token from "./token";

let db: Database;
let tenantId: string;
let otherTenantId: string;
let ISSUER: string;

beforeEach(async () => {
	db = await createTestDatabase();
	await advancePlatformSigningKeys(db, { now: Date.now() });
	ISSUER = `https://api.${env.PLATFORM_DOMAIN}`;

	let customer = await Customer.create(db, { name: "Acme, Inc." });
	let tenant = await Tenant.create(db, {
		customerId: customer.id,
		name: "Acme, Inc.",
		slug: "acme",
		issuer: "https://acme.auth.example.com",
	});
	tenantId = tenant.id;

	let other = await Tenant.create(db, {
		customerId: customer.id,
		name: "Other, Inc.",
		slug: "other",
		issuer: "https://other.auth.example.com",
	});
	otherTenantId = other.id;
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

	return new Request(`https://api.${env.PLATFORM_DOMAIN}/oauth/token`, {
		method: "POST",
		headers: requestHeaders,
		body: body.toString(),
	});
}

async function registerTestClient(scopes: string[] = ["subjects:read", "subjects:write"]) {
	let result = await registerManagementClient(db, { tenantId, name: "CI pipeline", scopes });
	if (!result.ok) throw new Error("unreachable");
	return result;
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
		let { client, secret } = await registerTestClient();
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
				client_id: "mgmt_whatever",
			}),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe("unsupported_grant_type");
	});

	test("refuses a caller that presents no credential", async () => {
		let router = buildRouter();

		let response = await router.fetch(
			tokenRequest({ grant_type: "client_credentials", client_id: "mgmt_whatever" }),
		);

		expect(response.status).toBe(401);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe("invalid_client");
	});

	test("refuses a token naming a different tenant's resource", async () => {
		let { client, secret } = await registerTestClient();
		let router = buildRouter();

		let response = await router.fetch(
			tokenRequest({
				grant_type: "client_credentials",
				client_id: client.id,
				client_secret: secret,
				resource: `${ISSUER}/tenants/${otherTenantId}`,
			}),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe("invalid_target");
	});

	test("refuses a scope outside the client's own ceiling", async () => {
		let { client, secret } = await registerTestClient(["subjects:read"]);
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
				{ Authorization: `Basic ${Base64.encode("mgmt_missing:whatever")}` },
			),
		);

		expect(response.status).toBe(401);
	});
});
