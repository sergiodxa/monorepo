/**
 * Exercises `RelyingParty.authorize` with pushed authorization requests (RFC 9126) and
 * request objects (RFC 9101): what reaches the PAR endpoint, what the browser carries
 * afterwards, and that a client configured with neither redirects as it always has.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWK, JWT } from "@sdxc/jwt";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { AuthSession } from "./auth-session.js";

import { AuthError, AuthErrorCode } from "./auth-error.js";
import { Issuer } from "./issuer.js";
import { RelyingParty } from "./relying-party.js";

/** The issuer the fixture client is registered with. */
const ISSUER = "https://sso.example.com";

/** The issuer's authorization endpoint. */
const AUTHORIZATION_ENDPOINT = `${ISSUER}/authorize`;

/** The issuer's PAR endpoint. */
const PAR_ENDPOINT = `${ISSUER}/oauth/par`;

/** The client the fixture relying party is registered as. */
const CLIENT_ID = "client-1";

/** The secret the fixture client authenticates with. */
const CLIENT_SECRET = "s3cr3t";

/** The callback the fixture client is registered with. */
const REDIRECT_URI = "https://app.example.com/auth/callback";

/** The reference the stub PAR endpoint answers with. */
const REQUEST_URI = "urn:ietf:params:oauth:request_uri:6esc_11ACC5bwc014ltc14eY22c";

/** The store a session middleware would hold for one browser, kept in memory. */
class MemoryStore implements AuthSession.Store {
	#values = new Map<string, unknown>();

	get(key: string): unknown {
		return this.#values.get(key);
	}

	set(key: string, value: unknown): void {
		this.#values.set(key, value);
	}

	unset(key: string): void {
		this.#values.delete(key);
	}
}

let server = setupServer();
let clientKeys: JWK.KeyPair[];

beforeAll(async () => {
	clientKeys = [await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256))];
	server.listen({ onUnhandledRequest: "error" });
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** A client against an issuer configured inline, advertising a PAR endpoint unless told otherwise. */
function createRelyingParty(
	options: Partial<RelyingParty.Options> = {},
	metadata: Partial<Issuer.Metadata> = { pushed_authorization_request_endpoint: PAR_ENDPOINT },
): RelyingParty {
	let issuer = new Issuer(ISSUER, {
		metadata: {
			issuer: ISSUER,
			authorization_endpoint: AUTHORIZATION_ENDPOINT,
			token_endpoint: `${ISSUER}/token`,
			jwks_uri: `${ISSUER}/jwks`,
			...metadata,
		},
	});
	return new RelyingParty(issuer, {
		clientId: CLIENT_ID,
		clientSecret: CLIENT_SECRET,
		redirectUri: REDIRECT_URI,
		...options,
	});
}

/** What the PAR endpoint saw. */
interface PushedRequest {
	body: URLSearchParams | null;
	authorization: string | null;
}

/** Intercepts the PAR endpoint, recording what was pushed and answering as RFC 9126 §2.2 shows. */
function stubParEndpoint(
	answer: () => Response = () =>
		HttpResponse.json({ request_uri: REQUEST_URI, expires_in: 60 }, { status: 201 }),
): PushedRequest {
	let seen: PushedRequest = { body: null, authorization: null };
	server.use(
		http.post(PAR_ENDPOINT, async ({ request }) => {
			seen.authorization = request.headers.get("authorization");
			seen.body = new URLSearchParams(await request.text());
			return answer();
		}),
	);
	return seen;
}

/** Starts a login and answers the redirect's target. */
async function startLogin(rp: RelyingParty): Promise<URL> {
	let response = await rp.authorize({
		request: new Request("https://app.example.com/login"),
		session: new MemoryStore(),
	});
	return new URL(response.headers.get("location") ?? "");
}

/** Verifies a request object with the fixture client's public keys, as the issuer would. */
async function verifyRequestObject(token: string): Promise<JWT> {
	class RequestObject extends JWT {
		static override type = "oauth-authz-req+jwt";
	}
	return RequestObject.verify(token, clientKeys, { issuer: CLIENT_ID, audience: ISSUER });
}

describe("authorize without pushing", () => {
	test("redirects with the parameters in the query and reaches no PAR endpoint", async () => {
		let target = await startLogin(createRelyingParty());

		expect(target.origin + target.pathname).toBe(AUTHORIZATION_ENDPOINT);
		expect(target.searchParams.get("response_type")).toBe("code");
		expect(target.searchParams.has("request_uri")).toBe(false);
	});
});

describe("authorize with pushAuthorizationRequests", () => {
	test("pushes the request with Basic credentials and redirects with client_id and request_uri alone", async () => {
		let pushed = stubParEndpoint();

		let target = await startLogin(
			createRelyingParty({ pushAuthorizationRequests: true, clientAuth: "client_secret_basic" }),
		);

		expect(pushed.authorization).toBe(`Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`);
		expect(pushed.body?.get("client_id")).toBe(CLIENT_ID);
		expect(pushed.body?.get("response_type")).toBe("code");
		expect(pushed.body?.get("redirect_uri")).toBe(REDIRECT_URI);
		expect(pushed.body?.get("code_challenge_method")).toBe("S256");
		expect(pushed.body?.has("client_secret")).toBe(false);
		expect(target.origin + target.pathname).toBe(AUTHORIZATION_ENDPOINT);
		expect([...target.searchParams]).toEqual([
			["client_id", CLIENT_ID],
			["request_uri", REQUEST_URI],
		]);
	});

	test("posts client_secret in the form under client_secret_post", async () => {
		let pushed = stubParEndpoint();

		await startLogin(createRelyingParty({ pushAuthorizationRequests: true }));

		expect(pushed.authorization).toBeNull();
		expect(pushed.body?.get("client_secret")).toBe(CLIENT_SECRET);
	});

	test("throws authorization_failed with the issuer's error when the push is refused", async () => {
		stubParEndpoint(() =>
			HttpResponse.json(
				{
					error: "invalid_request",
					error_description: "The redirect_uri is not valid for the given client",
				},
				{ status: 400 },
			),
		);

		let error = await startLogin(createRelyingParty({ pushAuthorizationRequests: true })).catch(
			(caught: unknown) => caught,
		);

		expect(AuthError.is(error, AuthErrorCode.AuthorizationFailed)).toBe(true);
		expect((error as AuthError).providerError).toBe("invalid_request");
	});

	test("throws endpoint_unsupported when the issuer advertises no PAR endpoint", async () => {
		let error = await startLogin(createRelyingParty({ pushAuthorizationRequests: true }, {})).catch(
			(caught: unknown) => caught,
		);

		expect(AuthError.is(error, AuthErrorCode.EndpointUnsupported)).toBe(true);
	});
});

describe("authorize with requestObject", () => {
	test("sends the parameters as a signed request object beside client_id", async () => {
		let target = await startLogin(
			createRelyingParty({
				requestObject: { algorithm: JWK.Algorithm.ES256, keys: clientKeys },
			}),
		);

		expect([...target.searchParams.keys()]).toEqual(["client_id", "request"]);
		let verified = await verifyRequestObject(target.searchParams.get("request") ?? "");
		expect(verified.payload).toMatchObject({
			client_id: CLIENT_ID,
			response_type: "code",
			redirect_uri: REDIRECT_URI,
			code_challenge_method: "S256",
		});
		expect(verified.payload.exp).toBeGreaterThan(Date.now() / 1000);
	});

	test("pushes the request object alone when pushing too", async () => {
		let pushed = stubParEndpoint();

		let target = await startLogin(
			createRelyingParty({
				pushAuthorizationRequests: true,
				clientAuth: "client_secret_basic",
				requestObject: { algorithm: JWK.Algorithm.ES256, keys: clientKeys },
			}),
		);

		expect([...(pushed.body?.keys() ?? [])]).toEqual(["client_id", "request"]);
		let verified = await verifyRequestObject(pushed.body?.get("request") ?? "");
		expect(verified.payload.redirect_uri).toBe(REDIRECT_URI);
		expect(target.searchParams.get("request_uri")).toBe(REQUEST_URI);
	});
});
