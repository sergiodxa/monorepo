/**
 * Drives the tenant Durable Object's social sign-in RPC methods the way
 * `connections.test.ts` drives the configuration ones and
 * `packages/auth/src/relying-party.test.ts` drives `RelyingParty` itself: a fake
 * provider served over MSW, with fixture ID and access tokens signed for it.
 *
 * Covers: `beginConnectionSignIn` answers a redirect to the provider's
 * authorization endpoint carrying the right `client_id`, `redirect_uri` and
 * `scope`; `completeConnectionSignIn` against a successful callback maps claims,
 * creates a subject on first sign-in, opens a session, and answers a handoff
 * ticket; a second sign-in with the same provider subject id resolves the same
 * subject rather than creating a new one; `resumeConnectionSignIn` spends the
 * ticket once and refuses a replay; a `state` mismatch or an expired transaction
 * refuses cleanly; a connection with `onUnknownSubject: "refuse"` refuses a
 * first-seen provider identity instead of minting a subject for it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurableObjectStateMock } from "@sdxc/cloudflare-mocks";

import { IdToken } from "@sdxc/auth/id-token";
import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { randomToken } from "@sdxc/crypto";
import { JWK } from "@sdxc/jwt";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import Tenant from "./tenant-do";

/** The origin the sign-in flow serves its hosted pages on, distinct from the provider. */
const CALLBACK_ORIGIN = "https://acme.auth.example";

/** Where the platform's sign-in page actually served from — the flow's own `hostname`. */
const HOSTNAME = "acme.auth.example";

let server = setupServer();
let keys: JWK.KeyPair[];

/** Origins already handed out, so each test's `Issuer` reads a provider of its own. */
let origins = 0;

beforeAll(async () => {
	server.listen({ onUnhandledRequest: "error" });
	keys = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
});

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let state: DurableObjectStateMock;
let tenant: Tenant;

beforeEach(async () => {
	state = createDurableObjectState();
	tenant = new Tenant(state, { TOTP_SEAL_KEY: randomToken({ bytes: 32 }) } as Cloudflare.Env);
	await tenant.provision({ tenantId: "ten_1", issuer: "https://acme.example" });
});

/**
 * Serves a fake OIDC provider on an origin no earlier test has read: discovery,
 * a key set, and the token endpoint, answering whatever token response a test
 * hands it. A userinfo endpoint is served too, echoing the ID token's own
 * claims, since `RelyingParty`'s `userInfo: "when-missing"` reaches for it
 * whenever a display claim is missing.
 */
function stubProvider(options: { revocation?: boolean } = {}): {
	origin: string;
	tokenEndpointRequests: URLSearchParams[];
	revocationEndpointRequests: URLSearchParams[];
	respondWith(build: () => Promise<Response> | Response): void;
} {
	origins += 1;
	let origin = `http://localhost:${5000 + origins}`;
	let tokenEndpointRequests: URLSearchParams[] = [];
	let revocationEndpointRequests: URLSearchParams[] = [];
	let respond: (() => Promise<Response> | Response) | null = null;

	server.use(
		http.get(`${origin}/.well-known/openid-configuration`, () =>
			HttpResponse.json({
				issuer: origin,
				authorization_endpoint: `${origin}/authorize`,
				token_endpoint: `${origin}/token`,
				jwks_uri: `${origin}/jwks`,
				userinfo_endpoint: `${origin}/userinfo`,
				...(options.revocation ? { revocation_endpoint: `${origin}/revoke` } : {}),
			}),
		),
		http.get(`${origin}/jwks`, () => HttpResponse.json(JWK.toJSON(keys))),
		http.post(`${origin}/token`, async ({ request }) => {
			tokenEndpointRequests.push(new URLSearchParams(await request.text()));
			if (!respond) throw new Error("no token response stubbed for this test");
			return respond();
		}),
		http.get(`${origin}/userinfo`, ({ request }) => {
			let auth = request.headers.get("authorization") ?? "";
			let claims = decodeAccessTokenClaims(auth.replace(/^Bearer /, ""));
			return HttpResponse.json(claims);
		}),
		http.post(`${origin}/revoke`, async ({ request }) => {
			revocationEndpointRequests.push(new URLSearchParams(await request.text()));
			return new HttpResponse(null, { status: 200 });
		}),
	);

	return {
		origin,
		tokenEndpointRequests,
		revocationEndpointRequests,
		respondWith(build) {
			respond = build;
		},
	};
}

/** Reads a fixture access token's own claims back out, for the userinfo stub to echo. */
function decodeAccessTokenClaims(raw: string): Record<string, unknown> {
	let payload = raw.split(".")[1] ?? "";
	let json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
	return JSON.parse(json) as Record<string, unknown>;
}

/** Signs a fixture ID token for the fake provider, bound to one login's nonce. */
function signIdToken(origin: string, claims: Record<string, unknown>): Promise<string> {
	return new IdToken({
		iss: origin,
		aud: "client-1",
		sub: "provider-subject-1",
		exp: "1h",
		iat: Math.floor(Date.now() / 1000),
		...claims,
	}).sign(JWK.Algorithm.ES256, keys);
}

/** Signs a fixture access token — never verified by `RelyingParty`, only decoded for its claims. */
function signAccessToken(claims: Record<string, unknown>): Promise<string> {
	return new IdToken({ sub: "provider-subject-1", exp: "1h", ...claims }).sign(
		JWK.Algorithm.ES256,
		keys,
	);
}

/**
 * The token response a successful callback answers with, bound to the `nonce`
 * `beginConnectionSignIn`'s own redirect carried, so the ID token answers the
 * exact login that asked for it.
 */
async function tokenResponse(
	origin: string,
	redirectUrl: string,
	options: { claims?: Record<string, unknown>; refreshToken?: string | null } = {},
): Promise<Response> {
	let nonce = new URL(redirectUrl).searchParams.get("nonce") ?? "";
	let claims = { nonce, ...options.claims };

	return HttpResponse.json({
		token_type: "Bearer",
		access_token: await signAccessToken(claims),
		id_token: await signIdToken(origin, claims),
		refresh_token:
			options.refreshToken === null ? undefined : (options.refreshToken ?? "refresh-1"),
		expires_in: 3600,
	});
}

/** Saves and enables a from-scratch OIDC connection against a fake provider's origin. */
async function createConnection(
	origin: string,
	overrides: {
		slug?: string;
		onUnknownSubject?: "create" | "refuse";
		emailAuthority?: boolean;
		autoLink?: boolean;
	} = {},
): Promise<void> {
	let saved = await tenant.saveConnection({
		slug: overrides.slug ?? "acme-oidc",
		displayName: "Acme OIDC",
		kind: "oidc",
		issuer: origin,
		clientId: "client-1",
		clientSecret: "client-secret-1",
		scopes: ["openid", "email", "profile"],
		onUnknownSubject: overrides.onUnknownSubject ?? "create",
		emailAuthority: overrides.emailAuthority,
		autoLink: overrides.autoLink,
		mappings: [
			{ source: "name", target: "name", apply: "on-create" },
			{ source: "department", target: "department", apply: "on-every-sign-in" },
		],
		callbackOrigin: CALLBACK_ORIGIN,
	});

	if (!saved.ok) throw new Error(`fixture connection was refused: ${JSON.stringify(saved)}`);

	let enabled = await tenant.setConnectionEnabled({ slug: saved.connection.slug, enabled: true });
	if (!enabled.ok)
		throw new Error(`fixture connection could not be enabled: ${JSON.stringify(enabled)}`);
}

/** Extracts the `state` an authorize redirect carries, for building the matching callback. */
function stateOf(redirectUrl: string): string {
	let state = new URL(redirectUrl).searchParams.get("state");
	if (!state) throw new Error("authorize redirect carried no state");
	return state;
}

/** Drives a full sign-in against a fixture provider and resumes its handoff ticket, for a real subject and a real live session to test against. */
async function signInAndResume(
	provider: { origin: string; respondWith(build: () => Promise<Response> | Response): void },
	slug = "acme-oidc",
): Promise<{ subjectId: string; sessionId: string }> {
	let begun = await tenant.beginConnectionSignIn({
		slug,
		hostname: HOSTNAME,
		callbackOrigin: CALLBACK_ORIGIN,
	});
	if (!begun.ok) throw new Error("unreachable");
	let state = stateOf(begun.redirectUrl);

	provider.respondWith(() => tokenResponse(provider.origin, begun.redirectUrl));

	let completed = await tenant.completeConnectionSignIn({
		slug,
		callbackUrl: `${CALLBACK_ORIGIN}/u/connections/${slug}/callback?code=code-1&state=${state}`,
	});
	if (!completed.ok) throw new Error(`expected success, got ${JSON.stringify(completed)}`);

	let resumed = await tenant.resumeConnectionSignIn({
		ticket: completed.handoffTicket,
		hostname: HOSTNAME,
	});
	if (!resumed.ok) throw new Error("unreachable");

	// `resumeConnectionSignIn`'s own RPC composes the session token with the
	// authorization outcome it resumes, dropping the session id along the way —
	// resolving the token back is the way to read it, the same way a browser's
	// own cookie would.
	let resolved = await tenant.resolveSession({ token: resumed.sessionToken });
	if (resolved.status !== "active") throw new Error("unreachable");

	return { subjectId: completed.subjectId, sessionId: resolved.sessionId };
}

/** Reads a connection's own id back by its slug, for a raw fixture insert that needs to name it. */
function connectionIdFor(slug: string): string {
	let rows = [...state.storage.sql.exec(`SELECT id FROM connections WHERE slug = ?`, slug)] as {
		id: string;
	}[];
	let row = rows[0];
	if (!row) throw new Error(`no connection with slug ${slug}`);
	return row.id;
}

/** Inserts a connection row directly, standing in for one `saveConnection` would have written. */
function insertConnection(connectionId: string) {
	let now = Date.now();
	state.storage.sql.exec(
		`INSERT INTO connections
			(id, slug, kind, catalog_entry, display_name, enabled, issuer, authorization_endpoint, token_endpoint, userinfo_endpoint, client_id, client_secret_sealed, scopes, subject_claim, email_authority, auto_link, on_unknown_subject, created_at, updated_at, organization_id)
		 VALUES (?, ?, 'oidc', NULL, 'Test Connection', 1, NULL, NULL, NULL, NULL, 'client', NULL, '[]', 'sub', 0, 0, 'create', ?, ?, NULL)`,
		connectionId,
		connectionId,
		now,
		now,
	);
}

/** Reads the most recent audit event of one action back out, for asserting on its `detail`. */
function latestAuditDetail(action: string): Record<string, unknown> {
	let rows = [
		...state.storage.sql.exec(
			`SELECT detail FROM audit_events WHERE action = ? ORDER BY id DESC LIMIT 1`,
			action,
		),
	] as { detail: string }[];
	let row = rows[0];
	if (!row) throw new Error(`no audit event recorded for action ${action}`);
	return JSON.parse(row.detail) as Record<string, unknown>;
}

/** Inserts a linked identity row directly, carrying the provider's own address, standing in for one a completed sign-in would have written. */
function insertConnectionIdentity(
	connectionId: string,
	providerSubject: string,
	subjectId: string,
	providerEmail: string | null,
	providerEmailVerified: boolean | null,
) {
	let now = Date.now();
	state.storage.sql.exec(
		`INSERT INTO connection_identities
			(connection_id, provider_subject, subject_id, access_token_sealed, refresh_token_sealed, token_expires_at, provider_email, provider_email_verified, linked_by, linked_at, last_sign_in_at, granted_scopes, claims_json, created_at, updated_at)
		 VALUES (?, ?, ?, NULL, NULL, NULL, ?, ?, 'jit', ?, NULL, NULL, NULL, ?, ?)`,
		connectionId,
		providerSubject,
		subjectId,
		providerEmail,
		providerEmailVerified === null ? null : providerEmailVerified ? 1 : 0,
		now,
		now,
		now,
	);
}

beforeEach(async () => {
	await tenant.defineAttribute({ key: "department", type: "string", visibility: "claim" });
});

describe("beginConnectionSignIn", () => {
	test("answers a redirect to the provider's authorization endpoint with the right parameters", async () => {
		let { origin } = stubProvider();
		await createConnection(origin);

		let begun = await tenant.beginConnectionSignIn({
			slug: "acme-oidc",
			authorizationRequestId: "authz_1",
			hostname: HOSTNAME,
			callbackOrigin: CALLBACK_ORIGIN,
		});

		if (!begun.ok) throw new Error(`expected a redirect, got ${JSON.stringify(begun)}`);

		let redirect = new URL(begun.redirectUrl);
		expect(redirect.origin).toBe(origin);
		expect(redirect.pathname).toBe("/authorize");
		expect(redirect.searchParams.get("client_id")).toBe("client-1");
		expect(redirect.searchParams.get("redirect_uri")).toBe(
			`${CALLBACK_ORIGIN}/u/connections/acme-oidc/callback`,
		);
		expect(redirect.searchParams.get("scope")).toBe("openid email profile");
		expect(redirect.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]{20,}$/);
	});

	test("refuses a connection that does not exist or is not enabled", async () => {
		let begun = await tenant.beginConnectionSignIn({
			slug: "no-such-connection",
			hostname: HOSTNAME,
			callbackOrigin: CALLBACK_ORIGIN,
		});

		expect(begun).toMatchObject({ ok: false, reason: "not-found" });
	});
});

describe("completeConnectionSignIn", () => {
	test("maps claims, creates a subject, opens a session, and answers a handoff ticket", async () => {
		let provider = stubProvider();
		await createConnection(provider.origin);

		let begun = await tenant.beginConnectionSignIn({
			slug: "acme-oidc",
			authorizationRequestId: "authz_1",
			hostname: HOSTNAME,
			callbackOrigin: CALLBACK_ORIGIN,
		});
		if (!begun.ok) throw new Error("unreachable");
		let state = stateOf(begun.redirectUrl);

		provider.respondWith(() =>
			tokenResponse(provider.origin, begun.redirectUrl, {
				claims: { name: "Ada Lovelace", department: "R&D" },
			}),
		);

		let callbackUrl = `${CALLBACK_ORIGIN}/u/connections/acme-oidc/callback?code=code-1&state=${state}`;

		let completed = await tenant.completeConnectionSignIn({
			slug: "acme-oidc",
			callbackUrl,
			agent: "test-agent/1.0",
		});

		if (!completed.ok) throw new Error(`expected success, got ${JSON.stringify(completed)}`);
		expect(completed.hostname).toBe(HOSTNAME);
		expect(completed.subjectId).toMatch(/^sub_/);
		expect(completed.handoffTicket.length).toBeGreaterThan(10);

		let described = await tenant.describeSubject({
			subjectId: completed.subjectId,
			audience: { kind: "admin" },
		});
		if (!described.ok) throw new Error("unreachable");
		expect(described.profile.name).toBe("Ada Lovelace");
		expect(described.attributes.department).toBe("R&D");
	});

	test("completes a sign-in even when the provider's access token is not a JWT", async () => {
		let provider = stubProvider();
		await createConnection(provider.origin);

		// This fixture suite's shared userinfo stub answers by decoding the
		// access token as a JWT, which is exactly the assumption this test means
		// to break — a real provider's userinfo endpoint looks a bearer token up
		// server-side rather than reading claims out of it, so this override
		// answers the same way regardless of what the token looks like.
		server.use(
			http.get(`${provider.origin}/userinfo`, () =>
				HttpResponse.json({ sub: "provider-subject-1", name: "Ada Lovelace", department: "R&D" }),
			),
		);

		let begun = await tenant.beginConnectionSignIn({
			slug: "acme-oidc",
			authorizationRequestId: "authz_1",
			hostname: HOSTNAME,
			callbackOrigin: CALLBACK_ORIGIN,
		});
		if (!begun.ok) throw new Error("unreachable");
		let state = stateOf(begun.redirectUrl);

		provider.respondWith(async () => {
			let nonce = new URL(begun.redirectUrl).searchParams.get("nonce") ?? "";
			return HttpResponse.json({
				token_type: "Bearer",
				// A real provider's access token, unlike this fixture suite's other
				// tokens, has no defined shape at all under OAuth2 — this is the
				// opaque bearer string virtually every real provider actually sends.
				access_token: "ya29.opaque-provider-access-token",
				id_token: await signIdToken(provider.origin, { nonce }),
				expires_in: 3600,
			});
		});

		let callbackUrl = `${CALLBACK_ORIGIN}/u/connections/acme-oidc/callback?code=code-1&state=${state}`;

		let completed = await tenant.completeConnectionSignIn({
			slug: "acme-oidc",
			callbackUrl,
			agent: "test-agent/1.0",
		});

		if (!completed.ok) throw new Error(`expected success, got ${JSON.stringify(completed)}`);
		expect(completed.subjectId).toMatch(/^sub_/);
	});

	test("resolves the same subject on a returning sign-in with the same provider subject id", async () => {
		let provider = stubProvider();
		await createConnection(provider.origin);

		async function signInOnce(): Promise<string> {
			let begun = await tenant.beginConnectionSignIn({
				slug: "acme-oidc",
				hostname: HOSTNAME,
				callbackOrigin: CALLBACK_ORIGIN,
			});
			if (!begun.ok) throw new Error("unreachable");
			let state = stateOf(begun.redirectUrl);

			provider.respondWith(() => tokenResponse(provider.origin, begun.redirectUrl));

			let completed = await tenant.completeConnectionSignIn({
				slug: "acme-oidc",
				callbackUrl: `${CALLBACK_ORIGIN}/u/connections/acme-oidc/callback?code=code-1&state=${state}`,
			});
			if (!completed.ok) throw new Error(`expected success, got ${JSON.stringify(completed)}`);
			return completed.subjectId;
		}

		let first = await signInOnce();
		let second = await signInOnce();

		expect(second).toBe(first);
	});

	test("refuses a blocked subject on a returning sign-in", async () => {
		let provider = stubProvider();
		await createConnection(provider.origin);

		async function signInOnce() {
			let begun = await tenant.beginConnectionSignIn({
				slug: "acme-oidc",
				hostname: HOSTNAME,
				callbackOrigin: CALLBACK_ORIGIN,
			});
			if (!begun.ok) throw new Error("unreachable");
			let state = stateOf(begun.redirectUrl);

			provider.respondWith(() => tokenResponse(provider.origin, begun.redirectUrl));

			return tenant.completeConnectionSignIn({
				slug: "acme-oidc",
				callbackUrl: `${CALLBACK_ORIGIN}/u/connections/acme-oidc/callback?code=code-1&state=${state}`,
			});
		}

		let first = await signInOnce();
		if (!first.ok) throw new Error("unreachable");

		await tenant.blockSubject({ subjectId: first.subjectId, reason: "fraud" });

		let second = await signInOnce();
		expect(second).toMatchObject({ ok: false, reason: "subject-blocked" });
	});

	test("refuses a callback whose state was never issued", async () => {
		let provider = stubProvider();
		await createConnection(provider.origin);

		let completed = await tenant.completeConnectionSignIn({
			slug: "acme-oidc",
			callbackUrl: `${CALLBACK_ORIGIN}/u/connections/acme-oidc/callback?code=code-1&state=never-issued`,
		});

		expect(completed).toMatchObject({ ok: false, reason: "invalid-transaction" });
	});

	test("refuses a callback against an expired transaction", async () => {
		let provider = stubProvider();
		await createConnection(provider.origin);

		let begun = await tenant.beginConnectionSignIn({
			slug: "acme-oidc",
			hostname: HOSTNAME,
			callbackOrigin: CALLBACK_ORIGIN,
		});
		if (!begun.ok) throw new Error("unreachable");
		let state = stateOf(begun.redirectUrl);

		vi.useFakeTimers();
		vi.setSystemTime(Date.now() + 11 * 60 * 1000);

		try {
			let completed = await tenant.completeConnectionSignIn({
				slug: "acme-oidc",
				callbackUrl: `${CALLBACK_ORIGIN}/u/connections/acme-oidc/callback?code=code-1&state=${state}`,
			});

			expect(completed).toMatchObject({ ok: false, reason: "invalid-transaction" });
		} finally {
			vi.useRealTimers();
		}
	});

	test("refuses a first-seen provider identity when onUnknownSubject is refuse", async () => {
		let provider = stubProvider();
		await createConnection(provider.origin, { onUnknownSubject: "refuse" });

		let begun = await tenant.beginConnectionSignIn({
			slug: "acme-oidc",
			hostname: HOSTNAME,
			callbackOrigin: CALLBACK_ORIGIN,
		});
		if (!begun.ok) throw new Error("unreachable");
		let state = stateOf(begun.redirectUrl);

		provider.respondWith(() => tokenResponse(provider.origin, begun.redirectUrl));

		let completed = await tenant.completeConnectionSignIn({
			slug: "acme-oidc",
			callbackUrl: `${CALLBACK_ORIGIN}/u/connections/acme-oidc/callback?code=code-1&state=${state}`,
		});

		expect(completed).toMatchObject({ ok: false, reason: "unknown-subject" });
	});

	test("links automatically to an existing verified subject when the connection is authoritative and auto_link is on", async () => {
		let provider = stubProvider();
		await createConnection(provider.origin, { emailAuthority: true, autoLink: true });

		let created = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "ada@example.com" }],
		});
		if (!created.ok) throw new Error("setup failed");
		let added = await tenant.addIdentifier({
			subjectId: created.subjectId,
			kind: "email",
			value: "ada@example.com",
			actor: { kind: "subject" },
		});
		if (!added.ok || added.kind !== "email") throw new Error("setup failed");
		await tenant.verifyIdentifier({ ticket: added.ticket });

		let begun = await tenant.beginConnectionSignIn({
			slug: "acme-oidc",
			hostname: HOSTNAME,
			callbackOrigin: CALLBACK_ORIGIN,
		});
		if (!begun.ok) throw new Error("unreachable");
		let state = stateOf(begun.redirectUrl);

		provider.respondWith(() =>
			tokenResponse(provider.origin, begun.redirectUrl, {
				claims: { email: "ada@example.com", email_verified: true },
			}),
		);

		let completed = await tenant.completeConnectionSignIn({
			slug: "acme-oidc",
			callbackUrl: `${CALLBACK_ORIGIN}/u/connections/acme-oidc/callback?code=code-1&state=${state}`,
		});

		if (!completed.ok) throw new Error(`expected success, got ${JSON.stringify(completed)}`);
		expect(completed.subjectId).toBe(created.subjectId);
	});

	test("answers link_required with a ticket instead of linking when auto_link is off", async () => {
		let provider = stubProvider();
		await createConnection(provider.origin, { emailAuthority: true, autoLink: false });

		let created = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "ada@example.com" }],
		});
		if (!created.ok) throw new Error("setup failed");
		let added = await tenant.addIdentifier({
			subjectId: created.subjectId,
			kind: "email",
			value: "ada@example.com",
			actor: { kind: "subject" },
		});
		if (!added.ok || added.kind !== "email") throw new Error("setup failed");
		await tenant.verifyIdentifier({ ticket: added.ticket });

		let begun = await tenant.beginConnectionSignIn({
			slug: "acme-oidc",
			hostname: HOSTNAME,
			callbackOrigin: CALLBACK_ORIGIN,
		});
		if (!begun.ok) throw new Error("unreachable");
		let state = stateOf(begun.redirectUrl);

		provider.respondWith(() =>
			tokenResponse(provider.origin, begun.redirectUrl, {
				claims: { email: "ada@example.com", email_verified: true },
			}),
		);

		let completed = await tenant.completeConnectionSignIn({
			slug: "acme-oidc",
			callbackUrl: `${CALLBACK_ORIGIN}/u/connections/acme-oidc/callback?code=code-1&state=${state}`,
		});

		expect(completed.ok).toBe(false);
		if (completed.ok || completed.reason !== "link_required") {
			throw new Error(`expected link_required, got ${JSON.stringify(completed)}`);
		}
		expect(completed.ticket.length).toBeGreaterThan(10);

		let described = await tenant.describeSubject({
			subjectId: created.subjectId,
			audience: { kind: "admin" },
		});
		if (!described.ok) throw new Error("unreachable");
		expect(described.identifiers).toHaveLength(1);
	});

	test("still creates a fresh subject when no existing identifier matches the response's address", async () => {
		let provider = stubProvider();
		await createConnection(provider.origin, { emailAuthority: true, autoLink: true });

		let begun = await tenant.beginConnectionSignIn({
			slug: "acme-oidc",
			hostname: HOSTNAME,
			callbackOrigin: CALLBACK_ORIGIN,
		});
		if (!begun.ok) throw new Error("unreachable");
		let state = stateOf(begun.redirectUrl);

		provider.respondWith(() =>
			tokenResponse(provider.origin, begun.redirectUrl, {
				claims: { email: "nobody-yet@example.com", email_verified: true },
			}),
		);

		let completed = await tenant.completeConnectionSignIn({
			slug: "acme-oidc",
			callbackUrl: `${CALLBACK_ORIGIN}/u/connections/acme-oidc/callback?code=code-1&state=${state}`,
		});

		if (!completed.ok) throw new Error(`expected success, got ${JSON.stringify(completed)}`);
		expect(completed.subjectId).toMatch(/^sub_/);
	});
});

describe("resumeConnectionSignIn", () => {
	async function completeSignIn(): Promise<string> {
		let provider = stubProvider();
		await createConnection(provider.origin);

		let begun = await tenant.beginConnectionSignIn({
			slug: "acme-oidc",
			authorizationRequestId: "authz_1",
			hostname: HOSTNAME,
			callbackOrigin: CALLBACK_ORIGIN,
		});
		if (!begun.ok) throw new Error("unreachable");
		let state = stateOf(begun.redirectUrl);

		provider.respondWith(() => tokenResponse(provider.origin, begun.redirectUrl));

		let completed = await tenant.completeConnectionSignIn({
			slug: "acme-oidc",
			callbackUrl: `${CALLBACK_ORIGIN}/u/connections/acme-oidc/callback?code=code-1&state=${state}`,
		});
		if (!completed.ok) throw new Error(`expected success, got ${JSON.stringify(completed)}`);
		return completed.handoffTicket;
	}

	test("spends the ticket once and refuses a replay", async () => {
		let ticket = await completeSignIn();

		let first = await tenant.resumeConnectionSignIn({ ticket, hostname: HOSTNAME });
		expect(first.ok).toBe(true);

		let second = await tenant.resumeConnectionSignIn({ ticket, hostname: HOSTNAME });
		expect(second).toMatchObject({ ok: false, reason: "invalid-ticket" });
	});

	test("refuses a ticket presented on a different hostname", async () => {
		let ticket = await completeSignIn();

		let resumed = await tenant.resumeConnectionSignIn({ ticket, hostname: "someone-else.example" });
		expect(resumed).toMatchObject({ ok: false, reason: "invalid-ticket" });
	});
});

describe("unlinkIdentity", () => {
	test("refuses when it would leave the subject with no remaining way in", async () => {
		let provider = stubProvider();
		await createConnection(provider.origin);

		let { subjectId } = await signInAndResume(provider);

		let result = await tenant.unlinkIdentity({
			subjectId,
			connectionSlug: "acme-oidc",
			actor: { type: "subject", id: subjectId },
		});

		expect(result).toMatchObject({ ok: false, reason: "last-credential" });
	});

	test("refuses when no such identity exists", async () => {
		let provider = stubProvider();
		await createConnection(provider.origin);

		let { subjectId } = await signInAndResume(provider);

		let result = await tenant.unlinkIdentity({
			subjectId,
			connectionSlug: "no-such-connection",
			actor: { type: "subject", id: subjectId },
		});

		expect(result).toMatchObject({ ok: false, reason: "not-found" });
	});

	test("succeeds and removes the identity when the subject also holds a password", async () => {
		let provider = stubProvider();
		await createConnection(provider.origin);

		let { subjectId } = await signInAndResume(provider);

		await tenant.setPassword({
			subjectId,
			password: "correct-horse-battery",
			actor: { kind: "admin" },
		});

		let result = await tenant.unlinkIdentity({
			subjectId,
			connectionSlug: "acme-oidc",
			actor: { type: "subject", id: subjectId },
		});

		expect(result).toMatchObject({ ok: true });

		let described = await tenant.describeSubject({ subjectId, audience: { kind: "admin" } });
		if (!described.ok) throw new Error("unreachable");
		expect(described.identities).toHaveLength(0);
	});

	test("succeeds and removes the identity when the provider publishes no revocation endpoint", async () => {
		let provider = stubProvider();
		await createConnection(provider.origin);

		let { subjectId } = await signInAndResume(provider);

		await tenant.setPassword({
			subjectId,
			password: "correct-horse-battery",
			actor: { kind: "admin" },
		});

		let result = await tenant.unlinkIdentity({
			subjectId,
			connectionSlug: "acme-oidc",
			actor: { type: "subject", id: subjectId },
		});

		expect(result).toMatchObject({ ok: true });
		expect(provider.revocationEndpointRequests).toHaveLength(0);

		let described = await tenant.describeSubject({ subjectId, audience: { kind: "admin" } });
		if (!described.ok) throw new Error("unreachable");
		expect(described.identities).toHaveLength(0);
		expect(latestAuditDetail("identity.unlinked")).toMatchObject({ providerRevoked: false });
	});

	test("revokes the stored refresh token at the provider's revocation endpoint on unlink", async () => {
		let provider = stubProvider({ revocation: true });
		await createConnection(provider.origin);

		let { subjectId } = await signInAndResume(provider);

		await tenant.setPassword({
			subjectId,
			password: "correct-horse-battery",
			actor: { kind: "admin" },
		});

		let result = await tenant.unlinkIdentity({
			subjectId,
			connectionSlug: "acme-oidc",
			actor: { type: "subject", id: subjectId },
		});

		expect(result).toMatchObject({ ok: true });
		expect(provider.revocationEndpointRequests).toHaveLength(1);
		expect(provider.revocationEndpointRequests[0]?.get("token")).toBe("refresh-1");
		expect(provider.revocationEndpointRequests[0]?.get("token_type_hint")).toBe("refresh_token");
		expect(latestAuditDetail("identity.unlinked")).toMatchObject({ providerRevoked: true });
	});

	test("still succeeds and removes the identity when the revocation endpoint refuses the request", async () => {
		let provider = stubProvider({ revocation: true });
		await createConnection(provider.origin);

		let { subjectId } = await signInAndResume(provider);

		await tenant.setPassword({
			subjectId,
			password: "correct-horse-battery",
			actor: { kind: "admin" },
		});

		server.use(
			http.post(`${provider.origin}/revoke`, () => new HttpResponse(null, { status: 500 })),
		);

		let result = await tenant.unlinkIdentity({
			subjectId,
			connectionSlug: "acme-oidc",
			actor: { type: "subject", id: subjectId },
		});

		expect(result).toMatchObject({ ok: true });

		let described = await tenant.describeSubject({ subjectId, audience: { kind: "admin" } });
		if (!described.ok) throw new Error("unreachable");
		expect(described.identities).toHaveLength(0);
		expect(latestAuditDetail("identity.unlinked")).toMatchObject({ providerRevoked: false });
	});

	test("a self-unlink leaves the subject's other live sessions standing", async () => {
		let provider = stubProvider();
		await createConnection(provider.origin);

		let first = await signInAndResume(provider);
		await tenant.setPassword({
			subjectId: first.subjectId,
			password: "correct-horse-battery",
			actor: { kind: "admin" },
		});
		let second = await signInAndResume(provider);

		let result = await tenant.unlinkIdentity({
			subjectId: first.subjectId,
			connectionSlug: "acme-oidc",
			actor: { type: "subject", id: first.subjectId },
		});
		expect(result).toMatchObject({ ok: true });

		let sessions = await tenant.listSubjectSessions({
			subjectId: first.subjectId,
			callerSessionId: first.sessionId,
		});
		if (!sessions.ok) throw new Error("unreachable");
		expect(sessions.sessions.map((session) => session.id).sort()).toEqual(
			[first.sessionId, second.sessionId].sort(),
		);
	});

	test("an administrative unlink revokes every live session carrying that connection kind's amr", async () => {
		let provider = stubProvider();
		await createConnection(provider.origin);

		let first = await signInAndResume(provider);
		await tenant.setPassword({
			subjectId: first.subjectId,
			password: "correct-horse-battery",
			actor: { kind: "admin" },
		});
		await signInAndResume(provider);

		let result = await tenant.unlinkIdentity({
			subjectId: first.subjectId,
			connectionSlug: "acme-oidc",
			actor: { type: "platform", id: "system" },
		});
		expect(result).toMatchObject({ ok: true });

		let sessions = await tenant.listSubjectSessions({
			subjectId: first.subjectId,
			callerSessionId: first.sessionId,
		});
		if (!sessions.ok) throw new Error("unreachable");
		expect(sessions.sessions).toHaveLength(0);
	});
});

describe("linkIdentity", () => {
	/** Drives a sign-in the automatic linking rule declines, back to the ticket it mints instead. */
	async function beginConfirmedLink(provider: {
		origin: string;
		respondWith(build: () => Promise<Response> | Response): void;
	}): Promise<{ subjectId: string; ticket: string }> {
		await createConnection(provider.origin, { emailAuthority: true, autoLink: false });

		let created = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "ada@example.com" }],
		});
		if (!created.ok) throw new Error("setup failed");
		let added = await tenant.addIdentifier({
			subjectId: created.subjectId,
			kind: "email",
			value: "ada@example.com",
			actor: { kind: "subject" },
		});
		if (!added.ok || added.kind !== "email") throw new Error("setup failed");
		await tenant.verifyIdentifier({ ticket: added.ticket });

		let begun = await tenant.beginConnectionSignIn({
			slug: "acme-oidc",
			hostname: HOSTNAME,
			callbackOrigin: CALLBACK_ORIGIN,
		});
		if (!begun.ok) throw new Error("unreachable");
		let state = stateOf(begun.redirectUrl);

		provider.respondWith(() =>
			tokenResponse(provider.origin, begun.redirectUrl, {
				claims: { email: "ada@example.com", email_verified: true },
			}),
		);

		let completed = await tenant.completeConnectionSignIn({
			slug: "acme-oidc",
			callbackUrl: `${CALLBACK_ORIGIN}/u/connections/acme-oidc/callback?code=code-1&state=${state}`,
		});
		if (completed.ok || completed.reason !== "link_required") {
			throw new Error(`expected link_required, got ${JSON.stringify(completed)}`);
		}

		return { subjectId: created.subjectId, ticket: completed.ticket };
	}

	test("succeeds, and the caller can then sign in and resolve the same subject", async () => {
		let provider = stubProvider();
		let { subjectId, ticket } = await beginConfirmedLink(provider);

		let linked = await tenant.linkIdentity({
			subjectId,
			ticket,
			actor: { type: "subject", id: subjectId },
		});
		expect(linked).toMatchObject({ ok: true });

		let begun = await tenant.beginConnectionSignIn({
			slug: "acme-oidc",
			hostname: HOSTNAME,
			callbackOrigin: CALLBACK_ORIGIN,
		});
		if (!begun.ok) throw new Error("unreachable");
		let state = stateOf(begun.redirectUrl);

		provider.respondWith(() => tokenResponse(provider.origin, begun.redirectUrl));

		let completed = await tenant.completeConnectionSignIn({
			slug: "acme-oidc",
			callbackUrl: `${CALLBACK_ORIGIN}/u/connections/acme-oidc/callback?code=code-1&state=${state}`,
		});

		if (!completed.ok) throw new Error(`expected success, got ${JSON.stringify(completed)}`);
		expect(completed.subjectId).toBe(subjectId);
	});

	test("a second spend of the same ticket fails", async () => {
		let provider = stubProvider();
		let { subjectId, ticket } = await beginConfirmedLink(provider);

		let first = await tenant.linkIdentity({
			subjectId,
			ticket,
			actor: { type: "subject", id: subjectId },
		});
		expect(first).toMatchObject({ ok: true });

		let second = await tenant.linkIdentity({
			subjectId,
			ticket,
			actor: { type: "subject", id: subjectId },
		});
		expect(second).toMatchObject({ ok: false, reason: "invalid-ticket" });
	});

	test("a ticket presented by the wrong subject id fails", async () => {
		let provider = stubProvider();
		let { ticket } = await beginConfirmedLink(provider);

		let someoneElse = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "grace@example.com" }],
		});
		if (!someoneElse.ok) throw new Error("setup failed");

		let result = await tenant.linkIdentity({
			subjectId: someoneElse.subjectId,
			ticket,
			actor: { type: "subject", id: someoneElse.subjectId },
		});

		expect(result).toMatchObject({ ok: false, reason: "invalid-ticket" });
	});

	test("a ticket for a provider identity someone else already linked in the meantime fails with already-linked", async () => {
		let provider = stubProvider();
		let { subjectId, ticket } = await beginConfirmedLink(provider);

		let connectionId = connectionIdFor("acme-oidc");

		let elsewhere = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "someone-else@example.com" }],
		});
		if (!elsewhere.ok) throw new Error("setup failed");

		// The exact race this refuses: another callback for the same provider
		// identity lands and links it between this ticket's mint and its spend.
		insertConnectionIdentity(connectionId, "provider-subject-1", elsewhere.subjectId, null, null);

		let result = await tenant.linkIdentity({
			subjectId,
			ticket,
			actor: { type: "subject", id: subjectId },
		});

		expect(result).toMatchObject({ ok: false, reason: "already-linked" });
	});
});

describe("adoptIdentityAddress", () => {
	test("adds and immediately verifies the address when the identity's provider email is verified", async () => {
		let created = await tenant.createSubject({});
		if (!created.ok) throw new Error("setup failed");

		insertConnection("conn_verified");
		insertConnectionIdentity(
			"conn_verified",
			"provider-subject-1",
			created.subjectId,
			"provider@example.com",
			true,
		);

		let result = await tenant.adoptIdentityAddress({
			subjectId: created.subjectId,
			connectionSlug: "conn_verified",
			actor: { kind: "subject" },
		});

		expect(result).toMatchObject({
			ok: true,
			kind: "email",
			value: "provider@example.com",
			verified: true,
		});

		let described = await tenant.describeSubject({
			subjectId: created.subjectId,
			audience: { kind: "admin" },
		});
		if (!described.ok) throw new Error("unreachable");
		let identifier = described.identifiers.find((entry) => entry.value === "provider@example.com");
		expect(identifier?.verified).toBe(true);
	});

	test("adds it unverified with a spendable ticket when the provider did not verify it", async () => {
		let created = await tenant.createSubject({});
		if (!created.ok) throw new Error("setup failed");

		insertConnection("conn_unverified");
		insertConnectionIdentity(
			"conn_unverified",
			"provider-subject-1",
			created.subjectId,
			"unverified@example.com",
			false,
		);

		let result = await tenant.adoptIdentityAddress({
			subjectId: created.subjectId,
			connectionSlug: "conn_unverified",
			actor: { kind: "subject" },
		});

		if (!result.ok || result.verified) {
			throw new Error(`expected an unverified add, got ${JSON.stringify(result)}`);
		}
		expect(result.ticket.length).toBeGreaterThan(10);

		let verified = await tenant.verifyIdentifier({ ticket: result.ticket });
		expect(verified).toMatchObject({ ok: true, subjectId: created.subjectId });
	});

	test("refuses no-address when the identity carries none", async () => {
		let created = await tenant.createSubject({});
		if (!created.ok) throw new Error("setup failed");

		insertConnection("conn_no_address");
		insertConnectionIdentity(
			"conn_no_address",
			"provider-subject-1",
			created.subjectId,
			null,
			null,
		);

		let result = await tenant.adoptIdentityAddress({
			subjectId: created.subjectId,
			connectionSlug: "conn_no_address",
			actor: { kind: "subject" },
		});

		expect(result).toMatchObject({ ok: false, reason: "no-address" });
	});

	test("refuses identifier-taken when the address already belongs to someone else", async () => {
		let owner = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "taken@example.com" }],
		});
		if (!owner.ok) throw new Error("setup failed");
		let addedToOwner = await tenant.addIdentifier({
			subjectId: owner.subjectId,
			kind: "email",
			value: "taken@example.com",
			actor: { kind: "subject" },
		});
		if (!addedToOwner.ok || addedToOwner.kind !== "email") throw new Error("setup failed");
		await tenant.verifyIdentifier({ ticket: addedToOwner.ticket });

		let created = await tenant.createSubject({});
		if (!created.ok) throw new Error("setup failed");

		insertConnection("conn_taken");
		insertConnectionIdentity(
			"conn_taken",
			"provider-subject-1",
			created.subjectId,
			"taken@example.com",
			true,
		);

		let result = await tenant.adoptIdentityAddress({
			subjectId: created.subjectId,
			connectionSlug: "conn_taken",
			actor: { kind: "subject" },
		});

		expect(result).toMatchObject({ ok: false, reason: "identifier-taken" });
	});
});

describe("describeSubject: linked identities", () => {
	test("lists a connection's slug, address and linkedBy after an automatic link", async () => {
		let provider = stubProvider();
		await createConnection(provider.origin, { emailAuthority: true, autoLink: true });

		let created = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "ada@example.com" }],
		});
		if (!created.ok) throw new Error("setup failed");
		let added = await tenant.addIdentifier({
			subjectId: created.subjectId,
			kind: "email",
			value: "ada@example.com",
			actor: { kind: "subject" },
		});
		if (!added.ok || added.kind !== "email") throw new Error("setup failed");
		await tenant.verifyIdentifier({ ticket: added.ticket });

		let begun = await tenant.beginConnectionSignIn({
			slug: "acme-oidc",
			hostname: HOSTNAME,
			callbackOrigin: CALLBACK_ORIGIN,
		});
		if (!begun.ok) throw new Error("unreachable");
		let state = stateOf(begun.redirectUrl);

		provider.respondWith(() =>
			tokenResponse(provider.origin, begun.redirectUrl, {
				claims: { email: "ada@example.com", email_verified: true },
			}),
		);

		let completed = await tenant.completeConnectionSignIn({
			slug: "acme-oidc",
			callbackUrl: `${CALLBACK_ORIGIN}/u/connections/acme-oidc/callback?code=code-1&state=${state}`,
		});
		if (!completed.ok) throw new Error(`expected success, got ${JSON.stringify(completed)}`);

		let described = await tenant.describeSubject({
			subjectId: created.subjectId,
			audience: { kind: "admin" },
		});
		if (!described.ok) throw new Error("unreachable");

		expect(described.identities).toMatchObject([
			{ connectionSlug: "acme-oidc", providerEmail: "ada@example.com", linkedBy: "automatic" },
		]);
	});

	test("lists a connection's slug, address and linkedBy after an explicit linkIdentity", async () => {
		let provider = stubProvider();
		await createConnection(provider.origin, { emailAuthority: true, autoLink: false });

		let created = await tenant.createSubject({
			identifiers: [{ kind: "email", value: "ada@example.com" }],
		});
		if (!created.ok) throw new Error("setup failed");
		let added = await tenant.addIdentifier({
			subjectId: created.subjectId,
			kind: "email",
			value: "ada@example.com",
			actor: { kind: "subject" },
		});
		if (!added.ok || added.kind !== "email") throw new Error("setup failed");
		await tenant.verifyIdentifier({ ticket: added.ticket });

		let begun = await tenant.beginConnectionSignIn({
			slug: "acme-oidc",
			hostname: HOSTNAME,
			callbackOrigin: CALLBACK_ORIGIN,
		});
		if (!begun.ok) throw new Error("unreachable");
		let state = stateOf(begun.redirectUrl);

		provider.respondWith(() =>
			tokenResponse(provider.origin, begun.redirectUrl, {
				claims: { email: "ada@example.com", email_verified: true },
			}),
		);

		let completed = await tenant.completeConnectionSignIn({
			slug: "acme-oidc",
			callbackUrl: `${CALLBACK_ORIGIN}/u/connections/acme-oidc/callback?code=code-1&state=${state}`,
		});
		if (completed.ok || completed.reason !== "link_required") {
			throw new Error(`expected link_required, got ${JSON.stringify(completed)}`);
		}

		let linked = await tenant.linkIdentity({
			subjectId: created.subjectId,
			ticket: completed.ticket,
			actor: { type: "subject", id: created.subjectId },
		});
		expect(linked).toMatchObject({ ok: true });

		let described = await tenant.describeSubject({
			subjectId: created.subjectId,
			audience: { kind: "admin" },
		});
		if (!described.ok) throw new Error("unreachable");

		expect(described.identities).toMatchObject([
			{ connectionSlug: "acme-oidc", providerEmail: "ada@example.com", linkedBy: "subject" },
		]);
	});
});
