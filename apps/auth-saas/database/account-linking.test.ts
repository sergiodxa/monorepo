/**
 * Proves the account-linking decision and its ticket mechanism in isolation from
 * any sign-in flow, since neither is wired into one yet.
 *
 * `evaluateAutomaticLink` is pure, so its own tests never touch a database: every
 * one of the automatic linking rule's six conditions is shown failing on its own,
 * all six holding together, and `auto_link` off overriding an otherwise-qualifying
 * response. `isConnectionAuthoritativeForEmail` is proven against a real database
 * for both of its two sources — the connection's own flag, and a verified
 * organization domain — and against a connection with neither. `mintLinkTicket`
 * and `spendLinkTicket` are proven round-trip: a mint then a spend succeeds once,
 * a second spend of the same ticket fails, an expired ticket fails, and a ticket
 * that was never minted fails.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurableObjectStateMock } from "@sdxc/cloudflare-mocks";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { importKey, randomToken } from "@sdxc/crypto";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { isFailure } from "@sdxc/result";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import type { MatchedSubjectForLinking } from "./account-linking";

import {
	evaluateAutomaticLink,
	isConnectionAuthoritativeForEmail,
	mintLinkTicket,
	pendingLinkTickets,
	spendLinkTicket,
} from "./account-linking";
import { organizationDomains } from "./organizations";
import { runMigrations } from "./tenant-migrations";

/** A tenant database with every migration applied, isolated from any `Tenant` object. */
async function createTenantDatabase(): Promise<Database> {
	let state: DurableObjectStateMock = createDurableObjectState();
	let driver = createSQLStorageDatabaseAdapter(state.storage.sql);
	await runMigrations(driver);
	return new Database(driver);
}

/** A fresh AES-GCM seal key, the same shape a tenant object imports its own from. */
async function createSealKey(): Promise<CryptoKey> {
	let imported = await importKey(randomToken({ bytes: 32 }));
	if (isFailure(imported)) throw new Error("failed to import a test seal key");
	return imported.data;
}

let qualifyingSubject: MatchedSubjectForLinking = {
	identifierVerified: true,
	subjectStatus: "active",
};

let baseInput = {
	responseEmail: "jane@example.com",
	responseEmailVerified: true,
	connectionIsAuthoritative: true,
	connectionAutoLink: true,
	matchedSubject: qualifyingSubject,
};

describe("evaluateAutomaticLink", () => {
	test("links automatically when every condition holds", () => {
		expect(evaluateAutomaticLink(baseInput)).toEqual({ outcome: "automatic" });
	});

	test("takes the confirmed path when the response carries no email", () => {
		let result = evaluateAutomaticLink({ ...baseInput, responseEmail: null });
		expect(result).toEqual({ outcome: "confirmed", reason: "no-response-email" });
	});

	test("takes the confirmed path when the response does not assert the email verified", () => {
		let result = evaluateAutomaticLink({ ...baseInput, responseEmailVerified: false });
		expect(result).toEqual({ outcome: "confirmed", reason: "response-email-not-verified" });
	});

	test("takes the confirmed path when the connection is not an authoritative source", () => {
		let result = evaluateAutomaticLink({ ...baseInput, connectionIsAuthoritative: false });
		expect(result).toEqual({ outcome: "confirmed", reason: "connection-not-authoritative" });
	});

	test("takes the confirmed path when the folded address matched no subject", () => {
		let result = evaluateAutomaticLink({ ...baseInput, matchedSubject: null });
		expect(result).toEqual({ outcome: "confirmed", reason: "no-matched-identifier" });
	});

	test("takes the confirmed path when the matched identifier was never verified here", () => {
		let result = evaluateAutomaticLink({
			...baseInput,
			matchedSubject: { identifierVerified: false, subjectStatus: "active" },
		});
		expect(result).toEqual({ outcome: "confirmed", reason: "identifier-not-verified" });
	});

	test("takes the confirmed path when the matched subject is not active", () => {
		let result = evaluateAutomaticLink({
			...baseInput,
			matchedSubject: { identifierVerified: true, subjectStatus: "blocked" },
		});
		expect(result).toEqual({ outcome: "confirmed", reason: "subject-not-active" });
	});

	test("takes the confirmed path when the connection has auto_link off, even with every proof condition met", () => {
		let result = evaluateAutomaticLink({ ...baseInput, connectionAutoLink: false });
		expect(result).toEqual({ outcome: "confirmed", reason: "auto-link-disabled" });
	});
});

describe("isConnectionAuthoritativeForEmail", () => {
	let db: Database;

	beforeEach(async () => {
		db = await createTenantDatabase();
	});

	test("trusts a connection the catalog (or a tenant override) marks a per-response authority", async () => {
		let authoritative = await isConnectionAuthoritativeForEmail(
			db,
			{ email_authority: true, organization_id: null },
			"jane@example.com",
		);
		expect(authoritative).toBe(true);
	});

	test("trusts a non-authoritative connection for an address inside its organization's verified domain", async () => {
		await db.create(organizationDomains, {
			domain: "example.com",
			organization_id: "org_1",
			mode: "auto_join",
			verification_value: "verify-me",
			verified_at: Date.now(),
			created_at: Date.now(),
		});

		let authoritative = await isConnectionAuthoritativeForEmail(
			db,
			{ email_authority: false, organization_id: "org_1" },
			"jane@example.com",
		);
		expect(authoritative).toBe(true);
	});

	test("does not trust a generic connection with neither authority source", async () => {
		let authoritative = await isConnectionAuthoritativeForEmail(
			db,
			{ email_authority: false, organization_id: null },
			"jane@example.com",
		);
		expect(authoritative).toBe(false);
	});

	test("does not trust a domain claim that belongs to a different organization", async () => {
		await db.create(organizationDomains, {
			domain: "example.com",
			organization_id: "org_1",
			mode: "auto_join",
			verification_value: "verify-me",
			verified_at: Date.now(),
			created_at: Date.now(),
		});

		let authoritative = await isConnectionAuthoritativeForEmail(
			db,
			{ email_authority: false, organization_id: "org_2" },
			"jane@example.com",
		);
		expect(authoritative).toBe(false);
	});

	test("does not trust a domain claim that has not been verified yet", async () => {
		await db.create(organizationDomains, {
			domain: "example.com",
			organization_id: "org_1",
			mode: "auto_join",
			verification_value: "verify-me",
			verified_at: null,
			created_at: Date.now(),
		});

		let authoritative = await isConnectionAuthoritativeForEmail(
			db,
			{ email_authority: false, organization_id: "org_1" },
			"jane@example.com",
		);
		expect(authoritative).toBe(false);
	});
});

describe("mintLinkTicket / spendLinkTicket", () => {
	let db: Database;
	let sealKey: CryptoKey;

	beforeEach(async () => {
		db = await createTenantDatabase();
		sealKey = await createSealKey();
	});

	let ticketInput = {
		connectionId: "conn_1",
		providerSubject: "provider-sub-1",
		subjectId: "sub_1",
		providerEmail: "jane@example.com",
		providerEmailVerified: true,
		grantedScopes: ["openid", "email"],
		claims: { sub: "provider-sub-1", email: "jane@example.com" },
		refreshToken: "refresh-token-value",
		tokenExpiresAt: Date.now() + 60_000,
	};

	test("a minted ticket spends once and hands back everything it named", async () => {
		let ticket = await mintLinkTicket(db, sealKey, ticketInput);

		let spent = await spendLinkTicket(db, sealKey, { ticket });

		expect(spent).toMatchObject({
			ok: true,
			connectionId: "conn_1",
			providerSubject: "provider-sub-1",
			subjectId: "sub_1",
			providerEmail: "jane@example.com",
			providerEmailVerified: true,
			grantedScopes: ["openid", "email"],
			refreshToken: "refresh-token-value",
		});
	});

	test("a second spend of the same ticket fails", async () => {
		let ticket = await mintLinkTicket(db, sealKey, ticketInput);

		await spendLinkTicket(db, sealKey, { ticket });
		let replay = await spendLinkTicket(db, sealKey, { ticket });

		expect(replay).toEqual({ ok: false, reason: "invalid-ticket" });
	});

	test("an expired ticket fails", async () => {
		let ticket = await mintLinkTicket(db, sealKey, ticketInput);

		// Every row this table can hold expires on the same schedule, so backdating
		// the one row a fresh mint just wrote is the whole setup an expiry test needs.
		await db.updateMany(pendingLinkTickets, { expires_at: Date.now() - 1 }, { where: {} });

		let spent = await spendLinkTicket(db, sealKey, { ticket });

		expect(spent).toEqual({ ok: false, reason: "invalid-ticket" });
	});

	test("a tampered or unknown ticket fails", async () => {
		await mintLinkTicket(db, sealKey, ticketInput);

		let spent = await spendLinkTicket(db, sealKey, { ticket: "not-a-real-ticket" });

		expect(spent).toEqual({ ok: false, reason: "invalid-ticket" });
	});
});
