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
import { JWK } from "@sdxc/jwt";
import { unwrap } from "@sdxc/result";
import { parse as parseJwks } from "@sdxc/well-known/jwks";
import { parse as parseProtectedResource } from "@sdxc/well-known/oauth-protected-resource";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test } from "vitest";

import { requireScope } from "~/app/http/lib/require-scope";
import { database } from "~/app/http/middleware/database";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementWellKnown } from "~/app/http/middleware/management-well-known";
import { ManagementAccessToken } from "~/app/lib/management-token";
import {
	advancePlatformSigningKeys,
	currentPlatformSigningKeyPair,
} from "~/app/models/platform-signing-key";
import { createTestDatabase } from "~/app/test/db";

const ISSUER = "https://api.example.com";

let db: Database;

beforeEach(async () => {
	db = await createTestDatabase();
	await advancePlatformSigningKeys(db, { now: Date.now() });
});

/** A management router carrying the discovery documents and one scope-guarded route. */
function buildRouter() {
	let router = createRouter({ middleware: [database(() => db), managementWellKnown(ISSUER)] });
	router.get("/tenants/:tenantId/probe", {
		middleware: [managementAuth({ issuer: ISSUER, resolveDashboardSubjectId: async () => null })],
		handler: (ctx) => requireScope(ctx, "audit:read") ?? new Response(null, { status: 204 }),
	});
	return router;
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

	test("the published key set verifies a management token", async () => {
		let router = buildRouter();
		let pair = await currentPlatformSigningKeyPair(db);
		if (!pair) throw new Error("unreachable");
		let now = Math.floor(Date.now() / 1000);
		let token = await new ManagementAccessToken({
			iss: ISSUER,
			sub: "mgmt_client_1",
			client_id: "mgmt_client_1",
			aud: `${ISSUER}/tenants/tnt_1`,
			tenant_id: "tnt_1",
			scope: "subjects:read",
			iat: now,
			exp: now + 900,
		}).sign(JWK.Algorithm.ES256, [pair]);

		let response = await router.fetch(new Request(`${ISSUER}/.well-known/jwks.json`));
		let set = unwrap(parseJwks(await response.text()));
		let keys = await JWK.importLocal({ keys: set.keys } as Parameters<typeof JWK.importLocal>[0]);
		let verified = await ManagementAccessToken.verify(token, keys, {
			issuer: ISSUER,
			algorithms: [JWK.Algorithm.ES256],
		});

		expect(verified.tenantId).toBe("tnt_1");
	});

	test("a 403 for a missing scope names that scope in its challenge", async () => {
		let router = buildRouter();
		let pair = await currentPlatformSigningKeyPair(db);
		if (!pair) throw new Error("unreachable");
		let now = Math.floor(Date.now() / 1000);
		let token = await new ManagementAccessToken({
			iss: ISSUER,
			sub: "mgmt_client_1",
			client_id: "mgmt_client_1",
			aud: `${ISSUER}/tenants/tnt_1`,
			tenant_id: "tnt_1",
			scope: "subjects:read",
			iat: now,
			exp: now + 900,
		}).sign(JWK.Algorithm.ES256, [pair]);

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
