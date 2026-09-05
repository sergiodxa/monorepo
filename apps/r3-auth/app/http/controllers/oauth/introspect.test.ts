/**
 * Router-level tests of the introspection endpoint, focused on the one answer RFC 7662 gives
 * for a token this server fails to resolve: an inactive report, whatever the reason. A fault
 * here reads the same on the wire, so these tests hold the record outcome that separates them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "vitest";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import { createTestApp, withUnreadableSigningKeys } from "~/app/lib/test/http";
import { withLog } from "~/app/lib/test/logs";
import { ORIGIN, seed } from "~/app/lib/test/seed";
import routes from "~/routes/web";

let app: TestApp;
let fixtures: Fixtures;

/** Introspects a token as the seeded client, authenticating over HTTP Basic. */
async function introspect(body: Record<string, string>): Promise<Response> {
	return await app.fetch(
		new Request(`${ORIGIN}${routes.oauth.introspect.href()}`, {
			method: "POST",
			headers: {
				"content-type": "application/x-www-form-urlencoded",
				Authorization: `Basic ${btoa(`${fixtures.clientId}:${fixtures.clientSecret}`)}`,
			},
			body: new URLSearchParams(body),
		}),
	);
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
