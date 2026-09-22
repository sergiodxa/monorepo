/**
 * Drives `issueManagementClientCredentialsToken` directly: a successful grant
 * mints a token bound to the client's own tenant, and — this is the pass's single
 * most security-critical behavior — a management client can never mint a token
 * naming a different tenant's resource. Also covers the scope-ceiling refusal and
 * an unknown or revoked client, both answering `invalid_client` alike.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { JWK } from "@sdxc/jwt";
import { beforeEach, describe, expect, test } from "vitest";

import { ManagementAccessToken } from "~/app/lib/management-token";
import Customer from "~/app/models/customer";
import { registerManagementClient, revokeManagementClient } from "~/app/models/management-client";
import {
	advancePlatformSigningKeys,
	publishPlatformKeySet,
} from "~/app/models/platform-signing-key";
import Tenant from "~/app/models/tenant";
import { createTestDatabase } from "~/app/test/db";

import { issueManagementClientCredentialsToken } from "./management-token-grant";

const ISSUER = "https://api.example.com";

let db: Database;
let tenantId: string;
let otherTenantId: string;

beforeEach(async () => {
	db = await createTestDatabase();
	await advancePlatformSigningKeys(db, { now: Date.now() });

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

async function registerTestClient(scopes: string[] = ["subjects:read", "subjects:write"]) {
	let result = await registerManagementClient(db, { tenantId, name: "CI pipeline", scopes });
	if (!result.ok) throw new Error("unreachable");
	return result;
}

describe("issueManagementClientCredentialsToken", () => {
	test("mints a token bound to the client's own tenant when no resource is named", async () => {
		let { client, secret } = await registerTestClient();

		let outcome = await issueManagementClientCredentialsToken(db, {
			clientId: client.id,
			clientSecret: secret,
			scope: null,
			resources: [],
			now: Date.now(),
			issuer: ISSUER,
		});
		if (outcome.kind !== "tokens") throw new Error("unreachable");

		expect(outcome.tokenType).toBe("Bearer");
		expect(outcome.scope.split(" ").sort()).toEqual(["subjects:read", "subjects:write"].sort());

		let published = await publishPlatformKeySet(db);
		let keys = await JWK.importLocal(published);
		let verified = await ManagementAccessToken.verify(outcome.accessToken, keys, {
			issuer: ISSUER,
			algorithms: [JWK.Algorithm.ES256],
		});

		expect(verified.subject).toBe(client.id);
		expect(verified.clientId).toBe(client.id);
		expect(verified.tenantId).toBe(tenantId);
		expect(verified.audience).toBe(`${ISSUER}/tenants/${tenantId}`);
	});

	test("accepts a resource that is a path under the client's own tenant", async () => {
		let { client, secret } = await registerTestClient();

		let outcome = await issueManagementClientCredentialsToken(db, {
			clientId: client.id,
			clientSecret: secret,
			scope: null,
			resources: [`${ISSUER}/tenants/${tenantId}/subjects`],
			now: Date.now(),
			issuer: ISSUER,
		});

		expect(outcome.kind).toBe("tokens");
	});

	test("refuses invalid_target for a resource naming a different tenant", async () => {
		let { client, secret } = await registerTestClient();

		let outcome = await issueManagementClientCredentialsToken(db, {
			clientId: client.id,
			clientSecret: secret,
			scope: null,
			resources: [`${ISSUER}/tenants/${otherTenantId}`],
			now: Date.now(),
			issuer: ISSUER,
		});

		expect(outcome).toEqual({
			kind: "error",
			status: 400,
			error: "invalid_target",
			description: "The requested resource does not name this client's own tenant.",
		});
	});

	test("refuses invalid_target when only one of several resources names a different tenant", async () => {
		let { client, secret } = await registerTestClient();

		let outcome = await issueManagementClientCredentialsToken(db, {
			clientId: client.id,
			clientSecret: secret,
			scope: null,
			resources: [`${ISSUER}/tenants/${tenantId}`, `${ISSUER}/tenants/${otherTenantId}`],
			now: Date.now(),
			issuer: ISSUER,
		});

		expect(outcome.kind).toBe("error");
		if (outcome.kind !== "error") throw new Error("unreachable");
		expect(outcome.error).toBe("invalid_target");
	});

	test("refuses invalid_target for a resource that merely starts with the tenant path as a string", async () => {
		let { client, secret } = await registerTestClient();

		// `${expectedResource}-evil` shares the expected resource as a string prefix
		// without being a path under it (no `/` boundary), so this must not pass.
		let outcome = await issueManagementClientCredentialsToken(db, {
			clientId: client.id,
			clientSecret: secret,
			scope: null,
			resources: [`${ISSUER}/tenants/${tenantId}-evil`],
			now: Date.now(),
			issuer: ISSUER,
		});

		expect(outcome.kind).toBe("error");
		if (outcome.kind !== "error") throw new Error("unreachable");
		expect(outcome.error).toBe("invalid_target");
	});

	test("refuses invalid_scope for a scope outside the client's ceiling", async () => {
		let { client, secret } = await registerTestClient(["subjects:read"]);

		let outcome = await issueManagementClientCredentialsToken(db, {
			clientId: client.id,
			clientSecret: secret,
			scope: "subjects:read subjects:write",
			resources: [],
			now: Date.now(),
			issuer: ISSUER,
		});

		expect(outcome).toEqual({
			kind: "error",
			status: 400,
			error: "invalid_scope",
			description: "One or more requested scopes are not allowed for this client.",
		});
	});

	test("narrows to a requested subset of the client's ceiling", async () => {
		let { client, secret } = await registerTestClient(["subjects:read", "subjects:write"]);

		let outcome = await issueManagementClientCredentialsToken(db, {
			clientId: client.id,
			clientSecret: secret,
			scope: "subjects:read",
			resources: [],
			now: Date.now(),
			issuer: ISSUER,
		});
		if (outcome.kind !== "tokens") throw new Error("unreachable");

		expect(outcome.scope).toBe("subjects:read");
	});

	test("refuses invalid_client for an unknown client", async () => {
		let outcome = await issueManagementClientCredentialsToken(db, {
			clientId: "mgmt_does_not_exist",
			clientSecret: "whatever",
			scope: null,
			resources: [],
			now: Date.now(),
			issuer: ISSUER,
		});

		expect(outcome).toEqual({
			kind: "error",
			status: 401,
			error: "invalid_client",
			description: "The client id or secret did not verify.",
		});
	});

	test("refuses invalid_client for a revoked client", async () => {
		let { client, secret } = await registerTestClient();
		await revokeManagementClient(db, { clientId: client.id });

		let outcome = await issueManagementClientCredentialsToken(db, {
			clientId: client.id,
			clientSecret: secret,
			scope: null,
			resources: [],
			now: Date.now(),
			issuer: ISSUER,
		});

		expect(outcome).toEqual({
			kind: "error",
			status: 401,
			error: "invalid_client",
			description: "The client id or secret did not verify.",
		});
	});

	test("refuses invalid_client for a wrong secret", async () => {
		let { client } = await registerTestClient();

		let outcome = await issueManagementClientCredentialsToken(db, {
			clientId: client.id,
			clientSecret: "wrong-secret",
			scope: null,
			resources: [],
			now: Date.now(),
			issuer: ISSUER,
		});

		expect(outcome.kind).toBe("error");
		if (outcome.kind !== "error") throw new Error("unreachable");
		expect(outcome.error).toBe("invalid_client");
	});
});
