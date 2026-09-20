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

import { scopes } from "./consent";
import { publishMetadata, resolveUserInfo } from "./metadata";
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

		let published = await publishMetadata(db, { now: T0, issuer: ISSUER });
		let keySet = await publishKeySet(db, { now: T0 });

		expect(published.jwks).toEqual(keySet);
	});

	test("builds both metadata documents from the same tenant facts, so they never drift", async () => {
		await advanceSigningKeys(db, { now: T0 });

		let published = await publishMetadata(db, { now: T0, issuer: ISSUER });

		expect(published.openidConfiguration.issuer).toBe(ISSUER);
		expect(published.oauthMetadata.issuer).toBe(ISSUER);
		expect(published.openidConfiguration.authorization_endpoint).toBe(
			published.oauthMetadata.authorization_endpoint,
		);
		expect(published.openidConfiguration.token_endpoint).toBe(
			published.oauthMetadata.token_endpoint,
		);
		expect(published.openidConfiguration.authorization_endpoint).toBe(`${ISSUER}/authorize`);
		expect(published.openidConfiguration.token_endpoint).toBe(`${ISSUER}/oauth/token`);
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

		let published = await publishMetadata(db, { now: T0, issuer: ISSUER });

		expect(published.openidConfiguration.scopes_supported).toEqual(
			expect.arrayContaining([
				"openid",
				"profile",
				"email",
				"address",
				"offline_access",
				"read:roles",
			]),
		);
		expect(published.openidConfiguration.claims_supported).toEqual(
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

	test("changes version once a rotation publishes a new key", async () => {
		await advanceSigningKeys(db, { now: T0 });
		let before = await publishMetadata(db, { now: T0, issuer: ISSUER });

		// Past the signing window, so a successor is staged and published alongside
		// the incumbent, ahead of ever signing.
		await advanceSigningKeys(db, { now: T0 + 90 * DAY_MS });
		let afterStaging = await publishMetadata(db, { now: T0 + 90 * DAY_MS, issuer: ISSUER });

		expect(afterStaging.version).not.toBe(before.version);
		expect(afterStaging.jwks.keys).toHaveLength(2);
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
});
