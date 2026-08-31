/**
 * Specs for the onboarding ID-token verification: serves a discovery document and a
 * key set over MSW the way the platform provider publishes them, then asserts the
 * accepted token's claims, the tolerated skew, and the `null` every failure answers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { JWK, JWT } from "@pkg/jwt";
import { env } from "cloudflare:workers";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { verifyIdToken } from "./id-token-verify";

/** The client the dashboard is registered as, and the audience every token names. */
const AUDIENCE = "dashboard";

/**
 * The identifier the platform provider publishes as its discovery `issuer` and writes
 * into every `iss`. It carries the scheme — `https://auth.sergiodxa.com` in production
 * — so the fixture builds it from the platform domain the way the app itself does.
 */
const IDENTIFIER = `https://${env.PLATFORM_DOMAIN}`;

/** Origins already handed out, so each test reads a provider of its own. */
let origins = 0;

let keyPair: JWK.KeyPair[];
let otherKeyPair: JWK.KeyPair[];
let edwardsKeyPair: JWK.KeyPair[];

/** MSW server intercepting the discovery and key-set reads. */
let server = setupServer();

beforeAll(async () => {
	server.listen({ onUnhandledRequest: "error" });
	keyPair = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
	otherKeyPair = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
	edwardsKeyPair = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.EdDSA))];
});

afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * Serves a provider on an origin no earlier test has read, so a memoized issuer from
 * one test never answers another.
 *
 * @param options - What the provider publishes, each member replacing the default.
 * @param options.issuer - The identifier the discovery document names.
 * @param options.jwks - The key set body served at the published `jwks_uri`.
 * @param options.jwksStatus - The status the key-set read answers with.
 * @returns The origin the provider answers on, and how many reads it has served.
 */
function stubProvider(options: { issuer?: string; jwks?: unknown; jwksStatus?: number } = {}): {
	origin: string;
	reads: () => { discovery: number; jwks: number };
} {
	origins += 1;

	let origin = `http://localhost:${4000 + origins}`;
	let discovery = 0;
	let jwks = 0;

	server.use(
		http.get(`${origin}/.well-known/openid-configuration`, () => {
			discovery += 1;
			return HttpResponse.json({
				issuer: options.issuer ?? IDENTIFIER,
				authorization_endpoint: `${origin}/authorize`,
				token_endpoint: `${origin}/oauth/token`,
				jwks_uri: `${origin}/.well-known/jwks.json`,
			});
		}),
		http.get(`${origin}/.well-known/jwks.json`, () => {
			jwks += 1;
			return HttpResponse.json((options.jwks ?? JWK.toJSON(keyPair)) as Record<string, unknown>, {
				status: options.jwksStatus ?? 200,
			});
		}),
	);

	return { origin, reads: () => ({ discovery, jwks }) };
}

/**
 * Signs an ID token the way the platform provider does, letting a test override the
 * claims that make a fixture valid or invalid.
 *
 * @param overrides - Claims layered over a well-formed token.
 * @param signingKeys - The keys the token is signed with.
 * @param algorithm - The algorithm the token's header presents.
 */
function signIdToken(
	overrides: Record<string, unknown> = {},
	signingKeys: JWK.KeyPair[] = keyPair,
	algorithm: JWK.Algorithm = JWK.Algorithm.ES256,
): Promise<string> {
	let now = Math.floor(Date.now() / 1000);

	return new JWT({
		iss: IDENTIFIER,
		aud: AUDIENCE,
		sub: "subject-123",
		email: "owner@example.test",
		email_verified: true,
		sid: "tenant-session-1",
		nonce: "nonce-abc",
		iat: now,
		nbf: now,
		exp: now + 300,
		jti: crypto.randomUUID(),
		...overrides,
	}).sign(algorithm, signingKeys);
}

describe("verifyIdToken — accepts", () => {
	test("answers with the claims a dashboard session is minted from", async () => {
		let { origin } = stubProvider();

		let idToken = await verifyIdToken(await signIdToken(), {
			origin,
			audience: AUDIENCE,
		});

		expect(idToken?.subject).toBe("subject-123");
		expect(idToken?.email).toBe("owner@example.test");
		expect(idToken?.emailVerified).toBe(true);
	});

	test("carries the `sid` logout revokes the upstream session with", async () => {
		let { origin } = stubProvider();

		let idToken = await verifyIdToken(await signIdToken(), {
			origin,
			audience: AUDIENCE,
		});

		expect(idToken?.sessionId).toBe("tenant-session-1");
	});

	test("echoes the nonce, leaving the comparison to the login that asked for it", async () => {
		let { origin } = stubProvider();

		let idToken = await verifyIdToken(await signIdToken({ nonce: "nonce-xyz" }), {
			origin,
			audience: AUDIENCE,
		});

		expect(idToken?.nonce).toBe("nonce-xyz");
	});

	test("answers a null nonce for a token carrying none", async () => {
		let { origin } = stubProvider();

		let idToken = await verifyIdToken(await signIdToken({ nonce: undefined }), {
			origin,
			audience: AUDIENCE,
		});

		expect(idToken).not.toBeNull();
		expect(idToken?.nonce).toBeNull();
	});

	test("tolerates a minute of drift, so a token just past its expiry still verifies", async () => {
		let { origin } = stubProvider();
		let now = Math.floor(Date.now() / 1000);

		let idToken = await verifyIdToken(await signIdToken({ exp: now - 30, nbf: now - 300 }), {
			origin,
			audience: AUDIENCE,
		});

		expect(idToken?.subject).toBe("subject-123");
	});

	test("reads the provider's documents once across the logins one isolate answers", async () => {
		let { origin, reads } = stubProvider();

		await verifyIdToken(await signIdToken(), { origin, audience: AUDIENCE });
		await verifyIdToken(await signIdToken(), { origin, audience: AUDIENCE });

		expect(reads()).toEqual({ discovery: 1, jwks: 1 });
	});
});

describe("verifyIdToken — refuses", () => {
	test("a token naming another issuer", async () => {
		let { origin } = stubProvider();

		let idToken = await verifyIdToken(await signIdToken({ iss: "https://evil.example.test" }), {
			origin,
			audience: AUDIENCE,
		});

		expect(idToken).toBeNull();
	});

	test("a token issued for another client", async () => {
		let { origin } = stubProvider();

		let idToken = await verifyIdToken(await signIdToken({ aud: "some-other-client" }), {
			origin,
			audience: AUDIENCE,
		});

		expect(idToken).toBeNull();
	});

	test("a token expired beyond the tolerated drift", async () => {
		let { origin } = stubProvider();
		let now = Math.floor(Date.now() / 1000);

		let idToken = await verifyIdToken(await signIdToken({ exp: now - 3600, nbf: now - 7200 }), {
			origin,
			audience: AUDIENCE,
		});

		expect(idToken).toBeNull();
	});

	test("a token whose `nbf` places it in the future", async () => {
		let { origin } = stubProvider();
		let now = Math.floor(Date.now() / 1000);

		let idToken = await verifyIdToken(await signIdToken({ nbf: now + 3600, exp: now + 7200 }), {
			origin,
			audience: AUDIENCE,
		});

		expect(idToken).toBeNull();
	});

	test("a token signed by a key the provider does not publish", async () => {
		let { origin } = stubProvider();

		let idToken = await verifyIdToken(await signIdToken({}, otherKeyPair), {
			origin,
			audience: AUDIENCE,
		});

		expect(idToken).toBeNull();
	});

	test("a token signed with an algorithm the provider does not sign with", async () => {
		let { origin } = stubProvider({ jwks: JWK.toJSON([...keyPair, ...edwardsKeyPair]) });

		let idToken = await verifyIdToken(await signIdToken({}, edwardsKeyPair, JWK.Algorithm.EdDSA), {
			origin,
			audience: AUDIENCE,
		});

		expect(idToken).toBeNull();
	});

	test("a token that is not a JWT at all", async () => {
		let { origin } = stubProvider();

		let idToken = await verifyIdToken("not.a.jwt", {
			origin,
			audience: AUDIENCE,
		});

		expect(idToken).toBeNull();
	});

	test("every token while the key set is unavailable", async () => {
		let { origin } = stubProvider({ jwks: {}, jwksStatus: 503 });

		let idToken = await verifyIdToken(await signIdToken(), {
			origin,
			audience: AUDIENCE,
		});

		expect(idToken).toBeNull();
	});

	test("every token while the published key set holds no key", async () => {
		let { origin } = stubProvider({ jwks: { keys: [] } });

		let idToken = await verifyIdToken(await signIdToken(), {
			origin,
			audience: AUDIENCE,
		});

		expect(idToken).toBeNull();
	});

	test("every token while the discovery document publishes a bare host", async () => {
		let { origin } = stubProvider({ issuer: env.PLATFORM_DOMAIN });

		let idToken = await verifyIdToken(await signIdToken(), {
			origin,
			audience: AUDIENCE,
		});

		expect(idToken).toBeNull();
	});
});
