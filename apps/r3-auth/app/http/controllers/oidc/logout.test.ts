/**
 * Router-level tests of the end-session endpoint: RP-initiated logout with and without
 * an `id_token_hint`, the interactive `POST` button, and post-logout redirect
 * validation.
 *
 * The fan-out is the point of this file. The recipient lists are derived from the very
 * session rows logout deletes, so the tests assert what the relying parties actually
 * received — a real back-channel `POST` per client, a real iframe URL per client, and
 * nothing at all for the client that started the logout.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import Client from "~/app/data/client";
import Session from "~/app/data/session";
import { createTestApp } from "~/app/lib/test/http";
import { authorizeUrl, ORIGIN, seed, signIn } from "~/app/lib/test/seed";
import routes from "~/routes/web";

/** Back-channel logout endpoint the second relying party registers. */
const OTHER_BACKCHANNEL = "https://other.example.com/backchannel-logout";

/** Front-channel logout endpoint the second relying party registers. */
const OTHER_FRONTCHANNEL = "https://other.example.com/frontchannel-logout";

/** Back-channel endpoint the *initiating* client registers, which must never be called. */
const SEEDED_BACKCHANNEL = "https://client.example.com/backchannel-logout";

/** Every `logout_token` a relying party received, in delivery order. */
let delivered: Array<{ url: string; token: string }> = [];

let server = setupServer(
	http.post(OTHER_BACKCHANNEL, async ({ request }) => {
		let body = new URLSearchParams(await request.text());
		delivered.push({ url: OTHER_BACKCHANNEL, token: body.get("logout_token") ?? "" });
		return new HttpResponse(null, { status: 200 });
	}),
	http.post(SEEDED_BACKCHANNEL, async ({ request }) => {
		let body = new URLSearchParams(await request.text());
		delivered.push({ url: SEEDED_BACKCHANNEL, token: body.get("logout_token") ?? "" });
		return new HttpResponse(null, { status: 200 });
	}),
);

let app: TestApp;
let fixtures: Fixtures;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
	app = await createTestApp();
	fixtures = await seed(app);
	delivered = [];
});

/** The URL of the end-session endpoint with the given parameters. */
function logoutUrl(params: Record<string, string> = {}): string {
	let url = new URL(routes.oidc.logout.index.href(), ORIGIN);
	for (let [key, value] of Object.entries(params)) url.searchParams.set(key, value);
	return url.toString();
}

/** Which logout channels a second relying party registers, and whether it wants `sid`. */
interface OtherClientOptions {
	backchannel?: boolean;
	frontchannel?: boolean;
	sessionRequired?: "true" | "false";
}

/**
 * Registers a second relying party with the requested logout channels, and opens a
 * session for the signed-in subject against it through the server's own SSO path.
 *
 * @returns The second client's id.
 */
async function registerOtherClient(options: OtherClientOptions = {}): Promise<string> {
	let backchannel = options.backchannel ?? true;
	let frontchannel = options.frontchannel ?? true;
	let sessionRequired = options.sessionRequired ?? "true";

	let other = await Client.create(app.db, {
		name: "Other App",
		redirect_uri: "https://other.example.com/callback",
		logout_uri: "https://other.example.com/logged-out",
	});

	await Client.update(app.db, other.id, {
		backchannel_logout_uri: backchannel ? OTHER_BACKCHANNEL : null,
		backchannel_logout_session_required: sessionRequired,
		frontchannel_logout_uri: frontchannel ? OTHER_FRONTCHANNEL : null,
		frontchannel_logout_session_required: sessionRequired,
	});

	// A real authorization request, so the session row is the one the flow creates.
	let url = new URL(authorizeUrl(fixtures));
	url.searchParams.set("client_id", other.id);
	url.searchParams.set("redirect_uri", "https://other.example.com/callback");

	let response = await app.fetch(new Request(url.toString(), { redirect: "manual" }));
	expect(response.status).toBe(303);

	return other.id;
}

describe("GET /oidc/logout", () => {
	test("renders the confirmation page when nobody is signed in", async () => {
		let response = await app.fetch(new Request(logoutUrl(), { redirect: "manual" }));

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");
		expect(await response.text()).toContain("Are you sure you want to logout?");
	});

	test("logs out from the session alone, with no id_token_hint", async () => {
		let tokens = await signIn(app, fixtures);
		expect(tokens.refresh_token).toBeDefined();

		let response = await app.fetch(new Request(logoutUrl(), { redirect: "manual" }));

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`${ORIGIN}${routes.authorize.index.href()}`);
		expect(response.headers.get("clear-site-data")).toBe('"*"');
		expect(await Session.findById(app.db, tokens.refresh_token)).toBeNull();
	});

	test("logs out with an id_token_hint and returns to the registered logout URI", async () => {
		let tokens = await signIn(app, fixtures);

		let response = await app.fetch(
			new Request(
				logoutUrl({
					id_token_hint: tokens.id_token,
					post_logout_redirect_uri: "https://client.example.com/logout",
					state: "correlation-1",
				}),
				{ redirect: "manual" },
			),
		);

		expect(response.status).toBe(303);

		let location = new URL(response.headers.get("location") ?? "");
		expect(location.origin + location.pathname).toBe("https://client.example.com/logout");
		expect(location.searchParams.get("state")).toBe("correlation-1");
		expect(await Session.findById(app.db, tokens.refresh_token)).toBeNull();
	});

	test("refuses a post_logout_redirect_uri the client never registered", async () => {
		let tokens = await signIn(app, fixtures);

		let response = await app.fetch(
			new Request(
				logoutUrl({
					id_token_hint: tokens.id_token,
					post_logout_redirect_uri: "https://malicious.example.com/steal",
				}),
				{ redirect: "manual" },
			),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: "invalid_request" });

		// Refused before anything was destroyed: the session is still usable.
		expect(await Session.findById(app.db, tokens.refresh_token)).not.toBeNull();
	});

	test("refuses a post_logout_redirect_uri when no client identifies the request", async () => {
		await signIn(app, fixtures);

		// No id_token_hint and no client_id, so nothing says this address was registered.
		let response = await app.fetch(
			new Request(logoutUrl({ post_logout_redirect_uri: "https://malicious.example.com/steal" }), {
				redirect: "manual",
			}),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: "invalid_request" });
	});

	test("refuses a client_id that contradicts the id_token_hint", async () => {
		let tokens = await signIn(app, fixtures);
		let other = await registerOtherClient();

		let response = await app.fetch(
			new Request(logoutUrl({ id_token_hint: tokens.id_token, client_id: other }), {
				redirect: "manual",
			}),
		);

		expect(response.status).toBe(400);
	});

	test("delivers a back-channel logout token to every other relying party", async () => {
		let tokens = await signIn(app, fixtures);

		// The initiating client registers a back-channel endpoint too, so "was it called"
		// is a real question rather than one the fixture answers by omission.
		await Client.update(app.db, fixtures.clientId, {
			backchannel_logout_uri: SEEDED_BACKCHANNEL,
			backchannel_logout_session_required: "true",
		});

		// Back channel only, so the response is the plain redirect and the delivery is
		// the only thing this test is looking at.
		let other = await registerOtherClient({ frontchannel: false });

		let response = await app.fetch(
			new Request(logoutUrl({ id_token_hint: tokens.id_token }), { redirect: "manual" }),
		);

		expect(response.status).toBe(303);

		// Exactly one delivery, and not to the client that asked for the logout.
		expect(delivered).toHaveLength(1);
		expect(delivered[0]?.url).toBe(OTHER_BACKCHANNEL);

		let claims = JSON.parse(
			Buffer.from(delivered[0]?.token.split(".")[1] ?? "", "base64url").toString(),
		) as Record<string, unknown>;

		expect(claims.sub).toBe(fixtures.subjectId);
		expect(claims.aud).toBe(other);
		expect(claims.sid).toBeString();
		expect(Object.keys(claims.events as object)).toEqual([
			"http://schemas.openid.net/event/backchannel-logout",
		]);
	});

	test("omits sid when the client did not ask for session-specific logout", async () => {
		let tokens = await signIn(app, fixtures);
		await registerOtherClient({ frontchannel: false, sessionRequired: "false" });

		await app.fetch(
			new Request(logoutUrl({ id_token_hint: tokens.id_token }), {
				redirect: "manual",
			}),
		);

		expect(delivered).toHaveLength(1);

		let claims = JSON.parse(
			Buffer.from(delivered[0]?.token.split(".")[1] ?? "", "base64url").toString(),
		) as Record<string, unknown>;

		expect(claims.sid).toBeUndefined();
	});

	test("renders the front-channel iframe page with a meta refresh", async () => {
		let tokens = await signIn(app, fixtures);
		let other = await registerOtherClient();

		let response = await app.fetch(
			new Request(
				logoutUrl({
					id_token_hint: tokens.id_token,
					post_logout_redirect_uri: "https://client.example.com/logout",
					state: "correlation-2",
				}),
				{ redirect: "manual" },
			),
		);

		expect(response.status).toBe(200);

		let html = await response.text();

		// One iframe for the other client, carrying the issuer and this session's id.
		expect(html).toContain(`${OTHER_FRONTCHANNEL}?iss=https%3A%2F%2Fauth.sergiodxa.com&amp;sid=`);
		expect(html).toContain(`title="${other}"`);

		// The follow-up navigation is markup, not script: no timer, no client JavaScript.
		expect(html).toContain('http-equiv="refresh"');
		expect(html).toContain("2;url=https://client.example.com/logout?state=correlation-2");
		expect(html).not.toContain("setTimeout");

		// And the manual way out for anything that ignores the refresh.
		expect(html).toContain("<noscript>");
		expect(html).toContain("Click here to continue");
	});

	test("does not collect a front-channel URL for the initiating client", async () => {
		let tokens = await signIn(app, fixtures);

		await Client.update(app.db, fixtures.clientId, {
			frontchannel_logout_uri: "https://client.example.com/frontchannel-logout",
			frontchannel_logout_session_required: "true",
		});

		let response = await app.fetch(
			new Request(logoutUrl({ id_token_hint: tokens.id_token }), { redirect: "manual" }),
		);

		// Nobody else to notify, so the page is skipped entirely and the browser leaves.
		expect(response.status).toBe(303);
	});

	test("keeps logging out when a relying party's back channel fails", async () => {
		let tokens = await signIn(app, fixtures);
		await registerOtherClient({ frontchannel: false });

		server.use(http.post(OTHER_BACKCHANNEL, () => new HttpResponse(null, { status: 500 })));

		let response = await app.fetch(
			new Request(logoutUrl({ id_token_hint: tokens.id_token }), { redirect: "manual" }),
		);

		expect(response.status).toBe(303);
		expect(await Session.findById(app.db, tokens.refresh_token)).toBeNull();
	});
});

describe("POST /oidc/logout", () => {
	test("signs the person out and returns them to the authorization endpoint", async () => {
		let tokens = await signIn(app, fixtures);
		await registerOtherClient({ frontchannel: false });

		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.oidc.logout.action.href()}`, {
				method: "POST",
				redirect: "manual",
			}),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.authorize.index.href());
		expect(response.headers.get("clear-site-data")).toBe('"*"');
		expect(await Session.findById(app.db, tokens.refresh_token)).toBeNull();

		// No client is excluded: this logout started here, so every relying party hears
		// about it, including the one whose session opened the browser session.
		expect(delivered.map((entry) => entry.url)).toEqual([OTHER_BACKCHANNEL]);
	});

	test("redirects without a session, and notifies nobody", async () => {
		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.oidc.logout.action.href()}`, {
				method: "POST",
				redirect: "manual",
			}),
		);

		expect(response.status).toBe(303);
		expect(delivered).toHaveLength(0);
	});
});
