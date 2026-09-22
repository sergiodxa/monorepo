/**
 * Drives `POST /oauth/device_authorization` through the tenant router, the
 * same harness shape `token.test.ts` builds for its own endpoint.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { beforeEach, expect, test } from "vitest";

import {
	TENANT_ID_HEADER,
	TENANT_ISSUER_HEADER,
	TENANT_REGION_HEADER,
	tenant,
} from "~/app/http/middleware/tenant";
import Tenant from "~/database/tenant-do";
import routes from "~/routes/tenant";

import deviceAuthorization from "./device-authorization";

const TENANT_ID = "tenant_1";
const ISSUER = "https://tenant-1.example.com";
const DEVICE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";

let tenantDO: Tenant;

beforeEach(async () => {
	let state = createDurableObjectState();
	tenantDO = new Tenant(state, {} as Cloudflare.Env);
	await tenantDO.provision({ tenantId: TENANT_ID, issuer: ISSUER });
});

/** Builds a tenant router wired to the constructed Durable Object, with the same
 * form-data middleware the real tenant router runs every request through. */
function buildRouter() {
	let router = createRouter({
		middleware: [
			formData() as Middleware,
			tenant(() => tenantDO as unknown as DurableObjectStub<Tenant>),
		],
	});
	router.map(routes.deviceAuthorization, deviceAuthorization);
	return router;
}

/** A `POST /oauth/device_authorization` request already resolved to the fixture tenant. */
function deviceAuthorizationRequest(form: Record<string, string>): Request {
	let body = new URLSearchParams(form);
	let headers = new Headers();
	headers.set(TENANT_ID_HEADER, TENANT_ID);
	headers.set(TENANT_REGION_HEADER, "wnam");
	headers.set(TENANT_ISSUER_HEADER, ISSUER);
	headers.set("Content-Type", "application/x-www-form-urlencoded");

	return new Request(`https://${TENANT_ID}.example.com/oauth/device_authorization`, {
		method: "POST",
		headers,
		body: body.toString(),
	});
}

/** Registers a confidential client carrying the device grant, granting the tenant's own device_grant feature first. */
async function createDeviceClient(
	overrides: { grantTypes?: string[]; scopes?: string[] } = {},
): Promise<{ clientId: string }> {
	await tenantDO.applyEntitlements({
		plan: "pro",
		features: { device_grant: true },
		dauCap: null,
		auditRetentionDays: null,
		effectiveAt: Date.now(),
	});

	let result = await tenantDO.registerClient({
		name: "Living Room TV",
		kind: "confidential",
		redirectUris: [],
		postLogoutRedirectUris: [],
		grantTypes: overrides.grantTypes ?? [DEVICE_GRANT_TYPE],
		responseTypes: [],
		scopes: overrides.scopes ?? ["openid", "profile"],
		tokenEndpointAuthMethod: "client_secret_post",
		requireConsent: false,
	});
	if (!result.ok) throw new Error("unreachable: client registration failed");
	return { clientId: result.client.id };
}

test("mints a well-formed RFC 8628 response for a client carrying the grant", async () => {
	let { clientId } = await createDeviceClient();

	let response = await buildRouter().fetch(
		deviceAuthorizationRequest({ client_id: clientId, scope: "openid profile" }),
	);

	expect(response.status).toBe(200);
	expect(response.headers.get("Cache-Control")).toBe("no-store");

	let body = (await response.json()) as Record<string, unknown>;
	expect(body.device_code).toEqual(expect.any(String));
	expect(body.user_code).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{4}-[BCDFGHJKLMNPQRSTVWXZ]{4}$/);
	expect(body.verification_uri).toBe(`${ISSUER}/device`);
	expect(body.verification_uri_complete).toBe(
		`${ISSUER}/device?user_code=${encodeURIComponent(body.user_code as string)}`,
	);
	expect(body.expires_in).toBe(600);
	expect(body.interval).toBe(5);
});

test("client_id is required", async () => {
	let response = await buildRouter().fetch(deviceAuthorizationRequest({ scope: "openid" }));

	expect(response.status).toBe(400);
	let body = (await response.json()) as Record<string, unknown>;
	expect(body.error).toBe("invalid_request");
});

test("a client not carrying the device grant is unauthorized_client", async () => {
	let { clientId } = await createDeviceClient({ grantTypes: ["authorization_code"] });

	let response = await buildRouter().fetch(
		deviceAuthorizationRequest({ client_id: clientId, scope: "" }),
	);

	expect(response.status).toBe(400);
	let body = (await response.json()) as Record<string, unknown>;
	expect(body.error).toBe("unauthorized_client");
});

test("an unknown client_id is invalid_client", async () => {
	let response = await buildRouter().fetch(
		deviceAuthorizationRequest({ client_id: "client_missing", scope: "" }),
	);

	expect(response.status).toBe(400);
	let body = (await response.json()) as Record<string, unknown>;
	expect(body.error).toBe("invalid_client");
});

test("a scope outside the client's own ceiling is invalid_scope", async () => {
	let { clientId } = await createDeviceClient({ scopes: ["openid"] });

	let response = await buildRouter().fetch(
		deviceAuthorizationRequest({ client_id: clientId, scope: "openid profile" }),
	);

	expect(response.status).toBe(400);
	let body = (await response.json()) as Record<string, unknown>;
	expect(body.error).toBe("invalid_scope");
});
