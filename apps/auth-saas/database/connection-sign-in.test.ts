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
function stubProvider(): {
	origin: string;
	tokenEndpointRequests: URLSearchParams[];
	respondWith(build: () => Promise<Response> | Response): void;
} {
	origins += 1;
	let origin = `http://localhost:${5000 + origins}`;
	let tokenEndpointRequests: URLSearchParams[] = [];
	let respond: (() => Promise<Response> | Response) | null = null;

	server.use(
		http.get(`${origin}/.well-known/openid-configuration`, () =>
			HttpResponse.json({
				issuer: origin,
				authorization_endpoint: `${origin}/authorize`,
				token_endpoint: `${origin}/token`,
				jwks_uri: `${origin}/jwks`,
				userinfo_endpoint: `${origin}/userinfo`,
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
	);

	return {
		origin,
		tokenEndpointRequests,
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
	overrides: { slug?: string; onUnknownSubject?: "create" | "refuse" } = {},
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
