/**
 * Router-level tests of the introspection endpoint, focused on the one answer RFC 7662
 * gives for a token this server cannot resolve: an inactive report, whatever the reason.
 * A fault in this server reads the same on the wire, so the log level is what separates
 * it from a token that is simply not live, and that is what these tests hold in place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "vitest";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import { createTestApp, withUnreadableSigningKeys } from "~/app/lib/test/http";
import { loggedEvents, withLogs } from "~/app/lib/test/logs";
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
		let [response, logs] = await withLogs(
			async () => await introspect({ token: "not-a-token", token_type_hint: "access_token" }),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ active: false });

		expect(loggedEvents(logs.info)).toContainEqual(
			expect.objectContaining({ level: "info", event: "introspect_success" }),
		);
	});

	/**
	 * A key store this endpoint cannot read leaves it unable to say anything about the
	 * token, and RFC 7662 has one shape for that, so the report stays inactive while the
	 * log names the fault at the level that pages — the token is not what went wrong.
	 */
	test("reports unreadable signing keys as inactive and logs the fault at error", async () => {
		let [response, logs] = await withLogs(
			async () =>
				await withUnreadableSigningKeys(
					app,
					async () => await introspect({ token: "any-token", token_type_hint: "access_token" }),
				),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ active: false });

		expect(loggedEvents(logs.error)).toContainEqual(
			expect.objectContaining({ level: "error", event: "introspect_server_error" }),
		);
	});
});
