/**
 * Drives the published client library against this app's router, so the response payload
 * is parsed by the software that actually depends on it rather than by an imitation of
 * it. The library is pinned to the production origin and reads no configuration, so its
 * requests are intercepted and handed to the router unchanged.
 *
 * Only the subject lookup runs through the library here. Its token call sends a multipart
 * body, and multipart parsing does not survive the request interception this file needs —
 * that wire format is covered by `subject.test.ts`, which builds the same bytes directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { AuthSDK } from "@pkg/auth-sdk";
import { isFailure } from "@pkg/result";
import { http, passthrough } from "msw";
import { setupServer } from "msw/node";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import { createTestApp } from "~/app/lib/test/http";
import { ORIGIN, seed } from "~/app/lib/test/seed";
import routes from "~/routes/web";

let app: TestApp;
let fixtures: Fixtures;

/**
 * Forwards every request aimed at the production origin into this app's router, which is
 * the only way to point the library at the app under test without changing the library.
 */
let server = setupServer(
	http.all("https://auth.sergiodxa.com/*", async ({ request }) => {
		if (!app) return passthrough();
		// Copied into this realm's `Request`, which is what the router is typed against.
		return await app.fetch(new Request(request.url, request));
	}),
);

/** Runs a `client_credentials` grant and returns the access token it issued. */
async function clientCredentialsToken(): Promise<string> {
	let response = await app.fetch(
		new Request(`${ORIGIN}${routes.oauth.token.href()}`, {
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				Authorization: `Basic ${btoa(`${fixtures.clientId}:${fixtures.clientSecret}`)}`,
			},
			body: new URLSearchParams({ grant_type: "client_credentials" }),
		}),
	);

	expect(response.status).toBe(200);
	let tokens = (await response.json()) as { access_token: string };
	return tokens.access_token;
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
	app = await createTestApp();
	fixtures = await seed(app);
});

describe("the published client library", () => {
	test("parses the subject payload this endpoint returns", async () => {
		let sdk = new AuthSDK({ client: { id: fixtures.clientId, secret: fixtures.clientSecret } });
		let token = await clientCredentialsToken();

		let subject = await sdk.fetchSubjectById(fixtures.subjectId, token);

		// The library validates the payload itself, so reaching past this line already
		// proves its shape; the assertions pin the values it carried through.
		if (isFailure(subject)) throw subject.error;

		expect(subject.data.id).toBe(fixtures.subjectId);
		expect(subject.data.displayName).toBe("Jane Doe");
		expect(subject.data.username).toBe("jane");
		expect(subject.data.emailAddress).toBe("jane@example.com");
		expect(subject.data.avatar).toBe("https://example.com/jane.png");
		expect(subject.data.role).toBe("user");
		expect(subject.data.createdAt).toBeInstanceOf(Date);
		expect(subject.data.createdAt.getTime()).toBeGreaterThan(0);
		expect(subject.data.updatedAt).toBeInstanceOf(Date);
	});

	test("parses a payload served from the cache identically", async () => {
		let sdk = new AuthSDK({ client: { id: fixtures.clientId, secret: fixtures.clientSecret } });
		let token = await clientCredentialsToken();

		await sdk.fetchSubjectById(fixtures.subjectId, token);
		// Let the cache write settle, so the second call is answered from it.
		await Bun.sleep(0);

		let subject = await sdk.fetchSubjectById(fixtures.subjectId, token);
		if (isFailure(subject)) throw subject.error;
		expect(subject.data.displayName).toBe("Jane Doe");
		expect(subject.data.createdAt).toBeInstanceOf(Date);
	});

	test("reports an unknown subject as a failure", async () => {
		let sdk = new AuthSDK({ client: { id: fixtures.clientId, secret: fixtures.clientSecret } });
		let token = await clientCredentialsToken();

		let subject = await sdk.fetchSubjectById("00000000-0000-0000-0000-000000000000", token);
		expect(isFailure(subject)).toBe(true);
	});

	test("reports an unusable token as a failure", async () => {
		let sdk = new AuthSDK({ client: { id: fixtures.clientId, secret: fixtures.clientSecret } });

		let subject = await sdk.fetchSubjectById(fixtures.subjectId, "not-a-token");
		expect(isFailure(subject)).toBe(true);
	});
});
