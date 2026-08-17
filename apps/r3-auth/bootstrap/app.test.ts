/**
 * Tests of the composition root itself: the cross-origin protection bypass list, the
 * rate limiters each protected endpoint spends from, and the small routes that have no
 * controller test of their own.
 *
 * The bypass tests are the important ones. `/oauth/*`, `/api/*` and `/oidc/logout`
 * receive cross-origin `POST`s from relying parties by design, and cross-origin
 * protection blocking one of them does not fail loudly — it fails as every client's
 * login breaking at once. One test per bypassed path, plus one proving the protection
 * is still on everywhere else.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "vitest";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import { createTestApp } from "~/app/lib/test/http";
import { authorizeUrl, ORIGIN, seed, signIn } from "~/app/lib/test/seed";
import routes from "~/routes/web";

/** The body a rate-limited request is refused with, frozen because clients parse it. */
const LIMITED_BODY = {
	error: "too_many_requests",
	error_description: "Rate limit exceeded. Please try again later.",
};

let app: TestApp;
let fixtures: Fixtures;

/**
 * A cross-origin browser `POST`, carrying exactly what a real one carries: the
 * `Sec-Fetch-Site` and `Origin` headers cross-origin protection decides on.
 */
function crossOriginPost(path: string, body: Record<string, string> = { field: "value" }): Request {
	return new Request(`${ORIGIN}${path}`, {
		method: "POST",
		headers: {
			"content-type": "application/x-www-form-urlencoded",
			"sec-fetch-site": "cross-site",
			origin: "https://client.example.com",
		},
		body: new URLSearchParams(body),
	});
}

beforeEach(async () => {
	app = await createTestApp();
	fixtures = await seed(app);
});

describe("cross-origin protection", () => {
	test("blocks a cross-origin POST to a browser form", async () => {
		let response = await app.fetch(crossOriginPost(routes.authorize.action.href()));

		expect(response.status).toBe(403);
	});

	test("lets a cross-origin POST through to /oauth/token", async () => {
		let response = await app.fetch(
			crossOriginPost(routes.oauth.token.href(), {
				grant_type: "client_credentials",
				client_id: fixtures.clientId,
				client_secret: fixtures.clientSecret,
			}),
		);

		expect(response.status).toBe(200);
	});

	test("lets a cross-origin POST through to /oauth/revoke", async () => {
		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.oauth.revoke.href()}`, {
				method: "POST",
				headers: {
					"content-type": "application/x-www-form-urlencoded",
					"sec-fetch-site": "cross-site",
					origin: "https://client.example.com",
					Authorization: `Basic ${btoa(`${fixtures.clientId}:${fixtures.clientSecret}`)}`,
				},
				body: new URLSearchParams({ token: "anything" }),
			}),
		);

		expect(response.status).toBe(200);
	});

	test("lets a cross-origin POST through to /oauth/introspect", async () => {
		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.oauth.introspect.href()}`, {
				method: "POST",
				headers: {
					"content-type": "application/x-www-form-urlencoded",
					"sec-fetch-site": "cross-site",
					origin: "https://client.example.com",
					Authorization: `Basic ${btoa(`${fixtures.clientId}:${fixtures.clientSecret}`)}`,
				},
				body: new URLSearchParams({ token: "anything" }),
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ active: false });
	});

	test("lets a cross-origin POST through to /api/*", async () => {
		// No controller is mapped there yet, so reaching the router's 404 is exactly the
		// proof wanted: the request was not refused at the protection boundary.
		let response = await app.fetch(crossOriginPost("/api/subjects/whoever"));

		expect(response.status).toBe(404);
	});

	test("lets a cross-origin POST through to /oidc/logout", async () => {
		// The end-session endpoint answers with its redirect rather than a refusal, which
		// is what proves the request reached it instead of stopping at the boundary.
		let response = await app.fetch(crossOriginPost(routes.oidc.logout.action.href()));

		expect(response.status).toBe(303);
	});

	test("does not bypass a path that merely starts like a bypassed one", async () => {
		let response = await app.fetch(crossOriginPost("/oidc/logout-everywhere"));

		expect(response.status).toBe(403);
	});
});

describe("rate limiting", () => {
	test("the authorize limiter refuses with the published body and Retry-After", async () => {
		app = await createTestApp({ limits: { authorize: 1 } });
		fixtures = await seed(app);

		// A real authorization request, because that is what the budget is spent by: a probe
		// carrying no request at all never reaches the lookup this limiter protects.
		await app.fetch(new Request(authorizeUrl(fixtures)));
		let response = await app.fetch(new Request(authorizeUrl(fixtures)));

		expect(response.status).toBe(429);
		expect(response.headers.get("retry-after")).toBe("60");
		expect(await response.json()).toEqual(LIMITED_BODY);
	});

	test("the login limiter refuses a flood of sign-in attempts", async () => {
		app = await createTestApp({ limits: { login: 1 } });
		fixtures = await seed(app);

		await app.fetch(
			new Request(`${ORIGIN}${routes.authorize.action.href()}`, {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({ email: "a@b.co", password: "x", name: "a", username: "a" }),
			}),
		);

		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.authorize.action.href()}`, {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({ email: "a@b.co", password: "x", name: "a", username: "a" }),
			}),
		);

		expect(response.status).toBe(429);
		expect(await response.json()).toEqual(LIMITED_BODY);
	});

	test("the token limiter refuses once a client has spent its budget", async () => {
		app = await createTestApp({ limits: { token: 1 } });
		fixtures = await seed(app);

		let body = {
			grant_type: "client_credentials",
			client_id: fixtures.clientId,
			client_secret: fixtures.clientSecret,
		};

		await app.fetch(crossOriginPost(routes.oauth.token.href(), body));
		let response = await app.fetch(crossOriginPost(routes.oauth.token.href(), body));

		expect(response.status).toBe(429);
		expect(response.headers.get("retry-after")).toBe("60");
		expect(await response.json()).toEqual(LIMITED_BODY);
	});

	test("the revoke limiter refuses once a client has spent its budget", async () => {
		app = await createTestApp({ limits: { revoke: 1 } });
		fixtures = await seed(app);

		let request = () =>
			new Request(`${ORIGIN}${routes.oauth.revoke.href()}`, {
				method: "POST",
				headers: {
					"content-type": "application/x-www-form-urlencoded",
					Authorization: `Basic ${btoa(`${fixtures.clientId}:${fixtures.clientSecret}`)}`,
				},
				body: new URLSearchParams({ token: "anything" }),
			});

		await app.fetch(request());
		let response = await app.fetch(request());

		expect(response.status).toBe(429);
		expect(await response.json()).toEqual(LIMITED_BODY);
	});

	test("the introspect limiter refuses once a client has spent its budget", async () => {
		app = await createTestApp({ limits: { introspect: 1 } });
		fixtures = await seed(app);

		let request = () =>
			new Request(`${ORIGIN}${routes.oauth.introspect.href()}`, {
				method: "POST",
				headers: {
					"content-type": "application/x-www-form-urlencoded",
					Authorization: `Basic ${btoa(`${fixtures.clientId}:${fixtures.clientSecret}`)}`,
				},
				body: new URLSearchParams({ token: "anything" }),
			});

		await app.fetch(request());
		let response = await app.fetch(request());

		expect(response.status).toBe(429);
		expect(await response.json()).toEqual(LIMITED_BODY);
	});
});

describe("the remaining routes", () => {
	test("GET / redirects to /authorize", async () => {
		let response = await app.fetch(new Request(`${ORIGIN}/`, { redirect: "manual" }));

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.authorize.index.href());
	});

	test("GET /healthcheck answers OK when both dependencies answer", async () => {
		let response = await app.fetch(new Request(`${ORIGIN}${routes.healthcheck.href()}`));

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("OK");
	});

	test("an unknown path renders the localized 404 document", async () => {
		let response = await app.fetch(new Request(`${ORIGIN}/nowhere-at-all`));

		expect(response.status).toBe(404);
		expect(response.headers.get("content-type")).toContain("text/html");

		let body = await response.text();
		expect(body).toContain("Not Found");
		expect(body).toContain("The page you are looking for does not exist.");
	});

	test("an HTML document starts with the doctype, so the page parses in standards mode", async () => {
		let response = await app.fetch(new Request(`${ORIGIN}/nowhere-at-all`));
		let body = await response.text();

		// The doctype is not part of the JSX tree — the renderer prepends it to the
		// response body — so only a test that reads the whole response can see it.
		expect(body.startsWith("<!DOCTYPE html>")).toBe(true);
		expect(body.indexOf("<html")).toBe("<!DOCTYPE html>".length);
	});

	test("a signed-in session survives across requests", async () => {
		await signIn(app, fixtures);

		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.authorize.index.href()}`, { redirect: "manual" }),
		);

		expect(response.headers.get("location")).toBe(routes.account.sessions.index.href());
	});
});

describe("HEAD requests", () => {
	test("answers a HEAD with the GET's status and headers and no body", async () => {
		let path = `${ORIGIN}${routes.healthcheck.href()}`;

		let get = await app.fetch(new Request(path));
		let head = await app.fetch(new Request(path, { method: "HEAD" }));

		expect(head.status).toBe(get.status);
		expect(head.headers.get("content-type")).toBe(get.headers.get("content-type"));
		expect(await head.text()).toBe("");
	});

	test("still 404s a HEAD to a path whose route has no GET", async () => {
		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.account.verifyEmailResend.href()}`, { method: "HEAD" }),
		);

		expect(response.status).toBe(404);
	});

	test("does not let a HEAD past the session guard", async () => {
		let path = `${ORIGIN}${routes.account.profile.href()}`;

		let get = await app.fetch(new Request(path, { redirect: "manual" }));
		let head = await app.fetch(new Request(path, { method: "HEAD", redirect: "manual" }));

		expect(get.status).not.toBe(200);
		expect(head.status).toBe(get.status);
		expect(head.headers.get("location")).toBe(get.headers.get("location"));
	});
});
