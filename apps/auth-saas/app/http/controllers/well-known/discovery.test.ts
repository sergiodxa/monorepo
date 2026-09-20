/**
 * Drives the discovery controllers through the tenant router, the way a client
 * actually reaches them, rather than calling `publishMetadata` directly the way
 * `metadata.test.ts` already does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test } from "vitest";

import {
	TENANT_ID_HEADER,
	TENANT_ISSUER_HEADER,
	TENANT_REGION_HEADER,
	tenant,
} from "~/app/http/middleware/tenant";
import Tenant from "~/database/tenant-do";
import routes from "~/routes/tenant";

import jwks from "./jwks";
import oauthAuthorizationServer from "./oauth-authorization-server";
import openidConfiguration from "./openid-configuration";

const TENANT_ID = "tenant_1";
const ISSUER = "https://tenant-1.example.com";

let tenantDO: Tenant;

beforeEach(async () => {
	let state = createDurableObjectState();
	tenantDO = new Tenant(state, {} as Cloudflare.Env);
	await tenantDO.provision({ tenantId: TENANT_ID, issuer: ISSUER });
});

/** Builds a tenant router wired to the constructed Durable Object, the way `bootstrap/tenant-app.ts` does. */
function buildRouter() {
	let router = createRouter({
		middleware: [tenant(() => tenantDO as unknown as DurableObjectStub<Tenant>)],
	});
	router.map(routes.openidConfiguration, openidConfiguration);
	router.map(routes.oauthAuthorizationServer, oauthAuthorizationServer);
	router.map(routes.jwks, jwks);
	return router;
}

/** A request already resolved to the fixture tenant, the way `forwardToTenant` builds one. */
function tenantRequest(path: string): Request {
	return new Request(`https://${TENANT_ID}.example.com${path}`, {
		headers: {
			[TENANT_ID_HEADER]: TENANT_ID,
			[TENANT_REGION_HEADER]: "wnam",
			[TENANT_ISSUER_HEADER]: ISSUER,
		},
	});
}

describe("GET /.well-known/openid-configuration", () => {
	test("returns the tenant's OpenID configuration with caching headers", async () => {
		let response = await buildRouter().fetch(tenantRequest("/.well-known/openid-configuration"));

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
		expect(response.headers.get("ETag")).toEqual(expect.stringMatching(/^"/));

		let body = (await response.json()) as Record<string, unknown>;
		expect(body.issuer).toBe(ISSUER);
		expect(body.authorization_endpoint).toBe(`${ISSUER}/authorize`);
		expect(body.token_endpoint).toBe(`${ISSUER}/oauth/token`);
		expect(body.userinfo_endpoint).toBe(`${ISSUER}/userinfo`);
		expect(body.jwks_uri).toBe(`${ISSUER}/.well-known/jwks.json`);
	});
});

describe("GET /.well-known/oauth-authorization-server", () => {
	test("returns the tenant's OAuth authorization server metadata with caching headers", async () => {
		let response = await buildRouter().fetch(
			tenantRequest("/.well-known/oauth-authorization-server"),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");
		expect(response.headers.get("ETag")).toEqual(expect.stringMatching(/^"/));

		let body = (await response.json()) as Record<string, unknown>;
		expect(body.issuer).toBe(ISSUER);
		expect(body.token_endpoint).toBe(`${ISSUER}/oauth/token`);
	});
});

describe("GET /.well-known/jwks.json", () => {
	test("returns the tenant's published key set, matching publishMetadata's own jwks", async () => {
		let response = await buildRouter().fetch(tenantRequest("/.well-known/jwks.json"));

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("public, max-age=300");

		let published = await tenantDO.publishMetadata({ now: Date.now() });
		let body = (await response.json()) as { keys: unknown[] };
		expect(body).toEqual(published.jwks);
		expect(body.keys).toHaveLength(1);
		expect(body.keys[0]).toMatchObject({ kty: "EC", alg: "ES256" });
	});
});
