/**
 * Follows a management API refusal to its discovery documents the way a client holding
 * only the API URL would: the `401` challenge's `resource_metadata`, the RFC 9728
 * document it names, and the RFC 8414 document that leads to `/oauth/token`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { parse as parseChallenges } from "@sdxc/auth/bearer-challenge";
import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { randomToken } from "@sdxc/crypto";
import { JWK } from "@sdxc/jwt";
import { unwrap } from "@sdxc/result";
import { parse as parseJwks } from "@sdxc/well-known/jwks";
import { parse as parseProtectedResource } from "@sdxc/well-known/oauth-protected-resource";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test } from "vitest";

import type { Models } from "~/app/models";

import { requireScope } from "~/app/http/lib/require-scope";
import { database } from "~/app/http/middleware/database";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementWellKnown } from "~/app/http/middleware/management-well-known";
import { models as modelsMiddleware } from "~/app/http/middleware/models";
import { usePlatformTenantForTesting } from "~/app/lib/platform-tenant";
import { createTestDatabase } from "~/app/test/db";
import { bindModels } from "~/app/test/models";
import TenantObject from "~/database/tenant-do";
import { AccessToken } from "~/database/tokens";

const ISSUER = "https://api.example.com";

const PLATFORM_ISSUER = "https://platform.example.com";

let db: Database;
let models: Models;
let platformTenantDO: TenantObject;

beforeEach(async () => {
	db = await createTestDatabase();
	models = bindModels(db);

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

/** A management router carrying the discovery documents and one scope-guarded route. */
function buildRouter() {
	let router = createRouter({
		middleware: [database(() => db), modelsMiddleware(), managementWellKnown(ISSUER)],
	});
	router.get("/tenants/:tenantId/probe", {
		middleware: [managementAuth({ issuer: ISSUER, resolveDashboardSubjectId: async () => null })],
		handler: (ctx) => requireScope(ctx, "audit:read") ?? new Response(null, { status: 204 }),
	});
	return router;
}

/** Registers an agent client on the platform tenant, bound to `tnt_1`, and mints its token. */
async function signAgentToken(scope = "subjects:read"): Promise<string> {
	let registered = await platformTenantDO.registerClient({
		name: "agent client",
		kind: "confidential",
		redirectUris: [],
		postLogoutRedirectUris: [],
		grantTypes: ["client_credentials"],
		responseTypes: [],
		scopes: ["subjects:read"],
		tokenEndpointAuthMethod: "client_secret_basic",
		requireConsent: false,
	});
	if (!registered.ok || registered.secret === null) throw new Error("unreachable");

	unwrap(
		await models.agentClientBindings.create({
			client_id: registered.client.id,
			tenant_id: "tnt_1",
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

describe("the management API's discovery documents", () => {
	test("a 401 carries a challenge whose resource_metadata leads to the token endpoint", async () => {
		let router = buildRouter();
		let requested = `${ISSUER}/tenants/tnt_1/probe`;

		let refused = await router.fetch(new Request(requested));
		expect(refused.status).toBe(401);

		let header = refused.headers.get("WWW-Authenticate");
		expect(header).not.toBeNull();
		let [challenge] = unwrap(parseChallenges(header ?? ""));
		expect(challenge?.error).toBeNull();
		let pointer = challenge?.resourceMetadata;
		expect(pointer?.href).toBe(`${ISSUER}/.well-known/oauth-protected-resource`);

		let resourceResponse = await router.fetch(new Request(pointer ?? ""));
		expect(resourceResponse.status).toBe(200);
		let resource = unwrap(
			parseProtectedResource(await resourceResponse.text(), {
				resource: requested,
				match: "prefix",
			}),
		);
		expect(resource.scopesSupported).toContain("subjects:write");
		expect(resource.authorizationServers.map((url) => url.href)).toEqual([`${ISSUER}/`]);

		let serverResponse = await router.fetch(
			new Request(`${ISSUER}/.well-known/oauth-authorization-server`),
		);
		expect(serverResponse.status).toBe(200);
		let server = (await serverResponse.json()) as Record<string, unknown>;
		expect(server.issuer).toBe(ISSUER);
		expect(server.token_endpoint).toBe(`${ISSUER}/oauth/token`);
		expect(server.grant_types_supported).toEqual(["client_credentials"]);
	});

	test("the published key set verifies a token minted by the platform tenant", async () => {
		let router = buildRouter();
		let token = await signAgentToken();

		let response = await router.fetch(new Request(`${ISSUER}/.well-known/jwks.json`));
		let set = unwrap(parseJwks(await response.text()));
		let keys = await JWK.importLocal({ keys: set.keys } as Parameters<typeof JWK.importLocal>[0]);
		let verified = await AccessToken.verify(token, keys, {
			issuer: PLATFORM_ISSUER,
			algorithms: [JWK.Algorithm.ES256],
		});

		expect(verified.clientId).not.toBe("");
	});

	test("a 403 for a missing scope names that scope in its challenge", async () => {
		let router = buildRouter();
		let token = await signAgentToken("subjects:read");

		let response = await router.fetch(
			new Request(`${ISSUER}/tenants/tnt_1/probe`, {
				headers: { Authorization: `Bearer ${token}` },
			}),
		);

		expect(response.status).toBe(403);
		let [challenge] = unwrap(parseChallenges(response.headers.get("WWW-Authenticate") ?? ""));
		expect(challenge?.error).toBe("insufficient_scope");
		expect(challenge?.scope).toEqual(["audit:read"]);
	});
});
