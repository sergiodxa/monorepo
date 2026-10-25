/**
 * Drives `POST /oauth/par` and the `/authorize` call that redeems what it minted through a
 * real tenant router: the RFC 9126 §2.1 request pushed with `client_secret_basic`, then the
 * `request_uri` sent once, twice, late, and under another client's id.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64 } from "@sdxc/crypto";
import { JWK, JWT } from "@sdxc/jwt";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { RegisterClientInput } from "~/app/models/tenant/clients";
import type { Harness } from "~/app/test/harness/hosted";

import { buildHarness, ISSUER, REDIRECT_URI } from "~/app/test/harness/hosted";
import { RFC9126_PARAMETERS } from "~/app/test/rfc9126";

/** A request object as RFC 9101 §4 types it, for signing fixtures. */
class TypedRequestObject extends JWT {
	static override type = "oauth-authz-req+jwt";
}

let harness: Harness;

beforeEach(async () => {
	harness = await buildHarness();
});

afterEach(() => {
	vi.useRealTimers();
});

/** The RFC 9126 §2.1 authorization parameters, aimed at the harness client. */
function rfcParameters(clientId: string): Record<string, string> {
	return {
		...RFC9126_PARAMETERS,
		client_id: clientId,
		redirect_uri: REDIRECT_URI,
		scope: "openid",
	};
}

/** Registers a confidential client and answers its id and one-time secret. */
async function createClient(
	overrides: Partial<RegisterClientInput> = {},
): Promise<{ id: string; secret: string }> {
	let result = await harness.tenantDO.registerClient({
		name: "PAR client",
		kind: "confidential",
		redirectUris: [REDIRECT_URI],
		postLogoutRedirectUris: [],
		grantTypes: ["authorization_code"],
		responseTypes: ["code"],
		scopes: ["openid"],
		tokenEndpointAuthMethod: "client_secret_basic",
		requireConsent: false,
		...overrides,
	});
	if (!result.ok || !result.secret) throw new Error("client refused");
	return { id: result.client.id, secret: result.secret };
}

/** A `POST /oauth/par` with `Basic` credentials and the given form. */
function parRequest(client: { id: string; secret: string }, form: Record<string, string>): Request {
	let credentials = Base64.encode(new TextEncoder().encode(`${client.id}:${client.secret}`));
	return harness.request("/oauth/par", {
		method: "POST",
		headers: {
			Authorization: `Basic ${credentials}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams(form),
	});
}

/** Pushes the RFC parameters for a client and answers the minted `request_uri`. */
async function pushedRequestUri(client: { id: string; secret: string }): Promise<string> {
	let response = await harness.router.fetch(parRequest(client, rfcParameters(client.id)));
	let body = (await response.json()) as { request_uri: string };
	return body.request_uri;
}

/** A `GET /authorize` carrying only `client_id` and `request_uri`, as RFC 9126 §4 shows it. */
function authorizeWith(clientId: string, requestUri: string): Request {
	let query = new URLSearchParams({ client_id: clientId, request_uri: requestUri });
	return harness.request(`/authorize?${query}`);
}

describe("POST /oauth/par", () => {
	test("answers 201 with a request_uri and expires_in, uncacheable (§2.2)", async () => {
		let client = await createClient();

		let response = await harness.router.fetch(parRequest(client, rfcParameters(client.id)));

		expect(response.status).toBe(201);
		expect(response.headers.get("Cache-Control")).toBe("no-cache, no-store");
		expect(await response.json()).toEqual({
			request_uri: expect.stringMatching(/^urn:ietf:params:oauth:request_uri:/),
			expires_in: 60,
		});
	});

	test("refuses a client_id that names another client than the Basic credentials", async () => {
		let client = await createClient();

		let response = await harness.router.fetch(
			parRequest(client, { ...rfcParameters(client.id), client_id: "client_other" }),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: "invalid_request" });
	});

	test("answers invalid_client at 401 for a secret that does not verify", async () => {
		let client = await createClient();

		let response = await harness.router.fetch(
			parRequest({ id: client.id, secret: "csec_wrong" }, rfcParameters(client.id)),
		);

		expect(response.status).toBe(401);
		expect(response.headers.get("WWW-Authenticate")).toBe("Basic");
		expect(await response.json()).toMatchObject({ error: "invalid_client" });
	});

	test("answers the RFC 9126 §2.3 error shape for a redirect_uri the client never registered", async () => {
		let client = await createClient();

		let response = await harness.router.fetch(
			parRequest(client, {
				...rfcParameters(client.id),
				redirect_uri: "https://attacker.example.com/cb",
			}),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Cache-Control")).toBe("no-cache, no-store");
		expect(await response.json()).toEqual({
			error: "invalid_request",
			error_description: "redirect_uri does not match a registered value.",
		});
	});
});

describe("GET /authorize with a pushed request_uri", () => {
	test("continues the pushed request to sign-in, reading only client_id from the query", async () => {
		let client = await createClient();
		let requestUri = await pushedRequestUri(client);

		let response = await harness.router.fetch(authorizeWith(client.id, requestUri));

		expect(response.status).toBe(302);
		expect(new URL(response.headers.get("Location") ?? "").pathname).toBe("/u/sign-in");
	});

	test("refuses the same request_uri a second time", async () => {
		let client = await createClient();
		let requestUri = await pushedRequestUri(client);

		await harness.router.fetch(authorizeWith(client.id, requestUri));
		let reused = await harness.router.fetch(authorizeWith(client.id, requestUri));

		expect(reused.status).toBe(400);
		expect(reused.headers.get("Location")).toBeNull();
		expect(await reused.text()).toContain("request_uri");
	});

	test("refuses a request_uri past its sixty seconds", async () => {
		let client = await createClient();
		let requestUri = await pushedRequestUri(client);

		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(Date.now() + 61_000);
		let response = await harness.router.fetch(authorizeWith(client.id, requestUri));

		expect(response.status).toBe(400);
		expect(response.headers.get("Location")).toBeNull();
	});

	test("refuses a request_uri presented under another client's id", async () => {
		let client = await createClient();
		let other = await createClient();
		let requestUri = await pushedRequestUri(client);

		let mismatched = await harness.router.fetch(authorizeWith(other.id, requestUri));
		let rightful = await harness.router.fetch(authorizeWith(client.id, requestUri));

		expect(mismatched.status).toBe(400);
		expect(rightful.status).toBe(302);
	});

	test("refuses a direct request from a client that requires PAR, and accepts its pushed one", async () => {
		let client = await createClient({ requirePushedAuthorizationRequests: true });

		let direct = await harness.router.fetch(
			harness.request(`/authorize?${new URLSearchParams(rfcParameters(client.id))}`),
		);
		let pushed = await harness.router.fetch(
			authorizeWith(client.id, await pushedRequestUri(client)),
		);

		expect(direct.status).toBe(400);
		expect(await direct.text()).toContain("PAR endpoint");
		expect(pushed.status).toBe(302);
	});

	test("refuses every direct request once the tenant requires PAR", async () => {
		let client = await createClient();
		await harness.tenantDO.setPushedAuthorizationRequestPolicy({ required: true });

		let direct = await harness.router.fetch(
			harness.request(`/authorize?${new URLSearchParams(rfcParameters(client.id))}`),
		);
		let pushed = await harness.router.fetch(
			authorizeWith(client.id, await pushedRequestUri(client)),
		);

		expect(direct.status).toBe(400);
		expect(pushed.status).toBe(302);
	});
});

describe("request objects (RFC 9101)", () => {
	/** A client holding a fresh ES256 key in `jwks`, and that key for signing. */
	async function createSigningClient() {
		let pair = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
		let client = await createClient({
			jwks: { keys: [pair.jwk as Record<string, string>] },
		});
		return { client, pair };
	}

	/** The RFC 9126 parameters for a client, signed into a request object aimed at this tenant. */
	function signRequestObject(clientId: string, pair: JWK.KeyPair): Promise<string> {
		return new TypedRequestObject({
			iss: clientId,
			aud: ISSUER,
			exp: "5m",
			...rfcParameters(clientId),
		}).sign(JWK.Algorithm.ES256, [pair]);
	}

	test("/authorize reads only the object's claims, ignoring the rest of the query", async () => {
		let { client, pair } = await createSigningClient();
		let request = await signRequestObject(client.id, pair);
		let query = new URLSearchParams({
			client_id: client.id,
			request,
			redirect_uri: "https://attacker.example.com/cb",
		});

		let response = await harness.router.fetch(harness.request(`/authorize?${query}`));

		expect(response.status).toBe(302);
		expect(new URL(response.headers.get("Location") ?? "").pathname).toBe("/u/sign-in");
	});

	test("/authorize renders invalid_request_object for an object signed by another key", async () => {
		let { client } = await createSigningClient();
		let stranger = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
		let query = new URLSearchParams({
			client_id: client.id,
			request: await signRequestObject(client.id, stranger),
		});

		let response = await harness.router.fetch(harness.request(`/authorize?${query}`));

		expect(response.status).toBe(400);
		expect(response.headers.get("Location")).toBeNull();
	});

	test("/authorize refuses an object whose client_id differs from the query's", async () => {
		let { client, pair } = await createSigningClient();
		let other = await createClient();
		let query = new URLSearchParams({
			client_id: other.id,
			request: await signRequestObject(client.id, pair),
		});

		let response = await harness.router.fetch(harness.request(`/authorize?${query}`));

		expect(response.status).toBe(400);
	});

	test("the PAR endpoint accepts a pushed object, and /authorize redeems it", async () => {
		let { client, pair } = await createSigningClient();
		let request = await signRequestObject(client.id, pair);

		let pushed = await harness.router.fetch(parRequest(client, { client_id: client.id, request }));
		let body = (await pushed.json()) as { request_uri: string };
		let response = await harness.router.fetch(authorizeWith(client.id, body.request_uri));

		expect(pushed.status).toBe(201);
		expect(response.status).toBe(302);
	});

	test("the PAR endpoint answers invalid_request_object for an object it cannot verify", async () => {
		let { client } = await createSigningClient();

		let response = await harness.router.fetch(
			parRequest(client, { client_id: client.id, request: "e30.e30.c2ln" }),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: "invalid_request_object" });
	});
});
