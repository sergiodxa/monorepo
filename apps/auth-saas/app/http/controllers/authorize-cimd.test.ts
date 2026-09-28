/**
 * Drives a Client ID Metadata Document client through `/authorize`, `/u/consent` and
 * `/oauth/token`, the same real-router path `hosted/consent.test.ts` drives for a
 * registered client, so this exercises the fetch-and-validate step at the point a
 * request actually names one as `client_id` rather than unit-testing it in isolation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64Url, sha256 } from "@sdxc/crypto";
import { isFailure } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import type { Harness } from "~/app/http/controllers/hosted/test-harness";

import {
	buildHarness,
	cookieFrom,
	createTestSubjectWithPassword,
} from "~/app/http/controllers/hosted/test-harness";
import { clients } from "~/database/clients";

const CLIENT_METADATA_URL = "https://mcp.example.com/oauth/client-metadata.json";
const CIMD_REDIRECT_URI = "https://mcp.example.com/callback";

let server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Serves a valid metadata document at {@link CLIENT_METADATA_URL}. */
function serveMetadata(overrides: Record<string, unknown> = {}) {
	server.use(
		http.get(CLIENT_METADATA_URL, () =>
			HttpResponse.json(
				{
					client_id: CLIENT_METADATA_URL,
					client_name: "MCP Test Client",
					redirect_uris: [CIMD_REDIRECT_URI],
					response_types: ["code"],
					token_endpoint_auth_method: "none",
					scope: "openid profile",
					...overrides,
				},
				{ headers: { "Content-Type": "application/json" } },
			),
		),
	);
}

/** A PKCE verifier and its `S256` challenge, computed for real rather than a placeholder string. */
async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
	let verifier = `verifier-${crypto.randomUUID()}`;
	let hashed = await sha256(verifier);
	if (isFailure(hashed)) throw new Error("unreachable");
	return { verifier, challenge: Base64Url.encode(hashed.data) };
}

function authorizeQuery(challenge: string, redirectUri: string = CIMD_REDIRECT_URI): string {
	return new URLSearchParams({
		client_id: CLIENT_METADATA_URL,
		redirect_uri: redirectUri,
		response_type: "code",
		scope: "openid profile",
		code_challenge: challenge,
		code_challenge_method: "S256",
	}).toString();
}

/**
 * Posts a URL-encoded form through the router, with an explicit content-type so
 * MSW's raw-header patch — which otherwise breaks on the content-type undici
 * derives for a body-object POST once MSW is listening — never sees one to
 * rewrite.
 */
function postForm(
	harnessValue: Harness,
	path: string,
	fields: Record<string, string>,
	cookie?: string,
): Promise<Response> {
	return harnessValue.router.fetch(
		harnessValue.request(path, {
			method: "POST",
			body: new URLSearchParams(fields).toString(),
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			cookie,
		}),
	);
}

let harness: Harness;

beforeEach(async () => {
	harness = await buildHarness();
	await createTestSubjectWithPassword(harness.tenantDO, {
		email: "jane@example.com",
		password: "correct horse battery staple",
	});
});

/** Signs in against a fresh authorize request naming the CIMD client, landing on `/u/consent`. */
async function signInToConsent(challenge: string) {
	let authorizeResponse = await harness.router.fetch(
		harness.request(`/authorize?${authorizeQuery(challenge)}`),
	);
	let signInLocation = new URL(authorizeResponse.headers.get("Location") ?? "", CIMD_REDIRECT_URI);

	let signInResponse = await postForm(
		harness,
		`${signInLocation.pathname}${signInLocation.search}`,
		{
			identifier: "jane@example.com",
			password: "correct horse battery staple",
			remember: "true",
		},
	);

	let cookie = cookieFrom(signInResponse);
	let consentLocation = new URL(signInResponse.headers.get("Location") ?? "", CIMD_REDIRECT_URI);

	return { cookie, consentPath: `${consentLocation.pathname}${consentLocation.search}` };
}

describe("a Client ID Metadata Document client at /authorize", () => {
	test("the consent screen names the client the fetched document declared", async () => {
		serveMetadata();
		let { challenge } = await pkcePair();
		let { cookie, consentPath } = await signInToConsent(challenge);

		let show = await harness.router.fetch(harness.request(consentPath, { cookie }));

		expect(show.status).toBe(200);
		expect(await show.text()).toContain("MCP Test Client");
	});

	test("approving completes to a code redirect, exchanged for real tokens with PKCE", async () => {
		serveMetadata();
		let { verifier, challenge } = await pkcePair();
		let { cookie, consentPath } = await signInToConsent(challenge);

		let approve = await postForm(harness, consentPath, { decision: "approve" }, cookie);

		expect(approve.status).toBe(302);
		let location = new URL(approve.headers.get("Location") ?? "");
		expect(location.origin + location.pathname).toBe(CIMD_REDIRECT_URI);
		let code = location.searchParams.get("code");
		expect(code).toBeTruthy();

		let tokenResponse = await harness.router.fetch(
			harness.request("/oauth/token", {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					grant_type: "authorization_code",
					code: code ?? "",
					code_verifier: verifier,
					redirect_uri: CIMD_REDIRECT_URI,
					client_id: CLIENT_METADATA_URL,
				}).toString(),
			}),
		);

		expect(tokenResponse.status).toBe(200);
		let body = (await tokenResponse.json()) as Record<string, unknown>;
		expect(body.access_token).toEqual(expect.any(String));
		expect(body.token_type).toBe("Bearer");
	});

	test("exchanging without a valid PKCE verifier is refused", async () => {
		serveMetadata();
		let { challenge } = await pkcePair();
		let { cookie, consentPath } = await signInToConsent(challenge);

		let approve = await postForm(harness, consentPath, { decision: "approve" }, cookie);
		let code = new URL(approve.headers.get("Location") ?? "").searchParams.get("code");

		let tokenResponse = await harness.router.fetch(
			harness.request("/oauth/token", {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					grant_type: "authorization_code",
					code: code ?? "",
					code_verifier: "not-the-right-verifier",
					redirect_uri: CIMD_REDIRECT_URI,
					client_id: CLIENT_METADATA_URL,
				}).toString(),
			}),
		);

		expect(tokenResponse.status).toBe(400);
		let body = (await tokenResponse.json()) as Record<string, unknown>;
		expect(body.error).toBe("invalid_grant");
	});

	test("a redirect_uri absent from the fetched document is refused like any registered client's mismatch", async () => {
		serveMetadata();
		let { challenge } = await pkcePair();

		let response = await harness.router.fetch(
			harness.request(
				`/authorize?${authorizeQuery(challenge, "https://not-declared.example.com")}`,
			),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Location")).toBeNull();
		expect(await response.text()).toContain("redirect_uri");
	});

	test("no row is ever written to the tenant's own client table for this client_id", async () => {
		serveMetadata();
		let { challenge } = await pkcePair();
		let { cookie, consentPath } = await signInToConsent(challenge);

		await postForm(harness, consentPath, { decision: "approve" }, cookie);

		let rows = await harness.db.findMany(clients);
		expect(rows.some((row) => row.id === CLIENT_METADATA_URL)).toBe(false);
	});
});
