/**
 * Drives `managementAuth` through a small test router: resolving a bearer token
 * signed by the platform's own key, resolving a dashboard session's membership
 * role into scopes, and refusing every way a caller fails to authenticate or
 * reach a tenant it does not belong to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";
import type { RequestContext } from "remix/router";

import { JWK } from "@sdxc/jwt";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test } from "vitest";

import { database } from "~/app/http/middleware/database";
import { ManagementAccessToken } from "~/app/lib/management-token";
import Customer from "~/app/models/customer";
import Membership from "~/app/models/membership";
import {
	advancePlatformSigningKeys,
	currentPlatformSigningKeyPair,
} from "~/app/models/platform-signing-key";
import Tenant from "~/app/models/tenant";
import { createTestDatabase } from "~/app/test/db";

import { managementAuth } from "./management-auth";

const ISSUER = "https://api.example.com";

const METADATA_URL = "https://api.example.com/.well-known/oauth-protected-resource";

let db: Database;
let tenantId: string;
let otherTenantId: string;

beforeEach(async () => {
	db = await createTestDatabase();
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

/** Signs a management access token the way the token endpoint mints one. */
async function signToken(
	overrides: Partial<{ tenantId: string; scope: string }> = {},
): Promise<string> {
	await advancePlatformSigningKeys(db, { now: Date.now() });
	let pair = await currentPlatformSigningKeyPair(db);
	if (!pair) throw new Error("unreachable");

	let now = Math.floor(Date.now() / 1000);
	return new ManagementAccessToken({
		iss: ISSUER,
		sub: "mgmt_client_1",
		client_id: "mgmt_client_1",
		aud: `${ISSUER}/tenants/${overrides.tenantId ?? tenantId}`,
		tenant_id: overrides.tenantId ?? tenantId,
		scope: overrides.scope ?? "subjects:read subjects:write",
		iat: now,
		exp: now + 900,
	}).sign(JWK.Algorithm.ES256, [pair]);
}

function buildRouter(resolveDashboardSubjectId: (ctx: RequestContext) => Promise<string | null>) {
	let router = createRouter({ middleware: [database(() => db)] });
	router.get("/tenants/:tenantId/probe", {
		middleware: [managementAuth({ issuer: ISSUER, resolveDashboardSubjectId })],
		handler: (ctx) => Response.json(ctx.managementCaller),
	});
	return router;
}

describe("bearer token", () => {
	test("resolves the caller from a token the platform itself signed", async () => {
		let token = await signToken();
		let router = buildRouter(async () => null);

		let response = await router.fetch(
			new Request(`https://api.example.com/tenants/${tenantId}/probe`, {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as unknown;
		expect(body).toEqual({
			tenantId,
			scopes: ["subjects:read", "subjects:write"],
			actor: { type: "client", id: "mgmt_client_1" },
		});
	});

	test("refuses a token naming a different tenant than the URL's own", async () => {
		let token = await signToken({ tenantId: otherTenantId });
		let router = buildRouter(async () => null);

		let response = await router.fetch(
			new Request(`https://api.example.com/tenants/${tenantId}/probe`, {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);

		expect(response.status).toBe(403);
		expect(response.headers.get("WWW-Authenticate")).toBe(
			`Bearer error="insufficient_scope", resource_metadata="${METADATA_URL}"`,
		);
	});

	test("refuses a token that does not verify", async () => {
		let router = buildRouter(async () => null);

		let response = await router.fetch(
			new Request(`https://api.example.com/tenants/${tenantId}/probe`, {
				headers: { Authorization: "Bearer not-a-real-token" },
			}),
		);

		expect(response.status).toBe(401);
		expect(response.headers.get("WWW-Authenticate")).toBe(
			`Bearer error="invalid_token", resource_metadata="${METADATA_URL}"`,
		);
	});
});

describe("dashboard session", () => {
	test("resolves the caller from a member's role at the URL's tenant", async () => {
		await Membership.create(db, { tenantId, subjectId: "sub_1", role: "admin" });
		let router = buildRouter(async () => "sub_1");

		let response = await router.fetch(
			new Request(`https://api.example.com/tenants/${tenantId}/probe`),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as unknown;
		expect(body).toMatchObject({ tenantId, actor: { type: "member", id: "sub_1" } });
	});

	test("refuses a member with no membership at the URL's tenant", async () => {
		let router = buildRouter(async () => "sub_1");

		let response = await router.fetch(
			new Request(`https://api.example.com/tenants/${tenantId}/probe`),
		);

		expect(response.status).toBe(403);
	});

	test("refuses a request with no session and no bearer token", async () => {
		let router = buildRouter(async () => null);

		let response = await router.fetch(
			new Request(`https://api.example.com/tenants/${tenantId}/probe`),
		);

		expect(response.status).toBe(401);
		expect(response.headers.get("WWW-Authenticate")).toBe(
			`Bearer resource_metadata="${METADATA_URL}"`,
		);
	});
});
