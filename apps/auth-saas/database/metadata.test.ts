/**
 * Drives `metadata.ts` directly against a `Database` over a real SQLite-backed
 * `SqlStorage`, the way `consent.test.ts` and `tokens.test.ts` drive their own
 * modules: nothing here can wire a new RPC method onto the tenant object, so these
 * functions are exercised the same way it will eventually call them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import { clients, registerClient } from "./clients";
import { scopes } from "./consent";
import {
	authorizationServerMetadataFor,
	openIdConfigurationFor,
	publishMetadata,
	resolveUserInfo,
} from "./metadata";
import { organizationMembers, organizations } from "./organizations";
import { assignRole } from "./roles";
import { openSession, sessions } from "./sessions";
import { advanceSigningKeys, publishKeySet } from "./signing-keys";
import { addIdentifier, createSubject, verifyIdentifier } from "./subjects";
import { runMigrations } from "./tenant-migrations";

/** The tenant's own issuer, stamped into every rendered document under test. */
const ISSUER = "https://tenant.example.com";

/** A day, in milliseconds, for spelling out the rotation window under test. */
const DAY_MS = 24 * 60 * 60 * 1000;

const T0 = 1_700_000_000_000;

let db: Database;

beforeEach(async () => {
	let state = createDurableObjectState();
	let driver = createSQLStorageDatabaseAdapter(state.storage.sql);
	await runMigrations(driver);
	db = new Database(driver);
});

/** Creates a subject with a verified, primary email, for tests that need one on hand. */
async function createTestSubject(
	profile: Record<string, unknown> = {},
	email = "person@example.com",
): Promise<string> {
	let created = await createSubject(db, { profile });
	if (!created.ok) throw new Error("unreachable");

	let added = await addIdentifier(db, {
		subjectId: created.subjectId,
		kind: "email",
		value: email,
		actor: { kind: "subject" },
	});
	if (!added.ok || added.kind !== "email") throw new Error("unreachable");

	let verified = await verifyIdentifier(db, { ticket: added.ticket });
	if (!verified.ok) throw new Error("unreachable");

	return created.subjectId;
}

describe("publishMetadata", () => {
	test("publishes a jwks matching publishKeySet's own output", async () => {
		await advanceSigningKeys(db, { now: T0 });

		let published = await publishMetadata(db, { now: T0, issuer: ISSUER, hasDeviceGrant: false });
		let keySet = await publishKeySet(db, { now: T0 });

		expect(published.jwks).toEqual(keySet);
	});

	test("builds both metadata documents from the same tenant facts, so they never drift", async () => {
		await advanceSigningKeys(db, { now: T0 });

		let published = await publishMetadata(db, { now: T0, issuer: ISSUER, hasDeviceGrant: false });
		let openid = openIdConfigurationFor(published);
		let oauth = authorizationServerMetadataFor(published);

		expect(openid.issuer).toBe(ISSUER);
		expect(oauth.issuer).toBe(ISSUER);
		expect(openid.authorizationEndpoint.href).toBe(oauth.authorizationEndpoint?.href);
		expect(openid.tokenEndpoint?.href).toBe(oauth.tokenEndpoint?.href);
		expect(openid.authorizationEndpoint.href).toBe(`${ISSUER}/authorize`);
		expect(openid.tokenEndpoint?.href).toBe(`${ISSUER}/oauth/token`);
	});

	test("scopes_supported and claims_supported reflect the tenant's scope catalog, including a tenant-defined scope", async () => {
		await advanceSigningKeys(db, { now: T0 });

		await db.create(scopes, {
			name: "read:roles",
			title: "Your roles",
			description: "The roles assigned to your account.",
			claims: ["https://example.com/roles"],
			is_standard: false,
			created_at: T0,
		});

		let published = await publishMetadata(db, { now: T0, issuer: ISSUER, hasDeviceGrant: false });
		let openid = openIdConfigurationFor(published);

		expect(openid.scopesSupported).toEqual(
			expect.arrayContaining([
				"openid",
				"profile",
				"email",
				"address",
				"offline_access",
				"read:roles",
			]),
		);
		expect(openid.claimsSupported).toEqual(
			expect.arrayContaining([
				"sub",
				"iss",
				"aud",
				"exp",
				"iat",
				"name",
				"email",
				"https://example.com/roles",
			]),
		);
	});

	test("publishes a staged successor beside the incumbent once a rotation stages one", async () => {
		await advanceSigningKeys(db, { now: T0 });
		let before = await publishMetadata(db, { now: T0, issuer: ISSUER, hasDeviceGrant: false });

		// Past the signing window, so a successor is staged and published alongside
		// the incumbent, ahead of ever signing.
		await advanceSigningKeys(db, { now: T0 + 90 * DAY_MS });
		let afterStaging = await publishMetadata(db, {
			now: T0 + 90 * DAY_MS,
			issuer: ISSUER,
			hasDeviceGrant: false,
		});

		expect(before.jwks.keys).toHaveLength(1);
		expect(afterStaging.jwks.keys).toHaveLength(2);
	});

	test("omits device_authorization_endpoint and the device grant URN without the entitlement", async () => {
		await advanceSigningKeys(db, { now: T0 });

		let published = await publishMetadata(db, { now: T0, issuer: ISSUER, hasDeviceGrant: false });
		let openid = openIdConfigurationFor(published);
		let oauth = authorizationServerMetadataFor(published);

		expect(openid.deviceAuthorizationEndpoint).toBeNull();
		expect(oauth.deviceAuthorizationEndpoint).toBeNull();
		expect(openid.grantTypesSupported).toEqual(["authorization_code", "refresh_token"]);
		expect(oauth.grantTypesSupported).toEqual(["authorization_code", "refresh_token"]);
	});

	test("advertises device_authorization_endpoint and the device grant URN once the entitlement holds", async () => {
		await advanceSigningKeys(db, { now: T0 });

		let published = await publishMetadata(db, { now: T0, issuer: ISSUER, hasDeviceGrant: true });
		let openid = openIdConfigurationFor(published);
		let oauth = authorizationServerMetadataFor(published);

		expect(openid.deviceAuthorizationEndpoint?.href).toBe(`${ISSUER}/oauth/device_authorization`);
		expect(oauth.deviceAuthorizationEndpoint?.href).toBe(`${ISSUER}/oauth/device_authorization`);
		expect(openid.grantTypesSupported).toEqual([
			"authorization_code",
			"refresh_token",
			"urn:ietf:params:oauth:grant-type:device_code",
		]);
		expect(oauth.grantTypesSupported).toEqual([
			"authorization_code",
			"refresh_token",
			"urn:ietf:params:oauth:grant-type:device_code",
		]);
	});
});

describe("resolveUserInfo", () => {
	test("answers unknown for a subject id that does not resolve", async () => {
		let result = await resolveUserInfo(db, {
			subjectId: "sub_nonexistent",
			scopes: ["openid"],
			now: T0,
		});

		expect(result).toEqual({ kind: "unknown" });
	});

	test("always includes sub, regardless of granted scopes", async () => {
		let subjectId = await createTestSubject();

		let result = await resolveUserInfo(db, { subjectId, scopes: [], now: T0 });

		expect(result).toEqual({ kind: "claims", claims: { sub: subjectId } });
	});

	test("includes a scope's claims only when it was granted", async () => {
		let subjectId = await createTestSubject({ givenName: "Ada" });

		let withoutProfile = await resolveUserInfo(db, { subjectId, scopes: ["openid"], now: T0 });
		expect(withoutProfile).toEqual({ kind: "claims", claims: { sub: subjectId } });

		let withProfile = await resolveUserInfo(db, {
			subjectId,
			scopes: ["openid", "profile"],
			now: T0,
		});
		if (withProfile.kind !== "claims") throw new Error("unreachable");
		expect(withProfile.claims.given_name).toBe("Ada");
	});

	test("omits a profile claim the tenant's schema has nowhere to store, rather than nulling it", async () => {
		let subjectId = await createTestSubject({ givenName: "Ada" });

		let result = await resolveUserInfo(db, {
			subjectId,
			scopes: ["openid", "profile"],
			now: T0,
		});
		if (result.kind !== "claims") throw new Error("unreachable");

		expect(result.claims.given_name).toBe("Ada");
		expect(result.claims).toHaveProperty("updated_at");
		expect(result.claims).not.toHaveProperty("middle_name");
		expect(result.claims).not.toHaveProperty("profile");
		expect(result.claims).not.toHaveProperty("website");
		expect(result.claims).not.toHaveProperty("gender");
		expect(result.claims).not.toHaveProperty("birthdate");
	});

	test("sources email and email_verified from the primary verified identifier", async () => {
		let subjectId = await createTestSubject({}, "ada@example.com");

		let result = await resolveUserInfo(db, {
			subjectId,
			scopes: ["openid", "email"],
			now: T0,
		});
		if (result.kind !== "claims") throw new Error("unreachable");

		expect(result.claims.email).toBe("ada@example.com");
		expect(result.claims.email_verified).toBe(true);
	});

	test("never returns an address claim, regardless of the scopes granted", async () => {
		let subjectId = await createTestSubject({ givenName: "Ada" }, "ada@example.com");

		let result = await resolveUserInfo(db, {
			subjectId,
			scopes: ["openid", "profile", "email", "address"],
			now: T0,
		});
		if (result.kind !== "claims") throw new Error("unreachable");

		expect(result.claims).not.toHaveProperty("address");
	});

	test("never resolves roles or permissions when no sessionId is given, the same shape as before this claim existed", async () => {
		let subjectId = await createTestSubject();

		let result = await resolveUserInfo(db, { subjectId, scopes: ["openid"], now: T0 });

		expect(result).toEqual({ kind: "claims", claims: { sub: subjectId } });
	});

	test("names the tenant-scope role once a sessionId is given, with no active organization", async () => {
		let subjectId = await createTestSubject();
		let session = await openSession(db, { subjectId, amr: ["pwd"], remembered: true });

		await assignRole(db, {
			subjectId,
			scope: "tenant",
			roleKey: "admin",
			actor: { type: "subject", id: subjectId },
		});

		let result = await resolveUserInfo(db, {
			subjectId,
			scopes: ["openid"],
			now: T0,
			sessionId: session.sessionId,
		});
		if (result.kind !== "claims") throw new Error("unreachable");

		expect(result.claims.roles).toEqual(["admin"]);
		expect(result.claims).not.toHaveProperty("permissions");
	});

	test("adds the session's active organization role alongside the tenant scope's", async () => {
		let subjectId = await createTestSubject();
		let session = await openSession(db, { subjectId, amr: ["pwd"], remembered: true });
		await db.update(sessions, { id: session.sessionId }, { active_organization_id: "org_acme" });

		await db.create(organizations, {
			id: "org_acme",
			slug: "acme",
			name: "Acme",
			logo_url: null,
			status: "active",
			metadata: {},
			created_at: T0,
			updated_at: T0,
		});
		await db.create(organizationMembers, {
			organization_id: "org_acme",
			subject_id: subjectId,
			role: "owner",
			joined_via: "creator",
			created_at: T0,
			updated_at: T0,
		});
		await assignRole(db, {
			subjectId,
			scope: "tenant",
			roleKey: "member",
			actor: { type: "subject", id: subjectId },
		});

		let result = await resolveUserInfo(db, {
			subjectId,
			scopes: ["openid"],
			now: T0,
			sessionId: session.sessionId,
		});
		if (result.kind !== "claims") throw new Error("unreachable");

		expect(result.claims.roles).toEqual(["member", "owner"]);
	});

	test("adds the resolved permissions claim only for a client whose include_permissions switch is on", async () => {
		let subjectId = await createTestSubject();
		let session = await openSession(db, { subjectId, amr: ["pwd"], remembered: true });

		await assignRole(db, {
			subjectId,
			scope: "tenant",
			roleKey: "admin",
			actor: { type: "subject", id: subjectId },
		});

		let registeredOff = await registerClient(db, {
			name: "Off Client",
			kind: "confidential",
			redirectUris: ["https://example.com/callback"],
			postLogoutRedirectUris: [],
			grantTypes: ["authorization_code"],
			responseTypes: ["code"],
			scopes: ["openid"],
			tokenEndpointAuthMethod: "client_secret_basic",
			requireConsent: false,
		});
		if (!registeredOff.ok) throw new Error("unreachable");

		let withoutClaim = await resolveUserInfo(db, {
			subjectId,
			scopes: ["openid"],
			now: T0,
			sessionId: session.sessionId,
			clientId: registeredOff.client.id,
		});
		if (withoutClaim.kind !== "claims") throw new Error("unreachable");
		expect(withoutClaim.claims).not.toHaveProperty("permissions");

		await db.update(clients, { id: registeredOff.client.id }, { include_permissions: true });

		let withClaim = await resolveUserInfo(db, {
			subjectId,
			scopes: ["openid"],
			now: T0,
			sessionId: session.sessionId,
			clientId: registeredOff.client.id,
		});
		if (withClaim.kind !== "claims") throw new Error("unreachable");
		expect(withClaim.claims.permissions).toEqual([]);
	});
});
