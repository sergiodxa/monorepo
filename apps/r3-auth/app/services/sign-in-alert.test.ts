/**
 * Router-level tests of the new-sign-in notice: that every path which opens a session
 * produces one, that it reports the device the request actually arrived from, that it
 * carries nothing a session could be replayed with, and that a refused delivery leaves
 * the sign-in itself untouched.
 *
 * Mail is recorded rather than mocked: the app's real mailer and real email class run,
 * and only delivery is replaced, so what a test reads is the message a provider would
 * have received. GitHub is intercepted with MSW for the same reason.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SentMessage } from "@pkg/mail";
import type { Result } from "@pkg/result";

import { MailError } from "@pkg/mail";
import { failure } from "@pkg/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import { NewSignInEmail } from "~/app/emails/new-sign-in";
import { createTestApp } from "~/app/lib/test/http";
import { authorizeUrl, EMAIL, ORIGIN, seed, signIn, submitSignIn } from "~/app/lib/test/seed";
import { sessions } from "~/database/schema";
import routes from "~/routes/web";

/** A desktop Chrome header, so the notice has something recognizable to report. */
const USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

/** The address the requests in these tests arrive from, as Cloudflare reports it. */
const CLIENT_IP = "203.0.113.7";

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

/** Answers GitHub's token exchange and profile fetch with {@link GITHUB_PROFILE}. */
function respondWithProfile(): void {
	server.use(
		http.post(TOKEN_ENDPOINT, () =>
			HttpResponse.json({ access_token: "gho_test", token_type: "bearer" }),
		),
		http.get(USER_ENDPOINT, () => HttpResponse.json(GITHUB_PROFILE)),
		http.get(EMAILS_ENDPOINT, () =>
			HttpResponse.json([{ email: GITHUB_PROFILE.email, primary: true, verified: true }]),
		),
	);
}

/** Headers every browser-facing request in these tests carries. */
function browserHeaders(extra: Record<string, string> = {}): Record<string, string> {
	return { "user-agent": USER_AGENT, "cf-connecting-ip": CLIENT_IP, ...extra };
}

/**
 * A transport whose every delivery is refused, so a test can drive the branch
 * where mail fails without a provider. Implemented as a plain `Transport` value
 * handed directly to the app, so the refusal stays scoped to this one test.
 */
function refusingTransport() {
	return {
		async send(): Promise<Result<SentMessage, MailError>> {
			return failure(new MailError("the provider refused this message"));
		},
	};
}

let app: TestApp;
let fixtures: Fixtures;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
	app = await createTestApp();
	fixtures = await seed(app);
});

/** Parks an authorization request and signs the seeded subject in with their password. */
async function credentialSignIn(): Promise<Response> {
	await app.fetch(new Request(authorizeUrl(fixtures), { headers: browserHeaders() }));

	return await app.fetch(
		new Request(`${ORIGIN}${routes.authorize.action.href()}`, {
			method: "POST",
			redirect: "manual",
			headers: browserHeaders({ "content-type": "application/x-www-form-urlencoded" }),
			body: new URLSearchParams({
				email: EMAIL,
				password: "a-good-password",
				name: "Jane Doe",
				username: "jane",
			}),
		}),
	);
}

describe("the new-sign-in notice", () => {
	test("mails the subject after a credential sign-in", async () => {
		let response = await credentialSignIn();

		expect(response.status).toBe(303);
		expect(app.mail.messages).toHaveLength(1);

		let message = app.mail.last!;
		expect(message.email).toBeInstanceOf(NewSignInEmail);
		expect(message.to).toEqual([{ email: EMAIL }]);
		expect(message.from).toEqual({ email: "no-reply@auth.sergiodxa.com", name: "Auth" });
		expect(message.subject).toBe("New sign-in to your account");
	});

	test("reports the browser, the system, the device class and the address", async () => {
		await credentialSignIn();

		let text = app.mail.last!.text!;

		expect(text).toContain("Chrome");
		expect(text).toContain("macOS");
		expect(text).toContain("Desktop");
		expect(text).toContain(CLIENT_IP);
	});

	/**
	 * A GitHub sign-in provisions its own identity, so the notice reports that
	 * identity's address.
	 */
	test("mails the subject after a GitHub sign-in", async () => {
		respondWithProfile();

		await app.fetch(new Request(authorizeUrl(fixtures), { headers: browserHeaders() }));

		let start = await app.fetch(
			new Request(`${ORIGIN}${routes.auth.provider.href({ provider: "github" })}`, {
				method: "POST",
				redirect: "manual",
				headers: browserHeaders({ "content-type": "application/x-www-form-urlencoded" }),
				body: "",
			}),
		);

		let state = new URL(start.headers.get("location")!).searchParams.get("state")!;
		let callback = new URL(routes.auth.providerCallback.href({ provider: "github" }), ORIGIN);
		callback.searchParams.set("code", "gh-code");
		callback.searchParams.set("state", state);

		let response = await app.fetch(
			new Request(callback, { redirect: "manual", headers: browserHeaders() }),
		);

		expect(response.status).toBe(303);
		expect(app.mail.messages).toHaveLength(1);
		expect(app.mail.last!.to).toEqual([{ email: GITHUB_PROFILE.email }]);
		expect(app.mail.last!.email).toBeInstanceOf(NewSignInEmail);
	});

	/**
	 * Hitting the authorize endpoint with no parameters parks a request for the
	 * server's own registration and redirects to the sign-in page, exercising the
	 * self-login flow.
	 */
	test("mails the subject when they sign in to this server itself", async () => {
		let start = await app.fetch(
			new Request(`${ORIGIN}${routes.authorize.index.href()}`, {
				redirect: "manual",
				headers: browserHeaders(),
			}),
		);

		await app.fetch(new Request(start.headers.get("location")!, { headers: browserHeaders() }));

		let response = await submitSignIn(app);

		expect(response.status).toBe(303);
		expect(app.mail.messages).toHaveLength(1);
		expect(app.mail.last!.to).toEqual([{ email: EMAIL }]);
	});

	test("never carries the session id, which is the refresh token", async () => {
		await credentialSignIn();

		let session = await app.db.findOne(sessions, { where: { subject_id: fixtures.subjectId } });
		let message = app.mail.last!;

		expect(session?.id).toBeTruthy();
		expect(message.html).not.toContain(session!.id);
		expect(message.text).not.toContain(session!.id);
		expect(message.subject).not.toContain(session!.id);
	});

	test("links to the account's device list rather than to a session", async () => {
		await credentialSignIn();

		expect(app.mail.last!.html).toContain(
			`https://auth.sergiodxa.com${routes.account.sessions.index.href()}`,
		);
	});

	/**
	 * The notice is flushed after the response is produced, so a delivery refusal
	 * cannot reach the response, and the session the sign-in opened is never rolled
	 * back over a mail failure.
	 */
	test("completes the sign-in even when the provider refuses the message", async () => {
		app = await createTestApp({ mailTransport: refusingTransport() });
		fixtures = await seed(app);

		let response = await credentialSignIn();

		expect(response.status).toBe(303);
		expect(new URL(response.headers.get("location")!).searchParams.get("code")).toBeTruthy();
		expect(await app.db.count(sessions, { where: { subject_id: fixtures.subjectId } })).toBe(1);
	});

	/**
	 * `signIn` performs a full sign-in, so the browser already holds a session this
	 * server issued, and the following authorization request takes the SSO path,
	 * opening a session without anyone authenticating and so without notifying them.
	 */
	test("is not sent when an already-signed-in browser authorizes another client", async () => {
		await signIn(app, fixtures);
		app.mail.clear();

		await app.fetch(new Request(authorizeUrl(fixtures), { headers: browserHeaders() }));

		expect(app.mail.messages).toHaveLength(0);
	});

	test("is not sent when the sign-in is refused", async () => {
		await app.fetch(new Request(authorizeUrl(fixtures), { headers: browserHeaders() }));

		await app.fetch(
			new Request(`${ORIGIN}${routes.authorize.action.href()}`, {
				method: "POST",
				redirect: "manual",
				headers: browserHeaders({ "content-type": "application/x-www-form-urlencoded" }),
				body: new URLSearchParams({
					email: EMAIL,
					password: "not-the-password",
					name: "Jane Doe",
					username: "jane",
				}),
			}),
		);

		expect(app.mail.messages).toHaveLength(0);
	});
});
