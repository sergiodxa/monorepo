/**
 * Router-level tests of the authorized-apps list and the withdrawal it offers: that the
 * withdrawal removes the consent *and* the sessions that consent produced, that this
 * server's own registration cannot be withdrawn from here, and that a forged client id
 * only ever reaches the signed-in subject's own rows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "vitest";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import { AUTH_SERVER_CLIENT_ID, AUTH_SERVER_NAME } from "~/app/config";
import Client from "~/app/data/client";
import Grant from "~/app/data/grant";
import Session from "~/app/data/session";
import Subject from "~/app/data/subject";
import { createTestApp } from "~/app/lib/test/http";
import { ORIGIN, seed, signIn } from "~/app/lib/test/seed";
import routes from "~/routes/web";

let app: TestApp;
let fixtures: Fixtures;

beforeEach(async () => {
	app = await createTestApp();
	fixtures = await seed(app);
});

/** Posts an intent to the grants page without following the redirect. */
async function post(fields: Record<string, string>): Promise<Response> {
	return await app.fetch(
		new Request(`${ORIGIN}${routes.account.grants.action.href()}`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			redirect: "manual",
			body: new URLSearchParams(fields),
		}),
	);
}

describe("GET /account/grants", () => {
	test("redirects a request with no session to /authorize", async () => {
		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.account.grants.index.href()}`, { redirect: "manual" }),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.authorize.index.href());
	});

	test("says so when nothing has been authorized", async () => {
		await signIn(app, fixtures);
		await Grant.deleteBySubjectId(app.db, fixtures.subjectId);

		let html = await (
			await app.fetch(new Request(`${ORIGIN}${routes.account.grants.index.href()}`))
		).text();

		expect(html).toContain("No authorized apps found.");
	});

	test("names the client, its description, and offers a revoke control", async () => {
		await signIn(app, fixtures);

		let response = await app.fetch(new Request(`${ORIGIN}${routes.account.grants.index.href()}`));
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain("Client App");
		expect(html).toContain("A relying party");
		expect(html).toContain(`value="${fixtures.clientId}"`);
		expect(html).toContain('command="show-modal"');
	});

	test("lists this server's own registration without a revoke control", async () => {
		await signIn(app, fixtures);
		await Client.ensureAuthServerClient(app.db, new URL(ORIGIN));
		await Grant.findOrCreate(app.db, fixtures.subjectId, AUTH_SERVER_CLIENT_ID);

		let html = await (
			await app.fetch(new Request(`${ORIGIN}${routes.account.grants.index.href()}`))
		).text();

		expect(html).toContain(AUTH_SERVER_NAME);
		// The label that stands in for the control it deliberately does not render.
		expect(html).toContain("Required");
		expect(html).not.toContain(`value="${AUTH_SERVER_CLIENT_ID}"`);
	});
});

describe("POST /account/grants intent=revoke", () => {
	test("removes the consent and the sessions it produced", async () => {
		let tokens = await signIn(app, fixtures);

		let response = await post({ intent: "revoke", clientId: fixtures.clientId });

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.account.grants.index.href());

		let grants = await Grant.findBySubjectId(app.db, fixtures.subjectId);
		expect(grants).toHaveLength(0);
		expect(await Session.findById(app.db, tokens.refresh_token)).toBeNull();
	});

	test("refuses to withdraw this server's own registration", async () => {
		await signIn(app, fixtures);
		await Client.ensureAuthServerClient(app.db, new URL(ORIGIN));
		await Grant.findOrCreate(app.db, fixtures.subjectId, AUTH_SERVER_CLIENT_ID);

		let response = await post({ intent: "revoke", clientId: AUTH_SERVER_CLIENT_ID });

		expect(response.status).toBe(303);
		let grants = await Grant.findBySubjectId(app.db, fixtures.subjectId);
		expect(grants.map((grant) => grant.client_id)).toContain(AUTH_SERVER_CLIENT_ID);
	});

	test("never withdraws another subject's consent for the same client", async () => {
		let bystander = await Subject.create(app.db, {
			email_address: "bystander@example.com",
			display_name: "Bystander",
			username: "bystander",
			avatar: "https://example.com/bystander.png",
		});
		await Grant.findOrCreate(app.db, bystander.id, fixtures.clientId);

		await signIn(app, fixtures);
		await post({ intent: "revoke", clientId: fixtures.clientId });

		let theirs = await Grant.findBySubjectId(app.db, bystander.id);
		expect(theirs).toHaveLength(1);
	});

	test("accepts a client id with no consent behind it without erroring", async () => {
		await signIn(app, fixtures);

		let response = await post({
			intent: "revoke",
			clientId: "00000000-0000-4000-8000-000000000000",
		});

		expect(response.status).toBe(303);
		let grants = await Grant.findBySubjectId(app.db, fixtures.subjectId);
		expect(grants).toHaveLength(1);
	});

	test("ignores a submission naming no intent it knows", async () => {
		await signIn(app, fixtures);

		let response = await post({ intent: "revoke-all", clientId: fixtures.clientId });

		expect(response.status).toBe(303);
		let grants = await Grant.findBySubjectId(app.db, fixtures.subjectId);
		expect(grants).toHaveLength(1);
	});

	test("redirects an unauthenticated post without withdrawing anything", async () => {
		let response = await post({ intent: "revoke", clientId: fixtures.clientId });

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.authorize.index.href());
	});
});
