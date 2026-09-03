/**
 * Router-level tests of the end-session endpoint: RP-initiated logout with and
 * without an `id_token_hint`, the interactive `POST` button, and post-logout
 * redirect validation. The fan-out is the point: recipient lists derive from
 * the session rows logout deletes, so tests assert what relying parties
 * actually received.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { JWK, JWT } from "@sdxc/jwt";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import Client from "~/app/data/client";
import Session from "~/app/data/session";
import { createTestApp } from "~/app/lib/test/http";
import { authorizeUrl, ORIGIN, seed, signIn } from "~/app/lib/test/seed";
import routes from "~/routes/web";

const OTHER_BACKCHANNEL = "https://other.example.com/backchannel-logout";

const OTHER_FRONTCHANNEL = "https://other.example.com/frontchannel-logout";

/** Back-channel endpoint the initiating client registers, used to confirm delivery excludes it. */
const SEEDED_BACKCHANNEL = "https://client.example.com/backchannel-logout";

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

function logoutUrl(params: Record<string, string> = {}): string {
	let url = new URL(routes.oidc.logout.index.href(), ORIGIN);
	for (let [key, value] of Object.entries(params)) url.searchParams.set(key, value);
	return url.toString();
}

/**
 * Re-issues an ID token with some claims replaced, so a test can hand the endpoint
 * a hint that differs from a real one in exactly one way. The signing key is
 * imported at call time since each test swaps its `cloudflare:workers` bindings.
 *
 * @param token - A signed token to take the claims from.
 * @param claims - Claims to overwrite, such as an `exp` already in the past.
 * @param keys - Keys to sign with. Defaults to this server's own, so only the claims differ.
 * @returns The re-signed compact token.
 */
async function resign(
	token: string,
	claims: Record<string, unknown>,
	keys?: JWK.KeyPair[],
): Promise<string> {
	let { getSigningKey } = await import("~/app/services/signing-keys");
	let { payload } = JWT.decode(token);

	return await new JWT({ ...payload, ...claims }).sign(
		JWK.Algorithm.ES256,
		keys ?? (await getSigningKey()),
	);
}

interface OtherClientOptions {
	backchannel?: boolean;
	frontchannel?: boolean;
	sessionRequired?: "true" | "false";
}

/**
 * Registers a second relying party with the requested logout channels, and opens a
 * session for the signed-in subject through the server's own SSO path, so the session
 * row is the one a real authorization request creates.
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

	test("logs out with an expired id_token_hint instead of failing", async () => {
		let tokens = await signIn(app, fixtures);

		let expiredAt = Math.floor(Date.now() / 1000) - 60 * 60;
		let expired = await resign(tokens.id_token, { iat: expiredAt - 60, exp: expiredAt });

		let response = await app.fetch(
			new Request(logoutUrl({ id_token_hint: expired }), { redirect: "manual" }),
		);

		expect(response.status).toBe(303);
		expect(await Session.findById(app.db, tokens.refresh_token)).toBeNull();
	});

	test("refuses an id_token_hint this server did not sign with a 400", async () => {
		let tokens = await signIn(app, fixtures);

		let foreign = await resign(tokens.id_token, {}, [
			await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256)),
		]);

		let response = await app.fetch(
			new Request(logoutUrl({ id_token_hint: foreign }), { redirect: "manual" }),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: "invalid_request" });
		expect(await Session.findById(app.db, tokens.refresh_token)).not.toBeNull();
	});

	test("refuses a malformed id_token_hint with a 400", async () => {
		let tokens = await signIn(app, fixtures);

		let response = await app.fetch(
			new Request(logoutUrl({ id_token_hint: "not-a-jwt" }), { redirect: "manual" }),
		);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ error: "invalid_request" });
		expect(await Session.findById(app.db, tokens.refresh_token)).not.toBeNull();
	});

	test("honors a registered post_logout_redirect_uri with no hint and no client_id", async () => {
		let tokens = await signIn(app, fixtures);

		let response = await app.fetch(
			new Request(
				logoutUrl({
					post_logout_redirect_uri: "https://client.example.com/logout",
					state: "correlation-3",
				}),
				{ redirect: "manual" },
			),
		);

		expect(response.status).toBe(303);

		let location = new URL(response.headers.get("location") ?? "");
		expect(location.origin + location.pathname).toBe("https://client.example.com/logout");
		expect(location.searchParams.get("state")).toBe("correlation-3");
		expect(response.headers.get("clear-site-data")).toBe('"*"');
		expect(await Session.findById(app.db, tokens.refresh_token)).toBeNull();
	});

	test("signs out and stays on this server when the post_logout_redirect_uri is unregistered", async () => {
		let tokens = await signIn(app, fixtures);

		let response = await app.fetch(
			new Request(logoutUrl({ post_logout_redirect_uri: "https://malicious.example.com/steal" }), {
				redirect: "manual",
			}),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`${ORIGIN}${routes.authorize.index.href()}`);
		expect(response.headers.get("location")).not.toContain("malicious.example.com");
		expect(response.headers.get("clear-site-data")).toBe('"*"');
		expect(await Session.findById(app.db, tokens.refresh_token)).toBeNull();
	});

	test("ignores an unregistered post_logout_redirect_uri sent alongside a hint", async () => {
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

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`${ORIGIN}${routes.authorize.index.href()}`);
		expect(response.headers.get("location")).not.toContain("malicious.example.com");
		expect(await Session.findById(app.db, tokens.refresh_token)).toBeNull();
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

		await Client.update(app.db, fixtures.clientId, {
			backchannel_logout_uri: SEEDED_BACKCHANNEL,
			backchannel_logout_session_required: "true",
		});

		let other = await registerOtherClient({ frontchannel: false });

		let response = await app.fetch(
			new Request(logoutUrl({ id_token_hint: tokens.id_token }), { redirect: "manual" }),
		);

		expect(response.status).toBe(303);

		expect(delivered).toHaveLength(1);
		expect(delivered[0]?.url).toBe(OTHER_BACKCHANNEL);

		let claims = JSON.parse(
			Buffer.from(delivered[0]?.token.split(".")[1] ?? "", "base64url").toString(),
		) as Record<string, unknown>;

		expect(claims.sub).toBe(fixtures.subjectId);
		expect(claims.aud).toBe(other);
		expect(claims.sid).toBeTypeOf("string");
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

		expect(html).toContain(`${OTHER_FRONTCHANNEL}?iss=https%3A%2F%2Fauth.sergiodxa.com&amp;sid=`);
		expect(html).toContain(`title="${other}"`);

		expect(html).toContain('http-equiv="refresh"');
		expect(html).toContain("2;url=https://client.example.com/logout?state=correlation-2");
		expect(html).not.toContain("setTimeout");

		expect(html).toContain("<noscript>");
		expect(html).toContain("Click here to continue");
	});

	test("the front-channel page composes the styled document and still ships no script", async () => {
		let tokens = await signIn(app, fixtures);
		await registerOtherClient();

		let response = await app.fetch(
			new Request(
				logoutUrl({
					id_token_hint: tokens.id_token,
					post_logout_redirect_uri: "https://client.example.com/logout",
				}),
				{ redirect: "manual" },
			),
		);

		let html = await response.text();

		expect(html).not.toContain("<script");
		expect(html).not.toContain("modulepreload");

		expect(html).toContain("--ui-color-brand-600");
		expect(html).toContain('class="system ');
		expect(html).toContain('rel="stylesheet"');
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
