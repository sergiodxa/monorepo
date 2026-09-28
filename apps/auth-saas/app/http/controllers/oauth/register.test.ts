/**
 * Drives `/oauth/register` through the tenant router: a valid body registers a
 * usable client, an invalid one answers `invalid_client_metadata`, and discovery
 * advertises `registration_endpoint` once the route exists.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { formData } from "remix/middleware/form-data";
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

import openidConfiguration from "../well-known/openid-configuration";

import register from "./register";

const TENANT_ID = "tenant_1";
const ISSUER = "https://tenant-1.example.com";

let tenantDO: Tenant;

beforeEach(async () => {
	let state = createDurableObjectState();
	tenantDO = new Tenant(state, {} as Cloudflare.Env);
	await tenantDO.provision({ tenantId: TENANT_ID, issuer: ISSUER });
});

function buildRouter() {
	let router = createRouter({
		middleware: [
			formData() as Middleware,
			tenant(() => tenantDO as unknown as DurableObjectStub<Tenant>),
		],
	});
	router.map(routes.register, register);
	router.map(routes.openidConfiguration, openidConfiguration);
	return router;
}

function registerRequest(body: unknown): Request {
	let headers = new Headers({ "Content-Type": "application/json" });
	headers.set(TENANT_ID_HEADER, TENANT_ID);
	headers.set(TENANT_REGION_HEADER, "wnam");
	headers.set(TENANT_ISSUER_HEADER, ISSUER);

	return new Request(`https://${TENANT_ID}.example.com/oauth/register`, {
		method: "POST",
		headers,
		body: JSON.stringify(body),
	});
}

describe("POST /oauth/register", () => {
	test("registers a confidential client and returns a usable client_id/client_secret", async () => {
		let response = await buildRouter().fetch(
			registerRequest({
				redirect_uris: ["https://example.com/callback"],
				client_name: "A Test Relying Party",
			}),
		);

		expect(response.status).toBe(201);
		let body = (await response.json()) as Record<string, unknown>;

		expect(body.client_id).toEqual(expect.any(String));
		expect(body.client_secret).toEqual(expect.any(String));
		expect(body.client_id_issued_at).toEqual(expect.any(Number));
		expect(body.client_secret_expires_at).toBe(0);
		expect(body.token_endpoint_auth_method).toBe("client_secret_basic");
		expect(body.redirect_uris).toEqual(["https://example.com/callback"]);
		expect(body.client_name).toBe("A Test Relying Party");

		let read = await tenantDO.readClient({ clientId: body.client_id as string });
		expect(read.ok).toBe(true);
	});

	test("registers a public client with no client_secret when token_endpoint_auth_method is none", async () => {
		let response = await buildRouter().fetch(
			registerRequest({
				redirect_uris: ["https://example.com/callback"],
				token_endpoint_auth_method: "none",
			}),
		);

		expect(response.status).toBe(201);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.client_secret).toBeUndefined();
		expect(body.token_endpoint_auth_method).toBe("none");
	});

	test("an invalid redirect_uri answers 400 invalid_client_metadata", async () => {
		let response = await buildRouter().fetch(
			registerRequest({ redirect_uris: ["not-an-absolute-uri"] }),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe("invalid_client_metadata");
		expect(body.error_description).toEqual(expect.any(String));
	});

	test("a missing redirect_uris array answers 400 invalid_client_metadata", async () => {
		let response = await buildRouter().fetch(registerRequest({ client_name: "No redirects" }));

		expect(response.status).toBe(400);
		let body = (await response.json()) as Record<string, unknown>;
		expect(body.error).toBe("invalid_client_metadata");
	});

	test("discovery lists registration_endpoint", async () => {
		let request = new Request(`https://${TENANT_ID}.example.com/.well-known/openid-configuration`, {
			headers: {
				[TENANT_ID_HEADER]: TENANT_ID,
				[TENANT_REGION_HEADER]: "wnam",
				[TENANT_ISSUER_HEADER]: ISSUER,
			},
		});

		let response = await buildRouter().fetch(request);
		let body = (await response.json()) as { registration_endpoint: string };
		expect(body.registration_endpoint).toBe(`${ISSUER}/oauth/register`);
	});
});
