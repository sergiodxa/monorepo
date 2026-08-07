/**
 * Router-level tests of GitHub sign-in: the redirect that starts it, the first sign-in
 * that provisions a subject, connection and billing customer, the returning sign-in
 * that reuses them, the rollback when provisioning fails part way, and the errors that
 * are reported back to the relying party rather than rendered here.
 *
 * GitHub is intercepted with MSW, so what is under test is the real request the
 * provider makes — token exchange, profile fetch — and not a stand-in for it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import type { Customer as PolarCustomer, PolarClient } from "@pkg/polar";

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import { createTestApp } from "~/app/lib/test/http";
import { authorizeUrl, ORIGIN, REDIRECT_URI, seed } from "~/app/lib/test/seed";
import { connections, subjects } from "~/database/schema";
import routes from "~/routes/web";

/** GitHub's OAuth and REST endpoints, intercepted for every test in this file. */
const TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";
const USER_ENDPOINT = "https://api.github.com/user";
const EMAILS_ENDPOINT = "https://api.github.com/user/emails";

/** The identity GitHub authenticates in these tests. */
const GITHUB_PROFILE = {
	id: 4242,
	node_id: "MDQ6VXNlcjQyNDI=",
	login: "octo-jane",
	name: "Octo Jane",
	email: "octo-jane@example.com",
	avatar_url: "https://avatars.example.com/octo-jane.png",
};

let server = setupServer();

/** Answers the token exchange and the profile fetch with {@link GITHUB_PROFILE}. */
function respondWithProfile(profile: Record<string, unknown> = GITHUB_PROFILE) {
	server.use(
		http.post(TOKEN_ENDPOINT, () =>
			HttpResponse.json({ access_token: "gho_test", token_type: "bearer" }),
		),
		http.get(USER_ENDPOINT, () => HttpResponse.json(profile)),
		http.get(EMAILS_ENDPOINT, () =>
			HttpResponse.json([{ email: GITHUB_PROFILE.email, primary: true, verified: true }]),
		),
	);
}

/** A billing client whose customer creation always fails, for the rollback test. */
function failingPolarClient(): PolarClient {
	let fake: Pick<PolarClient, "createCustomer" | "findCustomerByEmail" | "updateCustomer"> = {
		async createCustomer(): Promise<PolarCustomer> {
			throw new Error("polar is unavailable");
		},
		async findCustomerByEmail() {
			return null;
		},
		async updateCustomer(): Promise<PolarCustomer> {
			throw new Error("polar is unavailable");
		},
	};

	return fake as unknown as PolarClient;
}

let app: TestApp;
let fixtures: Fixtures;

/**
 * Parks an authorization request and starts the GitHub flow.
 *
 * @param extra - Parameters to add to the authorization request, such as `response_mode`.
 * @returns The `state` GitHub is expected to hand back on the callback.
 */
async function startFlow(extra: Record<string, string> = {}): Promise<string> {
	await app.fetch(new Request(authorizeUrl(fixtures, extra)));

	let response = await app.fetch(
		new Request(`${ORIGIN}${routes.auth.provider.href({ provider: "github" })}`, {
			method: "POST",
			redirect: "manual",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: "",
		}),
	);

	let location = response.headers.get("location");
	if (!location) throw new Error(`Expected a redirect to GitHub, got ${response.status}`);

	let state = new URL(location).searchParams.get("state");
	if (!state) throw new Error("The provider redirect carried no state");

	return state;
}

/** Completes the GitHub callback with the given query parameters. */
async function finishFlow(params: Record<string, string>): Promise<Response> {
	let url = new URL(routes.auth.providerCallback.href({ provider: "github" }), ORIGIN);
	for (let [key, value] of Object.entries(params)) url.searchParams.set(key, value);

	return await app.fetch(new Request(url, { redirect: "manual" }));
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
	app = await createTestApp();
	fixtures = await seed(app);
});

describe("POST /auth/:provider", () => {
	test("redirects to GitHub with the registered callback and a PKCE challenge", async () => {
		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.auth.provider.href({ provider: "github" })}`, {
				method: "POST",
				redirect: "manual",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: "",
			}),
		);

		let location = new URL(response.headers.get("location")!);

		expect(location.origin + location.pathname).toBe("https://github.com/login/oauth/authorize");
		expect(location.searchParams.get("client_id")).toBe("test-github-client-id");
		expect(location.searchParams.get("redirect_uri")).toBe(
			`${ORIGIN}${routes.auth.providerCallback.href({ provider: "github" })}`,
		);
		expect(location.searchParams.get("scope")).toBe("read:user user:email");
		expect(location.searchParams.get("state")).toBeTruthy();
		expect(location.searchParams.get("code_challenge_method")).toBe("S256");
	});

	test("sends an unknown provider back to the authorization endpoint", async () => {
		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.auth.provider.href({ provider: "gitlab" })}`, {
				method: "POST",
				redirect: "manual",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: "",
			}),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.authorize.index.href());
	});
});

describe("GET /auth/:provider/callback", () => {
	test("provisions the subject, the connection and the customer on a first sign-in", async () => {
		respondWithProfile();
		let state = await startFlow();

		let response = await finishFlow({ code: "gh-code", state });

		expect(response.status).toBe(303);

		let location = new URL(response.headers.get("location")!);
		expect(`${location.origin}${location.pathname}`).toBe(REDIRECT_URI);
		expect(location.searchParams.get("code")).toBeTruthy();
		expect(location.searchParams.get("state")).toBe("state-123");
		expect(location.searchParams.get("session_state")).toBeTruthy();

		let subject = await app.db.findOne(subjects, {
			where: { email_address: GITHUB_PROFILE.email },
		});
		expect(subject?.username).toBe(GITHUB_PROFILE.login);
		expect(subject?.display_name).toBe(GITHUB_PROFILE.name);
		expect(subject?.avatar).toBe(GITHUB_PROFILE.avatar_url);
		// GitHub only releases an address it has verified, so the subject starts verified.
		expect(subject?.email_verified_at).not.toBeNull();

		// The node id, not the numeric one: it is the identifier every connection this
		// database already holds was written under.
		let connection = await app.db.findOne(connections, {
			where: { provider: "github", external_id: GITHUB_PROFILE.node_id },
		});
		expect(connection?.subject_id).toBe(subject!.id);
	});

	test("sets the browser-state cookie with the attributes session management needs", async () => {
		respondWithProfile();
		let state = await startFlow();

		let response = await finishFlow({ code: "gh-code", state });

		let cookie = response.headers
			.getSetCookie()
			.find((value) => value.startsWith("op_browser_state="));

		expect(cookie).toBeDefined();
		expect(cookie).toContain("Path=/");
		expect(cookie).toContain("HttpOnly");
		// Read from a cross-origin iframe, so `Lax` would keep it from ever being sent.
		expect(cookie).toContain("SameSite=None");
		expect(cookie).toContain("Secure");
		expect(cookie).toContain("Max-Age=2592000");
	});

	test("reuses the subject on a returning sign-in instead of creating another", async () => {
		respondWithProfile();
		await finishFlow({ code: "gh-code", state: await startFlow() });

		let first = await app.db.findOne(subjects, {
			where: { email_address: GITHUB_PROFILE.email },
		});

		respondWithProfile();
		let response = await finishFlow({ code: "gh-code-2", state: await startFlow() });

		expect(response.status).toBe(303);
		expect(await app.db.count(subjects, { where: { email_address: GITHUB_PROFILE.email } })).toBe(
			1,
		);
		expect(await app.db.count(connections)).toBe(1);

		let again = await app.db.findOne(subjects, {
			where: { email_address: GITHUB_PROFILE.email },
		});
		expect(again?.id).toBe(first!.id);
	});

	test("reports a declined authorization to the relying party as access_denied", async () => {
		let state = await startFlow();

		let response = await finishFlow({
			error: "access_denied",
			error_description: "The user denied the request",
			state,
		});

		expect(response.status).toBe(303);

		let location = new URL(response.headers.get("location")!);
		expect(`${location.origin}${location.pathname}`).toBe(REDIRECT_URI);
		expect(location.searchParams.get("error")).toBe("access_denied");
		expect(location.searchParams.get("error_description")).toBe("The user denied the request");
		expect(location.searchParams.get("state")).toBe("state-123");
		expect(location.searchParams.get("iss")).toBe("auth.sergiodxa.com");
		expect(location.searchParams.get("code")).toBeNull();
	});

	test("reports a mismatched state as server_error without leaking why", async () => {
		respondWithProfile();
		await startFlow();

		let response = await finishFlow({ code: "gh-code", state: "not-the-stored-state" });

		let location = new URL(response.headers.get("location")!);
		expect(location.searchParams.get("error")).toBe("server_error");
		expect(location.searchParams.get("error_description")).toBe(
			"GitHub sign-in could not be completed",
		);
	});

	test("refuses an email that already belongs to a password account", async () => {
		respondWithProfile({ ...GITHUB_PROFILE, email: "jane@example.com" });
		let state = await startFlow();

		let response = await finishFlow({ code: "gh-code", state });

		let location = new URL(response.headers.get("location")!);
		expect(location.searchParams.get("error")).toBe("access_denied");
		// The seeded subject keeps its single identity: nothing was linked to it.
		expect(await app.db.count(connections)).toBe(0);
	});

	test("rolls back the subject and the connection when billing provisioning fails", async () => {
		app = await createTestApp({ polar: failingPolarClient() });
		fixtures = await seed(app);

		respondWithProfile();
		let state = await startFlow();

		let response = await finishFlow({ code: "gh-code", state });

		let location = new URL(response.headers.get("location")!);
		expect(location.searchParams.get("error")).toBe("server_error");

		// Nothing survives a failed sign-up: a subject with no billing customer would be
		// able to sign in with no way to bill them, and there are no transactions here to
		// undo the writes automatically.
		expect(await app.db.count(subjects, { where: { email_address: GITHUB_PROFILE.email } })).toBe(
			0,
		);
		expect(await app.db.count(connections)).toBe(0);
	});

	test("refuses a callback with no authorization request parked", async () => {
		let state = await startFlow();
		app.resetCookies();

		let response = await finishFlow({ code: "gh-code", state });

		expect(response.status).toBe(400);
	});

	test("refuses an unknown provider", async () => {
		let url = new URL(routes.auth.providerCallback.href({ provider: "gitlab" }), ORIGIN);
		url.searchParams.set("code", "whatever");

		let response = await app.fetch(new Request(url, { redirect: "manual" }));

		expect(response.status).toBe(400);
	});

	test("answers in form_post mode with escaped hidden fields and no caching", async () => {
		respondWithProfile();
		let state = await startFlow({
			response_mode: "form_post",
			state: '"><script>alert(1)</script>',
		});

		let response = await finishFlow({ code: "gh-code", state });

		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(response.headers.get("pragma")).toBe("no-cache");
		expect(
			response.headers.getSetCookie().some((value) => value.startsWith("op_browser_state=")),
		).toBe(true);

		let body = await response.text();
		expect(body).toContain(`action="${REDIRECT_URI}"`);
		expect(body).toContain('name="code"');
		expect(body).toContain("<noscript>");
		expect(body).toContain("document.forms[0].submit()");
		// The hostile state is a value, never markup: nothing may reopen the document.
		expect(body).not.toContain("<script>alert(1)</script>");
		expect(body).toContain("&lt;script&gt;");
	});
});
