/**
 * Test-only fixtures shared by the router-level tests: registering a relying party and
 * a subject with a usable password, and driving the sign-in flow end to end so a test
 * that needs a signed-in browser gets one the app itself produced.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { password } from "@sdxc/crypto";

import type { TestApp } from "~/app/lib/test/http";

import Client from "~/app/data/client";
import Credential from "~/app/data/credential";
import Subject from "~/app/data/subject";
import routes from "~/routes/web";

/** Origin every test request is sent to. */
export const ORIGIN = "https://auth.example.com";

/** The relying party's registered redirect URI. */
export const REDIRECT_URI = "https://client.example.com/callback";

/** The seeded subject's email address. */
export const EMAIL = "jane@example.com";

/** The seeded subject's password. */
export const PASSWORD = "a-good-password";

/**
 * The scope {@link signIn} asks for, standing in for a client that keeps a session:
 * `offline_access` is where the refresh token its callers rely on comes from.
 */
const SIGN_IN_SCOPE = "openid offline_access";

/** A registered client, a subject, and the credentials to act as either. */
export interface Fixtures {
	clientId: string;
	clientSecret: string;
	subjectId: string;
}

/** How a test wants its seeded subject's address to start out. */
export interface SeedOptions {
	/**
	 * Whether `subjects.email_verified_at` starts stamped. Default `true`, so most tests start
	 * with a clean outbox; pass `false` to seed the state that asks for one.
	 */
	emailVerified?: boolean;
}

/**
 * Registers a relying party and a subject with a usable password credential. The credential
 * is created verified, since nothing else could hold the password chosen at registration for
 * an unclaimed address. The address itself starts verified by default.
 */
export async function seed(app: TestApp, options: SeedOptions = {}): Promise<Fixtures> {
	let client = await Client.create(app.db, {
		name: "Client App",
		description: "A relying party",
		redirect_uri: REDIRECT_URI,
		logout_uri: "https://client.example.com/logout",
	});

	let subject = await Subject.create(app.db, {
		email_address: EMAIL,
		display_name: "Jane Doe",
		username: "jane",
		avatar: "https://example.com/jane.png",
		email_verified_at: options.emailVerified === false ? null : Date.now(),
	});

	let hash = await password.hash(PASSWORD);
	if (hash.status === "failure") throw new Error("Could not hash the fixture password");

	await Credential.create(app.db, subject.id, hash.data, Date.now());

	return { clientId: client.id, clientSecret: client.secret, subjectId: subject.id };
}

/**
 * Builds an authorization request URL for the seeded client.
 *
 * @param extra - Parameters to add or override, such as `prompt` or `code_challenge`.
 */
export function authorizeUrl(fixtures: Fixtures, extra: Record<string, string> = {}): string {
	let url = new URL(routes.authorize.index.href(), ORIGIN);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("client_id", fixtures.clientId);
	url.searchParams.set("redirect_uri", REDIRECT_URI);
	url.searchParams.set("state", "state-123");
	for (let [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
	return url.toString();
}

/**
 * Posts the credential sign-in form for whichever authorization request is parked in
 * the session.
 */
export async function submitSignIn(app: TestApp): Promise<Response> {
	return await app.fetch(
		new Request(`${ORIGIN}${routes.authorize.action.href()}`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			redirect: "manual",
			body: new URLSearchParams({
				email: EMAIL,
				password: PASSWORD,
				name: "Jane Doe",
				username: "jane",
			}),
		}),
	);
}

/**
 * Exchanges an authorization code at the token endpoint, authenticating the client
 * through the request body.
 */
export async function exchangeCode(
	app: TestApp,
	fixtures: Fixtures,
	body: Record<string, string>,
): Promise<Response> {
	return await app.fetch(
		new Request(`${ORIGIN}${routes.oauth.token.href()}`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "authorization_code",
				redirect_uri: REDIRECT_URI,
				client_id: fixtures.clientId,
				client_secret: fixtures.clientSecret,
				...body,
			}),
		}),
	);
}

/** The token set an authorization-code exchange returns. */
export interface TokenSet {
	access_token: string;
	refresh_token: string;
	id_token: string;
	expires_in: number;
	token_type: "Bearer";
}

/**
 * Runs a whole sign-in — park the request, submit credentials, redeem the code — leaving the
 * client signed in to this server itself. Only the final session write reaches storage
 * directly, standing in for the self-login callback that lands in a later phase.
 *
 * @returns The tokens the flow produced.
 */
export async function signIn(app: TestApp, fixtures: Fixtures): Promise<TokenSet> {
	await app.fetch(new Request(authorizeUrl(fixtures, { scope: SIGN_IN_SCOPE })));

	let login = await submitSignIn(app);
	let location = login.headers.get("location");
	if (!location) throw new Error("Sign-in did not redirect back to the client");

	let code = new URL(location).searchParams.get("code");
	if (!code) throw new Error("Sign-in did not produce an authorization code");

	let tokens = (await (await exchangeCode(app, fixtures, { code })).json()) as TokenSet;

	await app.signIn(tokens.access_token, tokens.refresh_token);

	return tokens;
}
