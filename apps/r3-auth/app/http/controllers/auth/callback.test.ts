/**
 * Router-level tests of this server's own OAuth callback: the whole self-login round
 * trip from a bare `/authorize` to a browser session, and the four refusals that keep
 * the callback from adopting a session it was not part of.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import { createTestApp } from "~/app/lib/test/http";
import { authorizeUrl, ORIGIN, seed, submitSignIn } from "~/app/lib/test/seed";
import routes from "~/routes/web";

let app: TestApp;
let fixtures: Fixtures;

/** Requests a URL without following the redirect it answers with. */
async function visit(url: string): Promise<Response> {
	return await app.fetch(new Request(url, { redirect: "manual" }));
}

/**
 * Runs the self-login flow up to the callback and returns the callback URL the sign-in
 * redirected to, which carries the code and the state to check.
 */
async function signInAsSelf(): Promise<string> {
	let selfRedirect = await visit(`${ORIGIN}${routes.authorize.index.href()}`);
	await visit(selfRedirect.headers.get("location")!);

	let login = await submitSignIn(app);
	let location = login.headers.get("location");
	if (!location) throw new Error(`Sign-in did not redirect, got ${login.status}`);

	return location;
}

beforeEach(async () => {
	app = await createTestApp();
	fixtures = await seed(app);
});

describe("GET /auth/callback", () => {
	test("exchanges the code and leaves the browser signed in to this server", async () => {
		let callback = await signInAsSelf();

		expect(new URL(callback).pathname).toBe(routes.auth.callback.href());

		let response = await visit(callback);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.account.sessions.index.href());

		// Proof the tokens landed in the session rather than just a redirect happening:
		// a bare `/authorize` now recognizes the visitor instead of starting a new flow.
		let afterwards = await visit(`${ORIGIN}${routes.authorize.index.href()}`);
		expect(afterwards.headers.get("location")).toBe(routes.account.sessions.index.href());
	});

	test("refuses a callback with no code or state", async () => {
		await signInAsSelf();

		let response = await visit(`${ORIGIN}${routes.auth.callback.href()}`);

		expect(response.status).toBe(400);
	});

	test("refuses a state that does not match the parked request", async () => {
		let callback = new URL(await signInAsSelf());
		callback.searchParams.set("state", "not-the-parked-state");

		let response = await visit(callback.toString());

		expect(response.status).toBe(400);
	});

	test("refuses a code issued for a relying party rather than for this server", async () => {
		// A relying party's request is parked, so the callback is reached with a session
		// whose authorization request belongs to somebody else.
		await visit(authorizeUrl(fixtures));

		let url = new URL(routes.auth.callback.href(), ORIGIN);
		url.searchParams.set("code", "some-code");
		url.searchParams.set("state", "state-123");

		let response = await visit(url.toString());

		expect(response.status).toBe(400);
	});

	test("refuses a callback with no authorization request parked at all", async () => {
		let url = new URL(routes.auth.callback.href(), ORIGIN);
		url.searchParams.set("code", "some-code");
		url.searchParams.set("state", "some-state");

		let response = await visit(url.toString());

		expect(response.status).toBe(400);
	});
});
