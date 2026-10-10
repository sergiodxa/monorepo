/**
 * Drives `managementAuth` through a small test router: resolving a bearer
 * token minted by the platform tenant's own token endpoint — a machine
 * credential's client-credentials token, and a person's own
 * authorization-code token — and a dashboard session's membership role into
 * scopes, and refusing every way a caller fails to authenticate or reach a
 * tenant it does not belong to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";
import type { RequestContext } from "remix/router";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { Base64Url, Hex, randomToken, sha256 } from "@sdxc/crypto";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { isFailure, unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { Database as DataTableDatabase } from "remix/data-table";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test } from "vitest";

import type { Models } from "~/app/models";

import { database } from "~/app/http/middleware/database";
import { models as modelsMiddleware } from "~/app/http/middleware/models";
import { usePlatformTenantForTesting } from "~/app/lib/platform-tenant";
import { createTestDatabase } from "~/app/test/db";
import { bindModels } from "~/app/test/models";
import { authorizationCodes } from "~/database/authorization";
import { openSession } from "~/database/sessions";
import TenantObject from "~/database/tenant-do";

import { managementAuth } from "./management-auth";

const ISSUER = "https://api.example.com";

const PLATFORM_ISSUER = "https://platform.example.com";

const METADATA_URL = "https://api.example.com/.well-known/oauth-protected-resource";

let db: Database;
let models: Models;
let tenantId: string;
let otherTenantId: string;
let platformTenantDO: TenantObject;
let platformDb: Database;

beforeEach(async () => {
	db = await createTestDatabase();
	models = bindModels(db);
	let customer = unwrap(await models.customers.create({ name: "Acme, Inc." }));
	let tenant = unwrap(
		await models.tenants.create({
			customer_id: customer.id,
			name: "Acme, Inc.",
			slug: "acme",
			issuer: "https://acme.auth.example.com",
		}),
	);
	tenantId = tenant.id;

	let other = unwrap(
		await models.tenants.create({
			customer_id: customer.id,
			name: "Other, Inc.",
			slug: "other",
			issuer: "https://other.auth.example.com",
		}),
	);
	otherTenantId = other.id;

	let platformState = createDurableObjectState();
	platformTenantDO = new TenantObject(platformState, {
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
	platformDb = new DataTableDatabase(createSQLStorageDatabaseAdapter(platformState.storage.sql));

	usePlatformTenantForTesting(
		() => platformTenantDO as unknown as DurableObjectStub<TenantObject>,
		PLATFORM_ISSUER,
	);
});

/** Registers an agent client on the platform tenant, bound to `boundTenantId`, and mints its token. */
async function signMachineToken(
	boundTenantId: string,
	scope = "subjects:read subjects:write",
): Promise<string> {
	let registered = await platformTenantDO.registerClient({
		name: "agent client",
		kind: "confidential",
		redirectUris: [],
		postLogoutRedirectUris: [],
		grantTypes: ["client_credentials"],
		responseTypes: [],
		scopes: ["subjects:read", "subjects:write"],
		tokenEndpointAuthMethod: "client_secret_basic",
		requireConsent: false,
	});
	if (!registered.ok || registered.secret === null) throw new Error("unreachable");

	unwrap(
		await models.agentClientBindings.create({
			client_id: registered.client.id,
			tenant_id: boundTenantId,
		}),
	);

	let outcome = await platformTenantDO.issueClientCredentialsToken({
		clientId: registered.client.id,
		clientSecret: registered.secret,
		scope,
		resource: null,
		authScheme: "basic",
		now: Date.now(),
	});
	if (outcome.kind !== "tokens") throw new Error("unreachable");
	return outcome.accessToken;
}

/** A subject and its open session on the platform tenant, ready to bind an authorization code to. */
async function createPlatformSubjectAndSession(): Promise<{
	subjectId: string;
	sessionId: string;
}> {
	let created = await platformTenantDO.createSubject({
		identifiers: [{ kind: "username", value: `jane-${generateUUID()}` }],
	});
	if (!created.ok) throw new Error("unreachable");

	let session = await openSession(platformDb, {
		subjectId: created.subjectId,
		amr: ["pwd"],
		remembered: true,
	});
	return { subjectId: created.subjectId, sessionId: session.sessionId };
}

/** Mints an interactive, person-obtained token: a client of the platform tenant, an
 * authorization code written directly (the way `oauth/token.test.ts` builds one),
 * exchanged for a real token carrying exactly the scopes the code names. */
async function signHumanToken(input: {
	subjectId: string;
	sessionId: string;
	scopes: string[];
}): Promise<string> {
	let redirectUri = "https://example.com/callback";

	let registered = await platformTenantDO.registerClient({
		name: "interactive client",
		kind: "confidential",
		redirectUris: [redirectUri],
		postLogoutRedirectUris: [],
		grantTypes: ["authorization_code"],
		responseTypes: ["code"],
		scopes: input.scopes,
		tokenEndpointAuthMethod: "client_secret_basic",
		requireConsent: false,
	});
	if (!registered.ok || registered.secret === null) throw new Error("unreachable");

	let code = `code-${generateUUID()}`;
	let codeVerifier = `verifier-${generateUUID()}`;
	let codeHashed = await sha256(code);
	let verifierHashed = await sha256(codeVerifier);
	if (isFailure(codeHashed) || isFailure(verifierHashed)) throw new Error("unreachable");
	let now = Date.now();

	await platformDb.create(authorizationCodes, {
		id: generateUUID(),
		code_hash: Hex.encode(codeHashed.data),
		client_id: registered.client.id,
		redirect_uri: redirectUri,
		code_challenge: Base64Url.encode(verifierHashed.data),
		scopes: input.scopes,
		subject_id: input.subjectId,
		session_id: input.sessionId,
		nonce: null,
		auth_time: now,
		created_at: now,
		expires_at: now + 60_000,
		redeemed_at: null,
		token_family_id: null,
	});

	let outcome = await platformTenantDO.exchangeCode({
		code,
		codeVerifier,
		redirectUri,
		clientId: registered.client.id,
		clientSecret: registered.secret,
		authScheme: "basic",
		now,
	});
	if (outcome.kind !== "tokens") throw new Error("unreachable");
	return outcome.accessToken;
}

function buildRouter(resolveDashboardSubjectId: (ctx: RequestContext) => Promise<string | null>) {
	let router = createRouter({ middleware: [database(() => db), modelsMiddleware()] });
	router.get("/tenants/:tenantId/probe", {
		middleware: [managementAuth({ issuer: ISSUER, resolveDashboardSubjectId })],
		handler: (ctx) => Response.json(ctx.managementCaller),
	});
	return router;
}

describe("machine bearer token", () => {
	test("resolves the caller from its own registration-time tenant binding", async () => {
		let token = await signMachineToken(tenantId);
		let router = buildRouter(async () => null);

		let response = await router.fetch(
			new Request(`https://api.example.com/tenants/${tenantId}/probe`, {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as unknown;
		expect(body).toMatchObject({
			tenantId,
			scopes: ["subjects:read", "subjects:write"],
			actor: { type: "client" },
		});
	});

	test("refuses a credential bound to a different tenant than the URL's own", async () => {
		let token = await signMachineToken(otherTenantId);
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

describe("human bearer token", () => {
	test("one subject holding memberships on two differently-owned tenants reaches both with the same token", async () => {
		let { subjectId, sessionId } = await createPlatformSubjectAndSession();
		let token = await signHumanToken({
			subjectId,
			sessionId,
			scopes: ["subjects:read", "subjects:write"],
		});

		unwrap(
			await models.memberships.create({
				tenant_id: tenantId,
				subject_id: subjectId,
				role: "owner",
			}),
		);
		unwrap(
			await models.memberships.create({
				tenant_id: otherTenantId,
				subject_id: subjectId,
				role: "owner",
			}),
		);

		let router = buildRouter(async () => null);

		let first = await router.fetch(
			new Request(`https://api.example.com/tenants/${tenantId}/probe`, {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);
		expect(first.status).toBe(200);
		expect(await first.json()).toMatchObject({
			tenantId,
			actor: { type: "member", id: subjectId },
		});

		let second = await router.fetch(
			new Request(`https://api.example.com/tenants/${otherTenantId}/probe`, {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);
		expect(second.status).toBe(200);
		expect(await second.json()).toMatchObject({
			tenantId: otherTenantId,
			actor: { type: "member", id: subjectId },
		});
	});

	test("carries only the intersection of the role's own scopes and what the token itself was granted", async () => {
		let { subjectId, sessionId } = await createPlatformSubjectAndSession();
		let token = await signHumanToken({ subjectId, sessionId, scopes: ["subjects:read"] });

		unwrap(
			await models.memberships.create({
				tenant_id: tenantId,
				subject_id: subjectId,
				role: "owner",
			}),
		);

		let router = buildRouter(async () => null);

		let response = await router.fetch(
			new Request(`https://api.example.com/tenants/${tenantId}/probe`, {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as { scopes: string[] };
		expect(body.scopes).toEqual(["subjects:read"]);
	});

	test("refuses a subject with no membership at the URL's tenant", async () => {
		let { subjectId, sessionId } = await createPlatformSubjectAndSession();
		let token = await signHumanToken({ subjectId, sessionId, scopes: ["subjects:read"] });

		let router = buildRouter(async () => null);

		let response = await router.fetch(
			new Request(`https://api.example.com/tenants/${tenantId}/probe`, {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);

		expect(response.status).toBe(403);
	});
});

describe("dashboard session", () => {
	test("resolves the caller from a member's role at the URL's tenant", async () => {
		unwrap(
			await models.memberships.create({ tenant_id: tenantId, subject_id: "sub_1", role: "admin" }),
		);
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
