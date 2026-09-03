/**
 * Router-level tests of GitHub sign-in: the redirect that starts it, the first sign-in
 * that provisions a subject, connection and billing customer, the returning sign-in
 * that reuses them, the sign-in that completes when the billing mirror fails, the
 * rollback when the connection cannot be written, and the errors reported back to the
 * relying party. GitHub is intercepted with MSW, so the real provider requests run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MemoryBilling } from "@pkg/billing/providers/memory";
import { unwrap } from "@pkg/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { rawSql } from "remix/data-table";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import { refusingCustomers } from "~/app/lib/test/billing";
import { createTestApp } from "~/app/lib/test/http";
import { authorizeUrl, ORIGIN, REDIRECT_URI, seed } from "~/app/lib/test/seed";
import { connections, subjects } from "~/database/schema";
import routes from "~/routes/web";

const TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";
const USER_ENDPOINT = "https://api.github.com/user";
const EMAILS_ENDPOINT = "https://api.github.com/user/emails";

const GITHUB_PROFILE = {
	id: 4242,
	node_id: "MDQ6VXNlcjQyNDI=",
	login: "octo-jane",
	name: "Octo Jane",
	email: "octo-jane@example.com",
	avatar_url: "https://avatars.example.com/octo-jane.png",
};

let server = setupServer();

interface GitHubEmailEntry {
	email: string;
	primary: boolean;
	verified: boolean;
}

const VERIFIED_EMAILS: GitHubEmailEntry[] = [
	{ email: GITHUB_PROFILE.email, primary: true, verified: true },
];

/**
 * Answers the token exchange, the profile fetch and the address list. The list is a
 * parameter because GitHub publishes there whether an address is verified, and what
 * this server records for a new subject follows from it.
 *
 * @param emails - The list, or `null` to answer the endpoint with a server error.
 */
function respondWithProfile(
	profile: Record<string, unknown> = GITHUB_PROFILE,
	emails: GitHubEmailEntry[] | null = VERIFIED_EMAILS,
) {
	server.use(
		http.post(TOKEN_ENDPOINT, () =>
			HttpResponse.json({ access_token: "gho_test", token_type: "bearer" }),
		),
		http.get(USER_ENDPOINT, () => HttpResponse.json(profile)),
		http.get(EMAILS_ENDPOINT, () =>
			emails === null ? new HttpResponse(null, { status: 500 }) : HttpResponse.json(emails),
		),
	);
}

/** A billing platform that is down, for the tests about a sign-in outliving a billing outage. */
function unavailableBilling() {
	return refusingCustomers(new MemoryBilling(), "unknown");
}

/**
 * Makes every insert into `connections` fail, so the compensation that removes the
 * subject behind an unwritable connection runs against the real database. A trigger
 * keeps reads working, so the flow reaches the insert exactly the way a request does.
 */
async function refuseConnectionWrites(db: TestApp["db"]): Promise<void> {
	await db.exec(
		rawSql(
			"CREATE TRIGGER refuse_connection_insert BEFORE INSERT ON connections BEGIN SELECT RAISE(ABORT, 'connections is unavailable'); END",
		),
	);
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
	/**
	 * The connection is keyed by GitHub's node id, the identifier every connection this
	 * database already holds was written under.
	 */
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
		expect(subject?.email_verified_at).not.toBeNull();

		let connection = await app.db.findOne(connections, {
			where: { provider: "github", external_id: GITHUB_PROFILE.node_id },
		});
		expect(connection?.subject_id).toBe(subject!.id);
	});

	/**
	 * GitHub releases unverified addresses too, and the column is published to every
	 * relying party as `email_verified`, so the stamp follows GitHub's own report. An
	 * unproven address still completes the sign-in.
	 */
	test("leaves the address unverified when GitHub reports it unverified", async () => {
		respondWithProfile(GITHUB_PROFILE, [
			{ email: GITHUB_PROFILE.email, primary: true, verified: false },
		]);

		let response = await finishFlow({ code: "gh-code", state: await startFlow() });

		expect(response.status).toBe(303);
		expect(new URL(response.headers.get("location")!).searchParams.get("code")).toBeTruthy();

		let subject = await app.db.findOne(subjects, {
			where: { email_address: GITHUB_PROFILE.email },
		});
		expect(subject).not.toBeNull();
		expect(subject?.email_verified_at).toBeNull();
	});

	test("leaves the address unverified when GitHub's address list does not contain it", async () => {
		respondWithProfile(GITHUB_PROFILE, [
			{ email: "someone-else@example.com", primary: true, verified: true },
		]);

		await finishFlow({ code: "gh-code", state: await startFlow() });

		let subject = await app.db.findOne(subjects, {
			where: { email_address: GITHUB_PROFILE.email },
		});
		expect(subject?.email_verified_at).toBeNull();
	});

	/** Fails closed: the stamp requires a positive answer from GitHub's address list. */
	test("leaves the address unverified when the address list cannot be read", async () => {
		respondWithProfile(GITHUB_PROFILE, null);

		await finishFlow({ code: "gh-code", state: await startFlow() });

		let subject = await app.db.findOne(subjects, {
			where: { email_address: GITHUB_PROFILE.email },
		});
		expect(subject?.email_verified_at).toBeNull();
	});

	test("verifies an address GitHub reports under a different case", async () => {
		respondWithProfile(GITHUB_PROFILE, [
			{ email: GITHUB_PROFILE.email.toUpperCase(), primary: true, verified: true },
		]);

		await finishFlow({ code: "gh-code", state: await startFlow() });

		let subject = await app.db.findOne(subjects, {
			where: { email_address: GITHUB_PROFILE.email },
		});
		expect(subject?.email_verified_at).not.toBeNull();
	});

	/**
	 * Session management reads the cookie from a cross-origin iframe, so `SameSite=None`
	 * is what lets it travel.
	 */
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
		expect(await app.db.count(connections)).toBe(0);
	});

	test("creates the billing customer and links it to the subject on a first sign-in", async () => {
		respondWithProfile();
		await finishFlow({ code: "gh-code", state: await startFlow() });

		let subject = await app.db.findOne(subjects, {
			where: { email_address: GITHUB_PROFILE.email },
		});

		let customer = await unwrap(app.billing.customers.findByEmail(GITHUB_PROFILE.email));

		expect(customer.name).toBe(GITHUB_PROFILE.name);
		expect(customer.externalId).toBe(subject!.id);
	});

	/**
	 * Sign-up charges nothing, so an authentication outlives a billing outage and keeps
	 * the account it provisioned, leaving a retry with the provisioning already done.
	 */
	test("signs the person in when the billing mirror fails, keeping the subject and the connection", async () => {
		app = await createTestApp({ billing: unavailableBilling() });
		fixtures = await seed(app);

		respondWithProfile();
		let state = await startFlow();

		let response = await finishFlow({ code: "gh-code", state });

		let location = new URL(response.headers.get("location")!);
		expect(location.searchParams.get("error")).toBeNull();
		expect(location.searchParams.get("code")).toBeTruthy();

		let subject = await app.db.findOne(subjects, {
			where: { email_address: GITHUB_PROFILE.email },
		});
		expect(subject).not.toBeNull();

		let connection = await app.db.findOne(connections, {
			where: { provider: "github", external_id: GITHUB_PROFILE.node_id },
		});
		expect(connection?.subject_id).toBe(subject!.id);
	});

	/**
	 * The request logger flushes through `console.error`, which this runner captures only
	 * when the function itself is swapped. A log line is the one place an address could
	 * travel outside the database.
	 */
	test("logs the failed billing mirror by subject id and never by address", async () => {
		app = await createTestApp({ billing: unavailableBilling() });
		fixtures = await seed(app);

		let calls: unknown[][] = [];
		let original = console.error;
		console.error = (...args: unknown[]) => void calls.push(args);

		try {
			respondWithProfile();
			await finishFlow({ code: "gh-code", state: await startFlow() });
		} finally {
			console.error = original;
		}

		let subject = await app.db.findOne(subjects, {
			where: { email_address: GITHUB_PROFILE.email },
		});

		let logged = JSON.stringify(calls);

		expect(logged).toContain("github_customer_create_failed");
		expect(logged).toContain(subject!.id);
		expect(logged).not.toContain(GITHUB_PROFILE.email);
	});

	/**
	 * A subject whose connection write failed still holds the address on the unique
	 * column, so removing it leaves that address free for the next attempt.
	 */
	test("deletes the subject when the connection cannot be written", async () => {
		await refuseConnectionWrites(app.db);

		respondWithProfile();
		let state = await startFlow();

		let response = await finishFlow({ code: "gh-code", state });

		let location = new URL(response.headers.get("location")!);
		expect(location.searchParams.get("error")).toBe("server_error");

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
		expect(body).not.toContain("<script>alert(1)</script>");
		expect(body).toContain("&lt;script&gt;");
	});
});
