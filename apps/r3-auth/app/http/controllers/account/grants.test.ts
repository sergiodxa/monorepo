/**
 * Router-level tests of the authorized-apps list and the withdrawal it offers: that the
 * withdrawal removes the consent *and* the sessions that consent produced, that this
 * server's own registration cannot be withdrawn from here, and that a forged client id
 * only ever reaches the signed-in subject's own rows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import { AUTH_SERVER_CLIENT_ID, AUTH_SERVER_NAME } from "~/app/config";
import { createTestApp } from "~/app/lib/test/http";
import { ORIGIN, seed, signIn } from "~/app/lib/test/seed";
import routes from "~/routes/web";

let app: TestApp;
let fixtures: Fixtures;

beforeEach(async () => {
	app = await createTestApp();
	fixtures = await seed(app);
});

/** Posts an intent to the grants page, returning the redirect response itself. */
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
		await app.models.grants.deleteBySubjectId(fixtures.subjectId);

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
		unwrap(await app.models.clients.ensureAuthServerClient(new URL(ORIGIN)));
		unwrap(await app.models.grants.findOrCreate(fixtures.subjectId, AUTH_SERVER_CLIENT_ID));

		let html = await (
			await app.fetch(new Request(`${ORIGIN}${routes.account.grants.index.href()}`))
		).text();

		expect(html).toContain(AUTH_SERVER_NAME);
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

		let grants = await app.models.grants.findBySubjectId(fixtures.subjectId);
		expect(grants).toHaveLength(0);
		expect(await app.models.sessions.find(tokens.refresh_token)).toBeNull();
	});

	test("refuses to withdraw this server's own registration", async () => {
		await signIn(app, fixtures);
		unwrap(await app.models.clients.ensureAuthServerClient(new URL(ORIGIN)));
		unwrap(await app.models.grants.findOrCreate(fixtures.subjectId, AUTH_SERVER_CLIENT_ID));

		let response = await post({ intent: "revoke", clientId: AUTH_SERVER_CLIENT_ID });

		expect(response.status).toBe(303);
		let grants = await app.models.grants.findBySubjectId(fixtures.subjectId);
		expect(grants.map((grant) => grant.client_id)).toContain(AUTH_SERVER_CLIENT_ID);
	});

	test("never withdraws another subject's consent for the same client", async () => {
		let bystander = unwrap(
			await app.models.subjects.create({
				email_address: "bystander@example.com",
				display_name: "Bystander",
				username: "bystander",
				avatar: "https://example.com/bystander.png",
			}),
		);
		unwrap(await app.models.grants.findOrCreate(bystander.id, fixtures.clientId));

		await signIn(app, fixtures);
		await post({ intent: "revoke", clientId: fixtures.clientId });

		let theirs = await app.models.grants.findBySubjectId(bystander.id);
		expect(theirs).toHaveLength(1);
	});

	test("accepts a client id with no consent behind it without erroring", async () => {
		await signIn(app, fixtures);

		let response = await post({
			intent: "revoke",
			clientId: "00000000-0000-4000-8000-000000000000",
		});

		expect(response.status).toBe(303);
		let grants = await app.models.grants.findBySubjectId(fixtures.subjectId);
		expect(grants).toHaveLength(1);
	});

	test("ignores a submission naming no intent it knows", async () => {
		await signIn(app, fixtures);

		let response = await post({ intent: "revoke-all", clientId: fixtures.clientId });

		expect(response.status).toBe(303);
		let grants = await app.models.grants.findBySubjectId(fixtures.subjectId);
		expect(grants).toHaveLength(1);
	});

	test("redirects an unauthenticated post without withdrawing anything", async () => {
		let response = await post({ intent: "revoke", clientId: fixtures.clientId });

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.authorize.index.href());
	});
});
