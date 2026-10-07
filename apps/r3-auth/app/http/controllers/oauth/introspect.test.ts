/**
 * Router-level tests of the introspection endpoint, focused on the one answer RFC 7662 gives
 * for a token the caller may not learn about: an inactive report, whether the token is
 * unknown, another client's, or unresolvable through a fault the record outcome tells apart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "vitest";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import Client from "~/app/data/client";
import { createTestApp, withUnreadableSigningKeys } from "~/app/lib/test/http";
import { withLog } from "~/app/lib/test/logs";
import { ORIGIN, seed, signIn } from "~/app/lib/test/seed";
import routes from "~/routes/web";

let app: TestApp;
let fixtures: Fixtures;

/**
 * Introspects a token, authenticating over HTTP Basic as the seeded client unless another
 * client's credentials are given.
 */
async function introspect(
	body: Record<string, string>,
	clientId = fixtures.clientId,
	clientSecret = fixtures.clientSecret,
): Promise<Response> {
	return await app.fetch(
		new Request(`${ORIGIN}${routes.oauth.introspect.href()}`, {
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
			},
			body: new URLSearchParams(body),
		}),
	);
}

/** Registers a second relying party, a client the seeded tokens were never issued to. */
async function createOtherClient() {
	return await Client.create(app.db, {
		name: "Other App",
		redirect_uri: "https://other.example.com/callback",
		logout_uri: "https://other.example.com/logout",
	});
}

beforeEach(async () => {
	app = await createTestApp();
	fixtures = await seed(app);
});

describe("POST /oauth/introspect", () => {
	test("reports a token it has never issued as inactive", async () => {
		let [response, record] = await withLog(
			async () => await introspect({ token: "not-a-token", token_type_hint: "access_token" }),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ active: false });

		expect(record).toMatchObject({
			outcome: "ok",
			"client.id": fixtures.clientId,
			"oidc.token_active": false,
		});
	});

	test("reports the caller's own refresh and access tokens as active", async () => {
		let tokens = await signIn(app, fixtures);

		let refresh = await introspect({ token: tokens.refresh_token });
		expect(await refresh.json()).toMatchObject({ active: true, client_id: fixtures.clientId });

		let access = await introspect({ token: tokens.access_token, token_type_hint: "access_token" });
		expect(await access.json()).toMatchObject({ active: true, client_id: fixtures.clientId });
	});

	/**
	 * Another registered client authenticates successfully and still learns nothing: the
	 * answer is the one a token that was never issued gets, so it cannot scan for live ones.
	 */
	test("reports another client's tokens as inactive", async () => {
		let tokens = await signIn(app, fixtures);
		let other = await createOtherClient();

		let refresh = await introspect({ token: tokens.refresh_token }, other.id, other.secret);
		expect(refresh.status).toBe(200);
		expect(await refresh.json()).toEqual({ active: false });

		let access = await introspect(
			{ token: tokens.access_token, token_type_hint: "access_token" },
			other.id,
			other.secret,
		);
		expect(access.status).toBe(200);
		expect(await access.json()).toEqual({ active: false });
	});

	/**
	 * RFC 7662 has one shape for an answer this endpoint cannot give, so an unreadable key
	 * store still reports inactive while the record fails with the fault, the outcome that pages.
	 */
	test("reports unreadable signing keys as inactive and fails the record", async () => {
		let [response, record] = await withLog(
			async () =>
				await withUnreadableSigningKeys(
					app,
					async () => await introspect({ token: "any-token", token_type_hint: "access_token" }),
				),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ active: false });

		expect(record).toMatchObject({ outcome: "error", "error.type": "InternalServerError" });
	});
});
