/**
 * Drives `authorization.ts` directly against a `Database` over a real SQLite-backed
 * `SqlStorage`, the way `clients.test.ts` and `consent.test.ts` drive their own modules:
 * nothing here can wire a new RPC method onto the tenant object, so these functions are
 * exercised the same way it will eventually call them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableRow } from "remix/data-table";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { Database } from "remix/data-table";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { RegisterClientInput } from "./clients";

import {
	authorizationCodes,
	authorizationRequests,
	beginAuthorization,
	resumeAuthorization,
	sweepExpiredAuthorizationCodes,
	sweepExpiredAuthorizationRequests,
} from "./authorization";
import { clients, registerClient } from "./clients";
import { recordConsentDecision } from "./consent";
import { openSession, sessions } from "./sessions";
import { createSubject } from "./subjects";
import { runMigrations } from "./tenant-migrations";
import authorizationMigration from "./tenant-migrations/0009-authorization.sql?raw";

/** The shape one row of `authorization_codes` takes, for the sweep tests' own fixture. */
type AuthorizationCodeRowShape = TableRow<typeof authorizationCodes>;

/** The tenant's issuer, stamped onto every redirected error as `iss`. */
const ISSUER = "https://tenant.example.com";

/** The default redirect URI every test client registers. */
const REDIRECT_URI = "https://example.com/callback";

let db: Database;

beforeEach(async () => {
	let state = createDurableObjectState();
	let driver = createSQLStorageDatabaseAdapter(state.storage.sql);
	await runMigrations(driver);
	await driver.executeScript(authorizationMigration);
	db = new Database(driver);
});

afterEach(() => {
	vi.useRealTimers();
});

/** Registers a client, throwing if the record was refused, for tests that need one already made. */
async function createTestClient(overrides: Partial<RegisterClientInput> = {}) {
	let result = await registerClient(db, {
		name: "Test Client",
		kind: "confidential",
		redirectUris: [REDIRECT_URI],
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

/** Creates a bare subject, the shape most tests open a session for. */
let nextTestSubjectSuffix = 0;

async function createTestSubject(): Promise<string> {
	let username = `jane-${nextTestSubjectSuffix++}`;
	let created = await createSubject(db, { identifiers: [{ kind: "username", value: username }] });
	if (!created.ok) throw new Error("unreachable");
	return created.subjectId;
}

/** Opens a session for a fresh subject and returns both ids, for tests that need one on hand. */
async function openTestSession(): Promise<{ subjectId: string; sessionId: string }> {
	let subjectId = await createTestSubject();
	let opened = await openSession(db, { subjectId, amr: ["pwd"], remembered: true });
	return { subjectId, sessionId: opened.sessionId };
}

/** The query params a valid `/authorize` request carries when a test does not care about most of it. */
function baseQuery(
	clientId: string,
	overrides: Partial<Record<string, string>> = {},
): Record<string, string> {
	return {
		client_id: clientId,
		redirect_uri: REDIRECT_URI,
		response_type: "code",
		scope: "openid",
		code_challenge: "a valid-looking challenge",
		code_challenge_method: "S256",
		...overrides,
	};
}

describe("beginAuthorization", () => {
	describe("render-class failures", () => {
		test("renders when client_id is missing", async () => {
			let outcome = await beginAuthorization(db, {
				query: baseQuery("", { client_id: "" }),
				sessionIds: [],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome).toEqual({
				kind: "render",
				error: "invalid_request",
				description: expect.any(String),
			});
		});

		test("renders when client_id names no registered client", async () => {
			let outcome = await beginAuthorization(db, {
				query: baseQuery("client_does_not_exist"),
				sessionIds: [],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome).toEqual({
				kind: "render",
				error: "invalid_client",
				description: expect.any(String),
			});
		});

		test("renders when the client has been disabled", async () => {
			let client = await createTestClient();
			await db.update(clients, { id: client.id }, { disabled_at: Date.now() });

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id),
				sessionIds: [],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome).toEqual({
				kind: "render",
				error: "invalid_client",
				description: expect.any(String),
			});
		});

		test("renders when redirect_uri is missing", async () => {
			let client = await createTestClient();

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { redirect_uri: "" }),
				sessionIds: [],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome).toEqual({
				kind: "render",
				error: "invalid_request",
				description: expect.any(String),
			});
		});

		test("renders when redirect_uri does not match a registered value", async () => {
			let client = await createTestClient();

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { redirect_uri: "https://evil.example.com/callback" }),
				sessionIds: [],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome).toEqual({
				kind: "render",
				error: "invalid_request",
				description: expect.any(String),
			});
		});

		test("accepts a loopback redirect_uri that only differs by port", async () => {
			let client = await createTestClient({
				kind: "public",
				redirectUris: ["http://127.0.0.1:4000/cb"],
				tokenEndpointAuthMethod: "none",
			});

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { redirect_uri: "http://127.0.0.1:59123/cb" }),
				sessionIds: [],
				now: Date.now(),
				issuer: ISSUER,
			});

			// A verified target was found, so this authenticates rather than rendering.
			expect(outcome.kind).toBe("authenticate");
		});
	});

	describe("redirect-class failures", () => {
		test("redirects unsupported_response_type for anything but code", async () => {
			let client = await createTestClient();

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { response_type: "token" }),
				sessionIds: [],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome.kind).toBe("redirect");
			if (outcome.kind !== "redirect") throw new Error("unreachable");
			let location = new URL(outcome.location);
			expect(location.origin + location.pathname).toBe(REDIRECT_URI);
			expect(location.searchParams.get("error")).toBe("unsupported_response_type");
			expect(location.searchParams.get("iss")).toBe(ISSUER);
		});

		test("redirects unauthorized_client when the client is not registered for code", async () => {
			let client = await createTestClient({ responseTypes: [] });

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id),
				sessionIds: [],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome.kind).toBe("redirect");
			if (outcome.kind !== "redirect") throw new Error("unreachable");
			expect(new URL(outcome.location).searchParams.get("error")).toBe("unauthorized_client");
		});

		test("redirects invalid_scope when a requested scope is outside the client's ceiling", async () => {
			let client = await createTestClient({ scopes: ["openid"] });

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { scope: "openid admin" }),
				sessionIds: [],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome.kind).toBe("redirect");
			if (outcome.kind !== "redirect") throw new Error("unreachable");
			expect(new URL(outcome.location).searchParams.get("error")).toBe("invalid_scope");
		});

		test("redirects invalid_request when code_challenge is missing", async () => {
			let client = await createTestClient();

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { code_challenge: "" }),
				sessionIds: [],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome.kind).toBe("redirect");
			if (outcome.kind !== "redirect") throw new Error("unreachable");
			expect(new URL(outcome.location).searchParams.get("error")).toBe("invalid_request");
		});

		test("redirects invalid_request when code_challenge_method is not S256", async () => {
			let client = await createTestClient();

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { code_challenge_method: "plain" }),
				sessionIds: [],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome.kind).toBe("redirect");
			if (outcome.kind !== "redirect") throw new Error("unreachable");
			expect(new URL(outcome.location).searchParams.get("error")).toBe("invalid_request");
		});

		test("redirects invalid_request when prompt combines none with another value", async () => {
			let client = await createTestClient();

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { prompt: "none login" }),
				sessionIds: [],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome.kind).toBe("redirect");
			if (outcome.kind !== "redirect") throw new Error("unreachable");
			expect(new URL(outcome.location).searchParams.get("error")).toBe("invalid_request");
		});

		test("redirects invalid_request for an unrecognized prompt value", async () => {
			let client = await createTestClient();

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { prompt: "whatever" }),
				sessionIds: [],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome.kind).toBe("redirect");
			if (outcome.kind !== "redirect") throw new Error("unreachable");
			expect(new URL(outcome.location).searchParams.get("error")).toBe("invalid_request");
		});

		test("redirects invalid_request when max_age is not a non-negative integer", async () => {
			let client = await createTestClient();

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { max_age: "-1" }),
				sessionIds: [],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome.kind).toBe("redirect");
			if (outcome.kind !== "redirect") throw new Error("unreachable");
			expect(new URL(outcome.location).searchParams.get("error")).toBe("invalid_request");
		});

		test("preserves an existing query string and echoes state on an error redirect", async () => {
			let client = await createTestClient({
				redirectUris: ["https://example.com/callback?tenant=acme"],
			});

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, {
					redirect_uri: "https://example.com/callback?tenant=acme",
					response_type: "token",
					state: "xyz",
				}),
				sessionIds: [],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome.kind).toBe("redirect");
			if (outcome.kind !== "redirect") throw new Error("unreachable");
			let location = new URL(outcome.location);
			expect(location.searchParams.get("tenant")).toBe("acme");
			expect(location.searchParams.get("state")).toBe("xyz");
			expect(location.searchParams.get("error")).toBe("unsupported_response_type");
		});
	});

	describe("the session and prompt decision", () => {
		test("no session, prompt absent: parks an unforced authenticate outcome", async () => {
			let client = await createTestClient();

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id),
				sessionIds: [],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome).toEqual({
				kind: "authenticate",
				interactionId: expect.any(String),
				loginHint: null,
				forced: false,
			});
		});

		test("no session, prompt=none: redirects login_required", async () => {
			let client = await createTestClient();

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { prompt: "none" }),
				sessionIds: [],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome.kind).toBe("redirect");
			if (outcome.kind !== "redirect") throw new Error("unreachable");
			expect(new URL(outcome.location).searchParams.get("error")).toBe("login_required");
		});

		test("no session, prompt=select_account: redirects account_selection_required", async () => {
			let client = await createTestClient();

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { prompt: "select_account" }),
				sessionIds: [],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome.kind).toBe("redirect");
			if (outcome.kind !== "redirect") throw new Error("unreachable");
			expect(new URL(outcome.location).searchParams.get("error")).toBe(
				"account_selection_required",
			);
		});

		test("valid session, prompt=login: parks a forced authenticate outcome", async () => {
			let client = await createTestClient();
			let { sessionId } = await openTestSession();

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { prompt: "login" }),
				sessionIds: [sessionId],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome).toEqual({
				kind: "authenticate",
				interactionId: expect.any(String),
				loginHint: null,
				forced: true,
			});
		});

		test("valid session, prompt=select_account: parks a forced authenticate outcome", async () => {
			let client = await createTestClient();
			let { sessionId } = await openTestSession();

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { prompt: "select_account" }),
				sessionIds: [sessionId],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome).toMatchObject({ kind: "authenticate", forced: true });
		});

		test("valid session older than max_age, prompt absent: parks a forced authenticate outcome", async () => {
			vi.useFakeTimers();
			vi.setSystemTime(1_700_000_000_000);

			let client = await createTestClient();
			let { sessionId } = await openTestSession();

			vi.setSystemTime(1_700_000_000_000 + 120_000);

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { max_age: "60" }),
				sessionIds: [sessionId],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome).toMatchObject({ kind: "authenticate", forced: true });
		});

		test("valid session older than max_age, prompt=none: redirects login_required", async () => {
			vi.useFakeTimers();
			vi.setSystemTime(1_700_000_000_000);

			let client = await createTestClient();
			let { sessionId } = await openTestSession();

			vi.setSystemTime(1_700_000_000_000 + 120_000);

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { max_age: "60", prompt: "none" }),
				sessionIds: [sessionId],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome.kind).toBe("redirect");
			if (outcome.kind !== "redirect") throw new Error("unreachable");
			expect(new URL(outcome.location).searchParams.get("error")).toBe("login_required");
		});

		test("valid session within max_age, prompt absent: proceeds past the forced-login check", async () => {
			vi.useFakeTimers();
			vi.setSystemTime(1_700_000_000_000);

			let client = await createTestClient();
			let { subjectId, sessionId } = await openTestSession();
			await recordConsentDecision(db, {
				subjectId,
				clientId: client.id,
				approved: true,
				scopes: ["openid"],
			});

			vi.setSystemTime(1_700_000_000_000 + 5_000);

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { max_age: "60" }),
				sessionIds: [sessionId],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome.kind).toBe("redirect");
			if (outcome.kind !== "redirect") throw new Error("unreachable");
			expect(new URL(outcome.location).searchParams.get("code")).toEqual(expect.any(String));
		});

		test("several valid sessions, prompt absent: parks an unforced authenticate outcome", async () => {
			let client = await createTestClient();
			let first = await openTestSession();
			let second = await openTestSession();

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id),
				sessionIds: [first.sessionId, second.sessionId],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome).toMatchObject({ kind: "authenticate", forced: false });
		});

		test("several valid sessions, prompt=none: redirects login_required", async () => {
			let client = await createTestClient();
			let first = await openTestSession();
			let second = await openTestSession();

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { prompt: "none" }),
				sessionIds: [first.sessionId, second.sessionId],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome.kind).toBe("redirect");
			if (outcome.kind !== "redirect") throw new Error("unreachable");
			expect(new URL(outcome.location).searchParams.get("error")).toBe("login_required");
		});

		test("ignores a revoked or expired session id among the candidates", async () => {
			let client = await createTestClient();
			let { sessionId } = await openTestSession();
			await db.update(sessions, { id: sessionId }, { revoked_at: Date.now() });

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id),
				sessionIds: [sessionId],
				now: Date.now(),
				issuer: ISSUER,
			});

			// Treated the same as no session at all.
			expect(outcome).toMatchObject({ kind: "authenticate", forced: false });
		});
	});

	describe("acr_values=mfa step-up", () => {
		test("valid session with no recent step-up proof: parks a step-up outcome", async () => {
			let client = await createTestClient();
			let { sessionId } = await openTestSession();

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { acr_values: "mfa" }),
				sessionIds: [sessionId],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome).toMatchObject({
				kind: "step-up",
				interactionId: expect.any(String),
				screen: { hasFactor: false },
			});
		});

		test("session already carrying a fresh mfa proof: proceeds past the step-up check", async () => {
			let client = await createTestClient();
			let { subjectId, sessionId } = await openTestSession();
			await recordConsentDecision(db, {
				subjectId,
				clientId: client.id,
				approved: true,
				scopes: ["openid"],
			});

			let now = Date.now();
			await db.update(sessions, { id: sessionId }, { acr: "mfa", auth_time: now });

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { acr_values: "mfa" }),
				sessionIds: [sessionId],
				now,
				issuer: ISSUER,
			});

			expect(outcome.kind).toBe("redirect");
			if (outcome.kind !== "redirect") throw new Error("unreachable");
			expect(new URL(outcome.location).searchParams.get("code")).toEqual(expect.any(String));
		});

		test("a stale mfa proof past the fifteen-minute window: parks a step-up outcome again", async () => {
			vi.useFakeTimers();
			vi.setSystemTime(1_700_000_000_000);

			let client = await createTestClient();
			let { sessionId } = await openTestSession();
			await db.update(sessions, { id: sessionId }, { acr: "mfa", auth_time: 1_700_000_000_000 });

			vi.setSystemTime(1_700_000_000_000 + 16 * 60 * 1000);

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { acr_values: "mfa" }),
				sessionIds: [sessionId],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome).toMatchObject({ kind: "step-up" });
		});

		test("no recent proof, prompt=none: redirects unmet_authentication_requirements", async () => {
			let client = await createTestClient();
			let { sessionId } = await openTestSession();

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { acr_values: "mfa", prompt: "none" }),
				sessionIds: [sessionId],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome.kind).toBe("redirect");
			if (outcome.kind !== "redirect") throw new Error("unreachable");
			expect(new URL(outcome.location).searchParams.get("error")).toBe(
				"unmet_authentication_requirements",
			);
		});
	});

	describe("consent", () => {
		test("skips straight to a code when a stored grant already covers every requested scope", async () => {
			let client = await createTestClient();
			let { subjectId, sessionId } = await openTestSession();
			await recordConsentDecision(db, {
				subjectId,
				clientId: client.id,
				approved: true,
				scopes: ["openid"],
			});

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id),
				sessionIds: [sessionId],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome.kind).toBe("redirect");
			if (outcome.kind !== "redirect") throw new Error("unreachable");
			expect(new URL(outcome.location).searchParams.get("code")).toEqual(expect.any(String));
		});

		test("shows a consent screen when no stored grant covers the requested scopes", async () => {
			let client = await createTestClient();
			let { sessionId } = await openTestSession();

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id),
				sessionIds: [sessionId],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome.kind).toBe("consent");
			if (outcome.kind !== "consent") throw new Error("unreachable");
			expect(outcome.screen.client.id).toBe(client.id);
			expect(outcome.interactionId).toEqual(expect.any(String));
		});

		test("prompt=consent shows a screen even when a stored grant already covers everything", async () => {
			let client = await createTestClient();
			let { subjectId, sessionId } = await openTestSession();
			await recordConsentDecision(db, {
				subjectId,
				clientId: client.id,
				approved: true,
				scopes: ["openid"],
			});

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { prompt: "consent" }),
				sessionIds: [sessionId],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome.kind).toBe("consent");
		});

		test("prompt=none with a covering grant mints a code silently", async () => {
			let client = await createTestClient();
			let { subjectId, sessionId } = await openTestSession();
			await recordConsentDecision(db, {
				subjectId,
				clientId: client.id,
				approved: true,
				scopes: ["openid"],
			});

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { prompt: "none" }),
				sessionIds: [sessionId],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome.kind).toBe("redirect");
			if (outcome.kind !== "redirect") throw new Error("unreachable");
			expect(new URL(outcome.location).searchParams.get("code")).toEqual(expect.any(String));
		});

		test("prompt=none with no covering grant redirects consent_required", async () => {
			let client = await createTestClient();
			let { sessionId } = await openTestSession();

			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { prompt: "none" }),
				sessionIds: [sessionId],
				now: Date.now(),
				issuer: ISSUER,
			});

			expect(outcome.kind).toBe("redirect");
			if (outcome.kind !== "redirect") throw new Error("unreachable");
			expect(new URL(outcome.location).searchParams.get("error")).toBe("consent_required");
		});
	});

	describe("code minting", () => {
		test("writes a fully populated authorization_codes row and a redirect carrying the code", async () => {
			let client = await createTestClient();
			let { subjectId, sessionId } = await openTestSession();
			await recordConsentDecision(db, {
				subjectId,
				clientId: client.id,
				approved: true,
				scopes: ["openid"],
			});

			let now = Date.now();
			let outcome = await beginAuthorization(db, {
				query: baseQuery(client.id, { state: "abc", nonce: "xyz" }),
				sessionIds: [sessionId],
				now,
				issuer: ISSUER,
			});

			expect(outcome.kind).toBe("redirect");
			if (outcome.kind !== "redirect") throw new Error("unreachable");

			let location = new URL(outcome.location);
			expect(location.origin + location.pathname).toBe(REDIRECT_URI);
			expect(location.searchParams.get("state")).toBe("abc");
			let code = location.searchParams.get("code");
			expect(code).toEqual(expect.any(String));

			let rows = await db.findMany(authorizationCodes);
			expect(rows).toHaveLength(1);
			let row = rows[0];
			if (!row) throw new Error("unreachable");

			expect(row.code_hash).not.toBe(code);
			expect(row.code_hash).toMatch(/^[0-9a-f]{64}$/);
			expect(row.client_id).toBe(client.id);
			expect(row.redirect_uri).toBe(REDIRECT_URI);
			expect(row.code_challenge).toBe("a valid-looking challenge");
			expect(row.scopes).toEqual(["openid"]);
			expect(row.subject_id).toBe(subjectId);
			expect(row.session_id).toBe(sessionId);
			expect(row.nonce).toBe("xyz");
			expect(row.auth_time).toEqual(expect.any(Number));
			expect(row.created_at).toBe(now);
			expect(row.expires_at).toBe(now + 60_000);
			expect(row.redeemed_at).toBeNull();
			expect(row.token_family_id).toBeNull();
		});
	});
});

describe("resumeAuthorization", () => {
	test("completes a parked authenticate outcome through to a code once consent is not needed", async () => {
		let client = await createTestClient();

		let begun = await beginAuthorization(db, {
			query: baseQuery(client.id),
			sessionIds: [],
			now: Date.now(),
			issuer: ISSUER,
		});
		expect(begun.kind).toBe("authenticate");
		if (begun.kind !== "authenticate") throw new Error("unreachable");

		let { subjectId, sessionId } = await openTestSession();
		await recordConsentDecision(db, {
			subjectId,
			clientId: client.id,
			approved: true,
			scopes: ["openid"],
		});

		let resumed = await resumeAuthorization(db, {
			interactionId: begun.interactionId,
			sessionId,
			now: Date.now(),
			issuer: ISSUER,
		});

		expect(resumed.kind).toBe("redirect");
		if (resumed.kind !== "redirect") throw new Error("unreachable");
		expect(new URL(resumed.location).searchParams.get("code")).toEqual(expect.any(String));
	});

	test("completes a parked authenticate outcome through to a consent screen, then a code", async () => {
		let client = await createTestClient();

		let begun = await beginAuthorization(db, {
			query: baseQuery(client.id),
			sessionIds: [],
			now: Date.now(),
			issuer: ISSUER,
		});
		expect(begun.kind).toBe("authenticate");
		if (begun.kind !== "authenticate") throw new Error("unreachable");

		let { subjectId, sessionId } = await openTestSession();

		let resumedToConsent = await resumeAuthorization(db, {
			interactionId: begun.interactionId,
			sessionId,
			now: Date.now(),
			issuer: ISSUER,
		});

		expect(resumedToConsent.kind).toBe("consent");
		if (resumedToConsent.kind !== "consent") throw new Error("unreachable");
		expect(resumedToConsent.interactionId).toBe(begun.interactionId);

		// The hosted UI's own consent-submission step records the decision on its own,
		// between these two calls into this endpoint.
		await recordConsentDecision(db, {
			subjectId,
			clientId: client.id,
			approved: true,
			scopes: ["openid"],
		});

		let resumedToCode = await resumeAuthorization(db, {
			interactionId: begun.interactionId,
			sessionId,
			now: Date.now(),
			issuer: ISSUER,
		});

		expect(resumedToCode.kind).toBe("redirect");
		if (resumedToCode.kind !== "redirect") throw new Error("unreachable");
		expect(new URL(resumedToCode.location).searchParams.get("code")).toEqual(expect.any(String));
	});

	test("does not re-force login on resume even when prompt=login was originally requested", async () => {
		let client = await createTestClient();
		let { sessionId: firstSessionId } = await openTestSession();

		let begun = await beginAuthorization(db, {
			query: baseQuery(client.id, { prompt: "login" }),
			sessionIds: [firstSessionId],
			now: Date.now(),
			issuer: ISSUER,
		});
		expect(begun).toMatchObject({ kind: "authenticate", forced: true });
		if (begun.kind !== "authenticate") throw new Error("unreachable");

		let { sessionId: freshSessionId } = await openTestSession();

		let resumed = await resumeAuthorization(db, {
			interactionId: begun.interactionId,
			sessionId: freshSessionId,
			now: Date.now(),
			issuer: ISSUER,
		});

		// Reaching sign-in was the point of forcing it; resuming never asks again.
		expect(resumed.kind).not.toBe("authenticate");
	});

	test("renders an error for an interaction id that does not resolve", async () => {
		let outcome = await resumeAuthorization(db, {
			interactionId: "authz_does_not_exist",
			sessionId: "sess_does_not_exist",
			now: Date.now(),
			issuer: ISSUER,
		});

		expect(outcome).toEqual({
			kind: "render",
			error: "invalid_request",
			description: expect.any(String),
		});
	});

	test("renders an error for an interaction past its ten-minute window", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(1_700_000_000_000);

		let client = await createTestClient();
		let begun = await beginAuthorization(db, {
			query: baseQuery(client.id),
			sessionIds: [],
			now: Date.now(),
			issuer: ISSUER,
		});
		if (begun.kind !== "authenticate") throw new Error("unreachable");

		let { sessionId } = await openTestSession();

		vi.setSystemTime(1_700_000_000_000 + 11 * 60 * 1000);

		let outcome = await resumeAuthorization(db, {
			interactionId: begun.interactionId,
			sessionId,
			now: Date.now(),
			issuer: ISSUER,
		});

		expect(outcome.kind).toBe("render");
	});

	test("parks an authenticate outcome again, reusing the interaction id, when the given session no longer holds", async () => {
		let client = await createTestClient();
		let begun = await beginAuthorization(db, {
			query: baseQuery(client.id),
			sessionIds: [],
			now: Date.now(),
			issuer: ISSUER,
		});
		if (begun.kind !== "authenticate") throw new Error("unreachable");

		let outcome = await resumeAuthorization(db, {
			interactionId: begun.interactionId,
			sessionId: "sess_does_not_exist",
			now: Date.now(),
			issuer: ISSUER,
		});

		expect(outcome).toEqual({
			kind: "authenticate",
			interactionId: begun.interactionId,
			loginHint: null,
			forced: false,
		});
	});
});

describe("sweepExpiredAuthorizationRequests", () => {
	test("deletes a pending interaction past its ten-minute window", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(1_700_000_000_000);

		let client = await createTestClient();
		let begun = await beginAuthorization(db, {
			query: baseQuery(client.id),
			sessionIds: [],
			now: Date.now(),
			issuer: ISSUER,
		});
		if (begun.kind !== "authenticate") throw new Error("unreachable");

		vi.setSystemTime(1_700_000_000_000 + 11 * 60 * 1000);

		let result = await sweepExpiredAuthorizationRequests(db, { now: Date.now() });
		expect(result).toEqual({ deleted: 1, more: false });

		expect(await db.find(authorizationRequests, { id: begun.interactionId })).toBeNull();
	});

	test("leaves a pending interaction still inside its window alone", async () => {
		let client = await createTestClient();
		let begun = await beginAuthorization(db, {
			query: baseQuery(client.id),
			sessionIds: [],
			now: Date.now(),
			issuer: ISSUER,
		});
		if (begun.kind !== "authenticate") throw new Error("unreachable");

		let result = await sweepExpiredAuthorizationRequests(db, { now: Date.now() });
		expect(result).toEqual({ deleted: 0, more: false });
	});
});

describe("sweepExpiredAuthorizationCodes", () => {
	async function mintTestCode(): Promise<AuthorizationCodeRowShape> {
		let client = await createTestClient();
		let { subjectId, sessionId } = await openTestSession();
		await recordConsentDecision(db, {
			subjectId,
			clientId: client.id,
			approved: true,
			scopes: ["openid"],
		});

		let outcome = await beginAuthorization(db, {
			query: baseQuery(client.id),
			sessionIds: [sessionId],
			now: Date.now(),
			issuer: ISSUER,
		});
		if (outcome.kind !== "redirect") throw new Error("unreachable");

		let rows = await db.findMany(authorizationCodes);
		let row = rows[0];
		if (!row) throw new Error("unreachable");
		return row;
	}

	test("deletes an unredeemed code once its sixty seconds run out", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(1_700_000_000_000);

		let row = await mintTestCode();

		vi.setSystemTime(1_700_000_000_000 + 61_000);

		let result = await sweepExpiredAuthorizationCodes(db, { now: Date.now() });
		expect(result).toEqual({ deleted: 1, more: false });
		expect(await db.find(authorizationCodes, { id: row.id })).toBeNull();
	});

	test("leaves a redeemed code alone until it is old enough to sweep", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(1_700_000_000_000);

		let row = await mintTestCode();
		await db.update(authorizationCodes, { id: row.id }, { redeemed_at: Date.now() });

		vi.setSystemTime(1_700_000_000_000 + 60_000);
		let tooSoon = await sweepExpiredAuthorizationCodes(db, { now: Date.now() });
		expect(tooSoon).toEqual({ deleted: 0, more: false });

		vi.setSystemTime(1_700_000_000_000 + 25 * 60 * 60 * 1000);
		let later = await sweepExpiredAuthorizationCodes(db, { now: Date.now() });
		expect(later).toEqual({ deleted: 1, more: false });
	});
});
