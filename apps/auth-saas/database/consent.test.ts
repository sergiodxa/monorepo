/**
 * Drives `consent.ts` directly against a `Database` over a real SQLite-backed
 * `SqlStorage`, the way `clients.test.ts` and `sessions.test.ts` drive their own
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

import type { RegisterClientInput } from "./clients";

import { registerClient } from "./clients";
import { evaluateConsent, grants, listGrants, recordConsentDecision, revokeGrant } from "./consent";
import { addIdentifier, createSubject, verifyIdentifier } from "./subjects";
import { runMigrations } from "./tenant-migrations";
import consentMigration from "./tenant-migrations/0008-consent.sql?raw";

let db: Database;

beforeEach(async () => {
	let state = createDurableObjectState();
	let driver = createSQLStorageDatabaseAdapter(state.storage.sql);
	await runMigrations(driver);
	await driver.executeScript(consentMigration);
	db = new Database(driver);
});

/** Creates a subject with a verified, primary email, for tests that need one on hand. */
async function createTestSubject(email = "person@example.com"): Promise<string> {
	let created = await createSubject(db, { profile: { name: "Ada Lovelace" } });
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

/** Registers a client, throwing if the record was refused, for tests that need one already made. */
async function createTestClient(overrides: Partial<RegisterClientInput> = {}) {
	let result = await registerClient(db, {
		name: "Test Client",
		kind: "confidential",
		redirectUris: ["https://example.com/callback"],
		postLogoutRedirectUris: [],
		grantTypes: ["authorization_code"],
		responseTypes: ["code"],
		scopes: ["openid", "profile", "email"],
		tokenEndpointAuthMethod: "client_secret_basic",
		requireConsent: false,
		...overrides,
	});
	if (!result.ok) throw new Error("unreachable");
	return result.client;
}

describe("evaluateConsent", () => {
	test("skips for a first-party client, granting whatever it asked for", async () => {
		let subjectId = await createTestSubject();
		let client = await createTestClient();

		let result = await evaluateConsent(db, {
			subjectId,
			clientId: client.id,
			requestedScopes: ["openid", "profile"],
			isFirstParty: true,
			promptConsent: false,
			silent: false,
		});

		expect(result).toEqual({ decision: "skip", grantedScopes: ["openid", "profile"] });
	});

	test("skips when a stored grant already covers every requested scope", async () => {
		let subjectId = await createTestSubject();
		let client = await createTestClient();

		await recordConsentDecision(db, {
			subjectId,
			clientId: client.id,
			approved: true,
			scopes: ["openid", "profile"],
		});

		let result = await evaluateConsent(db, {
			subjectId,
			clientId: client.id,
			requestedScopes: ["openid"],
			isFirstParty: false,
			promptConsent: false,
			silent: false,
		});

		expect(result).toEqual({ decision: "skip", grantedScopes: ["openid", "profile"] });
	});

	test("shows a screen listing only the new scopes when the stored grant misses some", async () => {
		let subjectId = await createTestSubject();
		let client = await createTestClient();

		await recordConsentDecision(db, {
			subjectId,
			clientId: client.id,
			approved: true,
			scopes: ["openid"],
		});

		let result = await evaluateConsent(db, {
			subjectId,
			clientId: client.id,
			requestedScopes: ["openid", "email"],
			isFirstParty: false,
			promptConsent: false,
			silent: false,
		});

		if (result.decision !== "show") throw new Error("unreachable");
		expect(result.screen.requested).toEqual([
			expect.objectContaining({ scope: "openid", granted: true }),
			expect.objectContaining({ scope: "email", granted: false }),
		]);
	});

	test("shows a screen when there is no stored grant at all", async () => {
		let subjectId = await createTestSubject();
		let client = await createTestClient();

		let result = await evaluateConsent(db, {
			subjectId,
			clientId: client.id,
			requestedScopes: ["openid"],
			isFirstParty: false,
			promptConsent: false,
			silent: false,
		});

		if (result.decision !== "show") throw new Error("unreachable");
		expect(result.screen.requested).toEqual([
			expect.objectContaining({ scope: "openid", granted: false }),
		]);
	});

	test("shows a screen even with full coverage when promptConsent is true", async () => {
		let subjectId = await createTestSubject();
		let client = await createTestClient();

		await recordConsentDecision(db, {
			subjectId,
			clientId: client.id,
			approved: true,
			scopes: ["openid"],
		});

		let result = await evaluateConsent(db, {
			subjectId,
			clientId: client.id,
			requestedScopes: ["openid"],
			isFirstParty: false,
			promptConsent: true,
			silent: false,
		});

		if (result.decision !== "show") throw new Error("unreachable");
		expect(result.screen.requested).toEqual([
			expect.objectContaining({ scope: "openid", granted: true }),
		]);
	});

	test("refuses silently when consent would be required and the caller demands no interaction", async () => {
		let subjectId = await createTestSubject();
		let client = await createTestClient();

		let result = await evaluateConsent(db, {
			subjectId,
			clientId: client.id,
			requestedScopes: ["openid"],
			isFirstParty: false,
			promptConsent: false,
			silent: true,
		});

		expect(result).toEqual({ decision: "consent-required-silent" });
	});

	test("answers not-found for a client that does not resolve in this tenant", async () => {
		let subjectId = await createTestSubject();

		let result = await evaluateConsent(db, {
			subjectId,
			clientId: "client_missing",
			requestedScopes: ["openid"],
			isFirstParty: false,
			promptConsent: false,
			silent: false,
		});

		expect(result).toEqual({ decision: "not-found" });
	});

	test("assembles the screen's client, subject and per-scope claims from the seeded rows", async () => {
		let subjectId = await createTestSubject("ada@example.com");
		let client = await createTestClient({ name: "Invoices App" });

		let result = await evaluateConsent(db, {
			subjectId,
			clientId: client.id,
			requestedScopes: ["profile", "email"],
			isFirstParty: false,
			promptConsent: false,
			silent: false,
		});

		if (result.decision !== "show") throw new Error("unreachable");

		expect(result.screen.client).toEqual({
			id: client.id,
			name: "Invoices App",
			logoUri: null,
			policyUri: null,
			tosUri: null,
		});
		expect(result.screen.subject).toEqual({
			id: subjectId,
			displayName: "Ada Lovelace",
			email: "ada@example.com",
		});
		expect(result.screen.requested).toEqual([
			{
				scope: "profile",
				title: "Your profile",
				description: "Your name, picture, and other basic profile details.",
				granted: false,
			},
			{
				scope: "email",
				title: "Your email address",
				description: "Your email address and whether it has been verified.",
				granted: false,
			},
		]);
	});
});

describe("recordConsentDecision", () => {
	test("unions newly agreed scopes into an existing grant rather than replacing it", async () => {
		let subjectId = await createTestSubject();
		let client = await createTestClient();

		let first = await recordConsentDecision(db, {
			subjectId,
			clientId: client.id,
			approved: true,
			scopes: ["openid"],
		});
		expect(first).toEqual({ decision: "approved", scopes: ["openid"] });

		let second = await recordConsentDecision(db, {
			subjectId,
			clientId: client.id,
			approved: true,
			scopes: ["email"],
		});
		expect(second.decision).toBe("approved");
		if (second.decision !== "approved") throw new Error("unreachable");
		expect(new Set(second.scopes)).toEqual(new Set(["openid", "email"]));

		let row = await db.find(grants, { subject_id: subjectId, client_id: client.id });
		expect(new Set(row?.scopes as string[])).toEqual(new Set(["openid", "email"]));
	});

	test("does nothing on denial", async () => {
		let subjectId = await createTestSubject();
		let client = await createTestClient();

		let result = await recordConsentDecision(db, {
			subjectId,
			clientId: client.id,
			approved: false,
			scopes: ["openid"],
		});

		expect(result).toEqual({ decision: "denied" });
		expect(await db.find(grants, { subject_id: subjectId, client_id: client.id })).toBeNull();
	});
});

describe("revokeGrant", () => {
	test("revokes an existing grant", async () => {
		let subjectId = await createTestSubject();
		let client = await createTestClient();

		await recordConsentDecision(db, {
			subjectId,
			clientId: client.id,
			approved: true,
			scopes: ["openid"],
		});

		let result = await revokeGrant(db, { subjectId, clientId: client.id });

		expect(result).toEqual({ kind: "revoked" });
		expect(await db.find(grants, { subject_id: subjectId, client_id: client.id })).toBeNull();
	});

	test("answers unknown for a pair with no grant", async () => {
		let subjectId = await createTestSubject();
		let client = await createTestClient();

		let result = await revokeGrant(db, { subjectId, clientId: client.id });

		expect(result).toEqual({ kind: "unknown" });
	});
});

describe("listGrants", () => {
	test("pages a subject's grants newest first, with the joined client name", async () => {
		let subjectId = await createTestSubject();

		let first = await createTestClient({ name: "First App" });
		await recordConsentDecision(db, {
			subjectId,
			clientId: first.id,
			approved: true,
			scopes: ["openid"],
		});
		await db.update(grants, { subject_id: subjectId, client_id: first.id }, { created_at: 1_000 });

		let second = await createTestClient({ name: "Second App" });
		await recordConsentDecision(db, {
			subjectId,
			clientId: second.id,
			approved: true,
			scopes: ["openid"],
		});
		await db.update(grants, { subject_id: subjectId, client_id: second.id }, { created_at: 2_000 });

		let third = await createTestClient({ name: "Third App" });
		await recordConsentDecision(db, {
			subjectId,
			clientId: third.id,
			approved: true,
			scopes: ["openid"],
		});
		await db.update(grants, { subject_id: subjectId, client_id: third.id }, { created_at: 3_000 });

		let page = await listGrants(db, { subjectId, limit: 2 });
		if (!page.ok) throw new Error("unreachable");

		expect(page.grants).toEqual([
			{ clientId: third.id, clientName: "Third App", scopes: ["openid"], createdAt: 3_000 },
			{ clientId: second.id, clientName: "Second App", scopes: ["openid"], createdAt: 2_000 },
		]);
		expect(page.cursors.next).not.toBeNull();

		let next = await listGrants(db, { subjectId, cursor: page.cursors.next, limit: 2 });
		if (!next.ok) throw new Error("unreachable");

		expect(next.grants).toEqual([
			{ clientId: first.id, clientName: "First App", scopes: ["openid"], createdAt: 1_000 },
		]);
		expect(next.cursors.next).toBeNull();
	});

	test("answers bad-cursor for a cursor this ordering did not mint", async () => {
		let subjectId = await createTestSubject();

		let page = await listGrants(db, { subjectId, cursor: "not-a-real-cursor" });

		expect(page).toEqual({ ok: false, reason: "bad-cursor" });
	});
});
