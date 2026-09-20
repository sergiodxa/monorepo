/**
 * Drives `GET /authorize` through a real tenant router: a fresh, unauthenticated
 * request lands on `/u/sign-in`, and a `render`-class failure (an unregistered
 * client, an unregistered redirect URI) renders `/u/error`'s content inline at
 * `/authorize`'s own URL rather than redirecting anywhere.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "vitest";

import type { Harness } from "~/app/http/controllers/hosted/test-harness";

import {
	buildHarness,
	createTestClient,
	REDIRECT_URI,
} from "~/app/http/controllers/hosted/test-harness";

let harness: Harness;

beforeEach(async () => {
	harness = await buildHarness();
});

/** A valid `/authorize` query for the given client, everything else defaulted. */
function authorizeQuery(clientId: string, overrides: Record<string, string> = {}): string {
	let params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: REDIRECT_URI,
		response_type: "code",
		scope: "openid",
		code_challenge: "a-valid-looking-challenge",
		code_challenge_method: "S256",
		...overrides,
	});
	return params.toString();
}

describe("GET /authorize", () => {
	test("redirects a fresh, unauthenticated request to /u/sign-in", async () => {
		let client = await createTestClient(harness.tenantDO);

		let response = await harness.router.fetch(
			harness.request(`/authorize?${authorizeQuery(client.id)}`),
		);

		expect(response.status).toBe(302);
		let location = new URL(response.headers.get("Location") ?? "");
		expect(location.pathname).toBe("/u/sign-in");
		expect(location.searchParams.get("interaction")).toBeTruthy();
	});

	test("renders /u/error inline, with no redirect, for an unregistered client", async () => {
		let response = await harness.router.fetch(
			harness.request(`/authorize?${authorizeQuery("no-such-client")}`),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Location")).toBeNull();

		let body = await response.text();
		expect(body).toContain("not registered");
	});

	test("renders /u/error inline, with no redirect, for an unregistered redirect_uri", async () => {
		let client = await createTestClient(harness.tenantDO);

		let response = await harness.router.fetch(
			harness.request(
				`/authorize?${authorizeQuery(client.id, { redirect_uri: "https://not-registered.example.com" })}`,
			),
		);

		expect(response.status).toBe(400);
		expect(response.headers.get("Location")).toBeNull();

		let body = await response.text();
		expect(body).toContain("redirect_uri");
	});
});
