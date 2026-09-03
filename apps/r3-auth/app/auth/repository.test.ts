/**
 * Unit tests for the OIDC engine's storage binding: single-use consumption of KV
 * authorization codes, session lookup and revocation, consent find-or-create, and
 * the two logout queries that decide which relying parties get notified.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { createKVNamespace } from "@pkg/cloudflare-mocks";
import { beforeEach, describe, expect, test, vi } from "vitest";

let kv = createKVNamespace();

/**
 * A getter, so every read resolves the namespace `beforeEach` installed for the
 * current test while the subject reads `env.KV` per call. The mock registers
 * before the subject imports it, so the imports below are dynamic.
 */
vi.doMock("cloudflare:workers", () => ({
	env: {
		get KV() {
			return kv;
		},
	},
}));

let { createOidcRepository } = await import("~/app/auth/repository");
let { AUTHZ_CODE_TTL } = await import("~/app/config");
let { default: Client } = await import("~/app/data/client");
let { default: Grant } = await import("~/app/data/grant");
let { default: Session } = await import("~/app/data/session");
let { default: Subject } = await import("~/app/data/subject");
let { createTestDatabase } = await import("~/app/lib/test/db");
let { clients } = await import("~/database/schema");

let db: Database;
let repository: ReturnType<typeof createOidcRepository>;
let subjectId: string;
let clientId: string;

/** The authorization request a stored code carries back to the relying party. */
function authzCodeData(overrides: Record<string, unknown> = {}) {
	return {
		clientId,
		subjectId,
		sessionId: "session-1",
		pkce: null,
		nonce: null,
		scope: ["openid", "email"],
		authTime: Math.floor(Date.now() / 1000),
		...overrides,
	};
}

beforeEach(async () => {
	kv = createKVNamespace();

	db = createTestDatabase().db;
	repository = createOidcRepository(db);

	let subject = await Subject.create(db, {
		email_address: "jane@example.com",
		display_name: "Jane Doe",
		username: "jane",
		avatar: "https://example.com/jane.png",
	});
	subjectId = subject.id;

	let client = await Client.create(db, {
		name: "Blog",
		redirect_uri: "https://blog.example.com/auth/callback",
		logout_uri: "https://blog.example.com/logout",
	});
	clientId = client.id;
});

describe("authorization codes", () => {
	test("stores a code under the shared prefix and TTL, with the payload unchanged", async () => {
		let data = authzCodeData();
		await repository.storeAuthorizationCode("code-1", data);

		let raw = await kv.get("authz-code:code-1");

		expect(raw).not.toBeNull();
		expect(JSON.parse(raw ?? "null")).toEqual(data);
		expect(AUTHZ_CODE_TTL / 1000).toBe(600);
	});

	test("consumes a code: the first redemption returns it and the second finds nothing", async () => {
		await repository.storeAuthorizationCode("code-1", authzCodeData());

		let first = await repository.findAuthorizationCodeData("code-1");
		let second = await repository.findAuthorizationCodeData("code-1");

		expect(first?.subjectId).toBe(subjectId);
		expect(first?.scope).toEqual(["openid", "email"]);
		expect(second).toBeNull();
	});

	test("deletes the entry before returning, so a replay cannot race the first redemption", async () => {
		await repository.storeAuthorizationCode("code-1", authzCodeData());

		await repository.findAuthorizationCodeData("code-1");

		expect(await kv.get("authz-code:code-1")).toBeNull();
	});

	test("keeps a PKCE challenge exactly as it was stored", async () => {
		await repository.storeAuthorizationCode(
			"code-1",
			authzCodeData({ pkce: { challenge: "abc123", method: "S256" }, nonce: "n-1" }),
		);

		let data = await repository.findAuthorizationCodeData("code-1");

		expect(data?.pkce).toEqual({ challenge: "abc123", method: "S256" });
		expect(data?.nonce).toBe("n-1");
	});

	test("returns null for an unknown code instead of throwing, so it maps to invalid_grant", async () => {
		expect(await repository.findAuthorizationCodeData("never-issued")).toBeNull();
	});

	test("returns null for an entry that is not a valid authorization code", async () => {
		await kv.put("authz-code:code-1", JSON.stringify({ clientId: 1 }));

		expect(await repository.findAuthorizationCodeData("code-1")).toBeNull();
	});
});

describe("sessions", () => {
	test("resolves a refresh token to its session with epoch-ms columns read as dates", async () => {
		let created = await Session.create(db, subjectId, clientId, "203.0.113.1", "Firefox");

		let session = await repository.findSessionById(created.id);

		expect(session?.id).toBe(created.id);
		expect(session?.clientId).toBe(clientId);
		expect(session?.subjectId).toBe(subjectId);
		expect(session?.expiresAt.getTime()).toBe(created.expires_at);
		expect(session?.createdAt.getTime()).toBe(created.created_at);
	});

	test("returns null for a refresh token that names no session", async () => {
		expect(await repository.findSessionById("not-a-session")).toBeNull();
	});

	test("creates a session whose id is the refresh token the client will present", async () => {
		let { id } = await repository.createSession(subjectId, clientId, null, null, ["openid"]);

		expect(await repository.findSessionById(id)).not.toBeNull();
	});

	test("revokes one session and leaves the subject's other sessions alone", async () => {
		let first = await Session.create(db, subjectId, clientId, null, null);
		let second = await Session.create(db, subjectId, clientId, null, null);

		await repository.deleteSessionById(first.id);

		expect(await repository.findSessionById(first.id)).toBeNull();
		expect(await repository.findSessionById(second.id)).not.toBeNull();
	});

	test("revokes every session a subject holds, which is what logout means here", async () => {
		let first = await Session.create(db, subjectId, clientId, null, null);
		let second = await Session.create(db, subjectId, clientId, null, null);

		await repository.deleteSessionBySubjectId(subjectId);

		expect(await repository.findSessionById(first.id)).toBeNull();
		expect(await repository.findSessionById(second.id)).toBeNull();
	});
});

describe("clients", () => {
	test("resolves a registered logout URI to the client that registered it", async () => {
		let client = await repository.findClientByLogoutUri("https://blog.example.com/logout");

		expect(client?.id).toBe(clientId);
		expect(client?.logoutUri).toBe("https://blog.example.com/logout");
	});

	test("matches a logout URI exactly, never by prefix, origin or trailing slash", async () => {
		expect(await repository.findClientByLogoutUri("https://blog.example.com/logout/")).toBeNull();
		expect(await repository.findClientByLogoutUri("https://blog.example.com")).toBeNull();
		expect(
			await repository.findClientByLogoutUri("https://blog.example.com/logout/../evil"),
		).toBeNull();
		expect(
			await repository.findClientByLogoutUri("https://blog.example.com.evil.test/logout"),
		).toBeNull();
	});

	test("returns null for an address no client registered", async () => {
		expect(
			await repository.findClientByLogoutUri("https://malicious.example.com/steal"),
		).toBeNull();
	});

	/**
	 * The lookup answers only whether an address is registered, so a duplicate
	 * resolves to one registration, and to the same one on every call.
	 */
	test("answers with one stable registration when two clients share a logout URI", async () => {
		let twin = await Client.create(db, {
			name: "Blog Mirror",
			redirect_uri: "https://mirror.example.com/auth/callback",
			logout_uri: "https://blog.example.com/logout",
		});

		let first = await repository.findClientByLogoutUri("https://blog.example.com/logout");
		let second = await repository.findClientByLogoutUri("https://blog.example.com/logout");

		let firstId = first?.id ?? "";
		let secondId = second?.id ?? "";

		expect([clientId, twin.id]).toContain(firstId);
		expect(secondId).toBe(firstId);
	});
});

describe("grants", () => {
	test("records consent the first time a subject authorizes a client", async () => {
		let grant = await repository.findOrCreateGrant(subjectId, clientId);

		expect(grant.subjectId).toBe(subjectId);
		expect(grant.clientId).toBe(clientId);
	});

	test("returns the same grant on re-authorization instead of recording a second consent", async () => {
		let first = await repository.findOrCreateGrant(subjectId, clientId);
		let second = await repository.findOrCreateGrant(subjectId, clientId);

		expect(second.id).toBe(first.id);
		expect(await Grant.countByClientId(db, clientId)).toBe(1);
	});
});

describe("logout queries", () => {
	beforeEach(async () => {
		await db.update(
			clients,
			clientId,
			{
				backchannel_logout_uri: "https://blog.example.com/backchannel",
				backchannel_logout_session_required: "true",
				frontchannel_logout_uri: "https://blog.example.com/frontchannel",
			},
			{ touch: true },
		);
	});

	test("returns a session per client that registered the requested channel", async () => {
		let session = await Session.create(db, subjectId, clientId, null, null);

		let backchannel = await repository.findSessionsForBackchannelLogout(subjectId);
		let frontchannel = await repository.findSessionsForFrontchannelLogout(subjectId);

		expect(backchannel).toHaveLength(1);
		expect(backchannel[0]?.sessionId).toBe(session.id);
		expect(backchannel[0]?.backchannelLogoutUri).toBe("https://blog.example.com/backchannel");
		expect(backchannel[0]?.backchannelLogoutSessionRequired).toBe("true");
		expect(frontchannel).toHaveLength(1);
		expect(frontchannel[0]?.frontchannelLogoutUri).toBe("https://blog.example.com/frontchannel");
	});

	test("excludes the client that initiated the logout, which needs no notification", async () => {
		await Session.create(db, subjectId, clientId, null, null);

		expect(await repository.findSessionsForBackchannelLogout(subjectId, clientId)).toEqual([]);
		expect(await repository.findSessionsForFrontchannelLogout(subjectId, clientId)).toEqual([]);
	});

	test("skips clients that registered no URI for the channel being used", async () => {
		let other = await Client.create(db, {
			name: "Uptime",
			redirect_uri: "https://uptime.example.com/auth/callback",
			logout_uri: "https://uptime.example.com/logout",
		});
		await db.update(
			clients,
			other.id,
			{ backchannel_logout_uri: "https://uptime.example.com/backchannel" },
			{ touch: true },
		);
		await Session.create(db, subjectId, other.id, null, null);
		await Session.create(db, subjectId, clientId, null, null);

		let backchannel = await repository.findSessionsForBackchannelLogout(subjectId);
		let frontchannel = await repository.findSessionsForFrontchannelLogout(subjectId);

		expect(backchannel.map((row) => row.clientId).sort()).toEqual([clientId, other.id].sort());
		expect(frontchannel.map((row) => row.clientId)).toEqual([clientId]);
	});

	test("returns nothing for a subject with no sessions at all", async () => {
		expect(await repository.findSessionsForBackchannelLogout(subjectId)).toEqual([]);
	});
});
