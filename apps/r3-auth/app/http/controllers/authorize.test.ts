/**
 * Router-level tests of the authorization endpoint and the code it issues: the full
 * authorization-code flow with PKCE and without it, every `prompt` value, exact
 * redirect-URI matching, code replay and expiry, the three response modes, and the
 * parameterless self-redirect.
 *
 * The PKCE pair is the point of this file. One test proves a code issued with a
 * challenge cannot be redeemed without the matching verifier; the other proves a code
 * issued without one still redeems with no verifier at all, which is what keeps every
 * client that does not use PKCE working.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import { Base64Url, password, sha256 } from "@pkg/crypto";
import { isFailure } from "@pkg/result";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import { AUTH_SERVER_CLIENT_ID } from "~/app/config";
import Credential from "~/app/data/credential";
import Subject from "~/app/data/subject";
import { createTestApp } from "~/app/lib/test/http";
import {
	authorizeUrl,
	exchangeCode,
	ORIGIN,
	REDIRECT_URI,
	seed,
	signIn,
	submitSignIn,
} from "~/app/lib/test/seed";
import en from "~/app/locales/en";
import routes from "~/routes/web";

/** The verifier a PKCE flow commits to, long enough to satisfy RFC 7636 §4.1. */
const CODE_VERIFIER = "a-verifier-long-enough-to-satisfy-rfc-7636-requirements";

let app: TestApp;
let fixtures: Fixtures;

/** Derives the `S256` challenge for a verifier, exactly as a client library would. */
async function challengeFor(verifier: string): Promise<string> {
	let digest = await sha256(verifier);
	if (isFailure(digest)) throw new Error("Could not derive the challenge");
	return Base64Url.encode(digest.data);
}

/** The address the registration tests sign up with, which no fixture holds. */
const NEW_EMAIL = "newcomer@example.com";

/** The password those tests register and then sign in with. */
const NEW_PASSWORD = "a-brand-new-password";

/** Posts the registration form for whichever authorization request is parked. */
async function register(): Promise<Response> {
	return await app.fetch(
		new Request(`${ORIGIN}${routes.authorize.action.href()}`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			redirect: "manual",
			body: new URLSearchParams({
				email: NEW_EMAIL,
				password: NEW_PASSWORD,
				name: "New Comer",
				username: "newcomer",
			}),
		}),
	);
}

/** Runs an authorization request and returns the `code` it redirected back with. */
async function codeFrom(extra: Record<string, string> = {}): Promise<string> {
	let response = await app.fetch(
		new Request(authorizeUrl(fixtures, extra), { redirect: "manual" }),
	);
	let location = response.headers.get("location");
	if (!location) throw new Error(`Expected a redirect, got ${response.status}`);

	let code = new URL(location).searchParams.get("code");
	if (!code) throw new Error("The authorization response carried no code");

	return code;
}

beforeEach(async () => {
	app = await createTestApp();
	fixtures = await seed(app);
});

describe("GET /authorize", () => {
	test("issues a code by SSO for a signed-in subject, with state and iss", async () => {
		await signIn(app, fixtures);

		let response = await app.fetch(new Request(authorizeUrl(fixtures), { redirect: "manual" }));

		expect(response.status).toBe(303);

		let location = new URL(response.headers.get("location")!);
		expect(`${location.origin}${location.pathname}`).toBe(REDIRECT_URI);
		expect(location.searchParams.get("state")).toBe("state-123");
		expect(location.searchParams.get("iss")).toBe("https://auth.sergiodxa.com");
		expect(location.searchParams.get("code")).toBeTruthy();
	});

	test("renders the sign-in page when nobody is signed in", async () => {
		let response = await app.fetch(new Request(authorizeUrl(fixtures)));

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");

		let body = await response.text();
		expect(body).toContain("Client App");
		// The provider button is what an ordinary sign-in offers; the credential form is
		// only rendered for a request that asked to create an account.
		expect(body).toContain('action="/auth/github"');
		expect(body).not.toContain('name="password"');
	});

	test("spends no budget on a probe carrying no authorization request", async () => {
		// The bare domain redirects here, so a monitor, a crawler or a bodyless probe on `/`
		// arrives at this handler with no query at all and is answered with the parameterless
		// self-redirect. That request enumerates nothing, and the budget is keyed by IP, so
		// letting it spend would let a prober lock out whoever shares its egress.
		app = await createTestApp({ limits: { authorize: 1 } });
		fixtures = await seed(app);

		let bare = `${ORIGIN}${routes.authorize.index.href()}`;

		expect((await app.fetch(new Request(bare, { redirect: "manual" }))).status).toBe(303);
		expect((await app.fetch(new Request(bare, { redirect: "manual" }))).status).toBe(303);
		expect(
			(await app.fetch(new Request(bare, { method: "HEAD", redirect: "manual" }))).status,
		).toBe(303);

		// The one slot in the budget is still there for the request it exists to protect.
		let response = await app.fetch(new Request(authorizeUrl(fixtures), { redirect: "manual" }));

		expect(response.status).toBe(200);
	});

	test("still limits a caller enumerating client ids", async () => {
		app = await createTestApp({ limits: { authorize: 1 } });
		fixtures = await seed(app);

		// Naming a client is what an enumeration does, and it costs the budget from the very
		// first attempt — before the lookup that would answer it.
		let first = await app.fetch(new Request(authorizeUrl(fixtures), { redirect: "manual" }));
		expect(first.status).toBe(200);

		let second = await app.fetch(
			new Request(authorizeUrl(fixtures, { client_id: "11111111-1111-4111-8111-111111111111" }), {
				redirect: "manual",
			}),
		);

		expect(second.status).toBe(429);
	});

	test("refuses a redirect_uri that is not the registered one, character for character", async () => {
		let response = await app.fetch(
			new Request(authorizeUrl(fixtures, { redirect_uri: `${REDIRECT_URI}?x=1` })),
		);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ message: "Invalid redirect URI" });
	});

	test("refuses an unregistered client", async () => {
		let response = await app.fetch(
			new Request(authorizeUrl(fixtures, { client_id: "11111111-1111-4111-8111-111111111111" })),
		);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ message: "Client not found" });
	});

	test("prompt=none without a session redirects with login_required and no code", async () => {
		let response = await app.fetch(
			new Request(authorizeUrl(fixtures, { prompt: "none" }), { redirect: "manual" }),
		);

		expect(response.status).toBe(303);

		let location = new URL(response.headers.get("location")!);
		expect(location.searchParams.get("error")).toBe("login_required");
		expect(location.searchParams.get("error_description")).toBe("User is not authenticated");
		expect(location.searchParams.get("state")).toBe("state-123");
		expect(location.searchParams.get("code")).toBeNull();
	});

	test("prompt=none with a session performs SSO", async () => {
		await signIn(app, fixtures);
		expect(await codeFrom({ prompt: "none" })).toBeTruthy();
	});

	test("prompt=login skips SSO and asks for credentials again", async () => {
		await signIn(app, fixtures);

		let response = await app.fetch(new Request(authorizeUrl(fixtures, { prompt: "login" })));

		// The sign-in page rather than a code: an existing session must not answer a
		// request that asked for the person to authenticate again.
		expect(response.status).toBe(200);
		expect(await response.text()).toContain('action="/auth/github"');
	});

	test("prompt=login and prompt=create together ask for credentials again", async () => {
		await signIn(app, fixtures);

		let response = await app.fetch(new Request(authorizeUrl(fixtures, { prompt: "login create" })));

		expect(response.status).toBe(200);
		expect(await response.text()).toContain('name="password"');
	});

	test("prompt=create renders the registration fields", async () => {
		let response = await app.fetch(new Request(authorizeUrl(fixtures, { prompt: "create" })));

		let body = await response.text();
		expect(body).toContain('name="name"');
		expect(body).toContain('name="username"');
		expect(body).toContain('name="email"');
		expect(body).toContain('name="password"');
	});

	test("prompt=consent and prompt=select_account still perform SSO", async () => {
		await signIn(app, fixtures);

		expect(await codeFrom({ prompt: "consent" })).toBeTruthy();
		expect(await codeFrom({ prompt: "select_account" })).toBeTruthy();
	});

	test("response_mode=form_post returns a self-submitting form instead of a redirect", async () => {
		await signIn(app, fixtures);

		let response = await app.fetch(
			new Request(authorizeUrl(fixtures, { response_mode: "form_post" })),
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(response.headers.get("pragma")).toBe("no-cache");

		let body = await response.text();
		expect(body).toContain(`action="${REDIRECT_URI}"`);
		expect(body).toContain('name="code"');
		expect(body).toContain("document.forms[0].submit()");
	});

	test("response_mode=fragment puts the parameters in the hash, not the query", async () => {
		await signIn(app, fixtures);

		let response = await app.fetch(
			new Request(authorizeUrl(fixtures, { response_mode: "fragment" }), { redirect: "manual" }),
		);

		let location = new URL(response.headers.get("location")!);
		expect(location.search).toBe("");
		expect(new URLSearchParams(location.hash.slice(1)).get("code")).toBeTruthy();
	});

	test("an unsupported code_challenge_method is an error redirect, not a silent downgrade", async () => {
		let response = await app.fetch(
			new Request(
				authorizeUrl(fixtures, { code_challenge: "abc", code_challenge_method: "S512" }),
				{
					redirect: "manual",
				},
			),
		);

		let location = new URL(response.headers.get("location")!);
		expect(location.searchParams.get("error")).toBe("invalid_request");
		expect(location.searchParams.get("code")).toBeNull();
	});

	test("a request with no OAuth parameters self-redirects with the server's own client", async () => {
		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.authorize.index.href()}`, { redirect: "manual" }),
		);

		expect(response.status).toBe(303);

		let location = new URL(response.headers.get("location")!);
		expect(location.pathname).toBe(routes.authorize.index.href());
		expect(location.searchParams.get("response_type")).toBe("code");
		expect(location.searchParams.get("client_id")).toBe(AUTH_SERVER_CLIENT_ID);
		expect(location.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/auth/callback`);
		expect(location.searchParams.get("state")).toBeTruthy();
	});

	test("a signed-in visitor with no OAuth parameters goes to their account", async () => {
		await signIn(app, fixtures);

		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.authorize.index.href()}`, { redirect: "manual" }),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.account.sessions.index.href());
	});
});

describe("POST /authorize", () => {
	test("refuses a submission with no authorization request parked in the session", async () => {
		let response = await submitSignIn(app);

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ message: "Invalid request" });
	});

	test("re-renders the page with the reason when the password is wrong", async () => {
		await app.fetch(new Request(authorizeUrl(fixtures)));

		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.authorize.action.href()}`, {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					email: "jane@example.com",
					password: "not-the-password",
					name: "Jane Doe",
					username: "jane",
				}),
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toContain(en.authorize.errors.accessDenied);
	});

	test("an existing subject signs in and is answered with a code", async () => {
		await app.fetch(new Request(authorizeUrl(fixtures)));

		let response = await submitSignIn(app);
		let location = new URL(response.headers.get("location")!);

		expect(response.status).toBe(303);
		expect(`${location.origin}${location.pathname}`).toBe(REDIRECT_URI);
		expect(location.searchParams.get("code")).toBeTruthy();
	});

	test("an unknown email registers the subject and is answered with a code", async () => {
		await app.fetch(new Request(authorizeUrl(fixtures, { prompt: "create" })));

		let response = await register();

		expect(response.status).toBe(303);
		expect(await Subject.findByEmail(app.db, NEW_EMAIL)).not.toBeNull();

		let location = new URL(response.headers.get("location")!);
		expect(`${location.origin}${location.pathname}`).toBe(REDIRECT_URI);
		expect(location.searchParams.get("code")).toBeTruthy();
	});

	test("a freshly registered account signs in again with the same password", async () => {
		await app.fetch(new Request(authorizeUrl(fixtures, { prompt: "create" })));
		await register();

		// Regression: registration used to store the credential with no `verified_at`,
		// which the sign-in path refuses outright, so the account it had just created
		// could never authenticate.
		await app.fetch(new Request(authorizeUrl(fixtures, { prompt: "login" })));
		let response = await register();

		expect(response.status).toBe(303);

		let location = new URL(response.headers.get("location")!);
		expect(location.searchParams.get("code")).toBeTruthy();
	});

	test("refuses a registered subject whose credential was never verified", async () => {
		let subject = await Subject.create(app.db, {
			email_address: "github@example.com",
			display_name: "Git Hub",
			username: "githubber",
			avatar: "https://example.com/gh.png",
		});

		let hash = await password.hash("a-password-somebody-else-chose");
		if (isFailure(hash)) throw new Error("Could not hash the password");
		await Credential.create(app.db, subject.id, hash.data, null);

		await app.fetch(new Request(authorizeUrl(fixtures)));

		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.authorize.action.href()}`, {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					email: "github@example.com",
					password: "a-password-somebody-else-chose",
					name: "Git Hub",
					username: "githubber",
				}),
			}),
		);

		expect(response.status).toBe(200);

		let body = await response.text();
		// The locale copy, not the engine's own `missing_validation` description, which
		// stays an internal diagnostic.
		expect(body).toContain(en.authorize.errors.missingValidation);
		expect(body).not.toContain("Verify your email address.");
	});
});

describe("the authorization code flow", () => {
	test("with PKCE: the code redeems with the matching verifier", async () => {
		await signIn(app, fixtures);

		let code = await codeFrom({
			code_challenge: await challengeFor(CODE_VERIFIER),
			code_challenge_method: "S256",
		});

		let response = await exchangeCode(app, fixtures, { code, code_verifier: CODE_VERIFIER });

		expect(response.status).toBe(200);

		let tokens = (await response.json()) as Record<string, unknown>;
		expect(tokens.token_type).toBe("Bearer");
		expect(typeof tokens.access_token).toBe("string");
		expect(typeof tokens.id_token).toBe("string");
		expect(typeof tokens.refresh_token).toBe("string");
	});

	test("with PKCE: the code is refused without a verifier", async () => {
		await signIn(app, fixtures);

		let code = await codeFrom({
			code_challenge: await challengeFor(CODE_VERIFIER),
			code_challenge_method: "S256",
		});

		let response = await exchangeCode(app, fixtures, { code });

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "invalid_request",
			error_description: "Missing code_verifier",
		});
	});

	test("with PKCE: the code is refused with the wrong verifier", async () => {
		await signIn(app, fixtures);

		let code = await codeFrom({
			code_challenge: await challengeFor(CODE_VERIFIER),
			code_challenge_method: "S256",
		});

		let response = await exchangeCode(app, fixtures, {
			code,
			code_verifier: "not-the-verifier-that-was-committed-to",
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: "invalid_grant" });
	});

	test("with PKCE: a plain challenge is honored when the client asks for it", async () => {
		await signIn(app, fixtures);

		let code = await codeFrom({
			code_challenge: CODE_VERIFIER,
			code_challenge_method: "plain",
		});

		expect((await exchangeCode(app, fixtures, { code })).status).toBe(400);
		expect(
			(await exchangeCode(app, fixtures, { code: await plainCode(), code_verifier: CODE_VERIFIER }))
				.status,
		).toBe(200);
	});

	test("with PKCE: the challenge survives the sign-in round trip through the session", async () => {
		// No session yet, so this parks the request — challenge included — and renders the
		// sign-in page instead of issuing a code straight away.
		await app.fetch(
			new Request(
				authorizeUrl(fixtures, {
					code_challenge: await challengeFor(CODE_VERIFIER),
					code_challenge_method: "S256",
				}),
			),
		);

		let login = await submitSignIn(app);
		let code = new URL(login.headers.get("location")!).searchParams.get("code")!;

		// The challenge arrived two requests ago. If the session had not carried it, this
		// verifier-less exchange would succeed.
		expect((await exchangeCode(app, fixtures, { code })).status).toBe(400);
	});

	test("without PKCE: the code redeems with no verifier at all", async () => {
		await signIn(app, fixtures);

		let response = await exchangeCode(app, fixtures, { code: await codeFrom() });

		expect(response.status).toBe(200);
		expect(typeof ((await response.json()) as Record<string, unknown>).access_token).toBe("string");
	});

	test("a code is single-use: replaying it is invalid_grant", async () => {
		await signIn(app, fixtures);

		let code = await codeFrom();
		expect((await exchangeCode(app, fixtures, { code })).status).toBe(200);

		let replay = await exchangeCode(app, fixtures, { code });
		expect(replay.status).toBe(400);
		expect(await replay.json()).toMatchObject({ error: "invalid_grant" });
	});

	test("an expired code is invalid_grant", async () => {
		await signIn(app, fixtures);

		let code = await codeFrom();
		// Expiry is the KV entry disappearing, which is what deleting it models.
		await app.kv.delete(`authz-code:${code}`);

		expect((await exchangeCode(app, fixtures, { code })).status).toBe(400);
	});

	test("a code cannot be redeemed against a different redirect_uri", async () => {
		await signIn(app, fixtures);

		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.oauth.token.href()}`, {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					grant_type: "authorization_code",
					code: await codeFrom(),
					redirect_uri: "https://evil.example.com/callback",
					client_id: fixtures.clientId,
					client_secret: fixtures.clientSecret,
				}),
			}),
		);

		expect(response.status).toBe(400);
	});
});

/** Issues a fresh `plain`-challenge code, since the previous one was just consumed. */
async function plainCode(): Promise<string> {
	return await codeFrom({ code_challenge: CODE_VERIFIER, code_challenge_method: "plain" });
}
