/**
 * Router-level tests of email verification: which sign-ins produce a message and which do
 * not, the window that holds a second one back, and everything the token has to be — usable
 * once, dead when it expires, and bound to the address it was issued for.
 *
 * Mail is recorded rather than mocked, so what a test reads is the message a provider would
 * have received, including the link it carries. The link is followed the way a reader would:
 * pulled out of the message, requested, and then confirmed with the button the page carries.
 *
 * The split across the two methods is what several of these are about. Anything that merely
 * fetches the URL — a mail scanner, a link checker, a bodyless probe — must leave the token
 * exactly as it found it, so the person's own click still works.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import { VerifyEmailEmail } from "~/app/emails/verify-email";
import { createTestApp } from "~/app/lib/test/http";
import { authorizeUrl, EMAIL, ORIGIN, PASSWORD, seed, signIn } from "~/app/lib/test/seed";
import { sessions, subjects } from "~/database/schema";
import routes from "~/routes/web";

/** A brand-new address, so a sign-in with it is a registration. */
const NEW_EMAIL = "newcomer@example.com";

/** GitHub's endpoints, intercepted for the provider tests in this file. */
const TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";
const USER_ENDPOINT = "https://api.github.com/user";
const EMAILS_ENDPOINT = "https://api.github.com/user/emails";

/** The identity GitHub authenticates here. */
const GITHUB_PROFILE = {
	id: 4242,
	node_id: "MDQ6VXNlcjQyNDI=",
	login: "octo-jane",
	name: "Octo Jane",
	email: "octo-jane@example.com",
	avatar_url: "https://avatars.example.com/octo-jane.png",
};

let server = setupServer();

let app: TestApp;
let fixtures: Fixtures;

/**
 * Answers GitHub's handshake, with the address list reporting whatever a test asks for.
 *
 * @param verified - What GitHub says about the profile's own address.
 */
function respondWithProfile(verified: boolean): void {
	server.use(
		http.post(TOKEN_ENDPOINT, () =>
			HttpResponse.json({ access_token: "gho_test", token_type: "bearer" }),
		),
		http.get(USER_ENDPOINT, () => HttpResponse.json(GITHUB_PROFILE)),
		http.get(EMAILS_ENDPOINT, () =>
			HttpResponse.json([{ email: GITHUB_PROFILE.email, primary: true, verified }]),
		),
	);
}

/**
 * Parks an authorization request and posts the credential form.
 *
 * @param overrides - Fields replacing the seeded subject's, so the same helper registers a
 *   new address as well as signing the existing one in.
 */
async function credentialSignIn(overrides: Record<string, string> = {}): Promise<Response> {
	await app.fetch(new Request(authorizeUrl(fixtures)));

	return await app.fetch(
		new Request(`${ORIGIN}${routes.authorize.action.href()}`, {
			method: "POST",
			redirect: "manual",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				email: EMAIL,
				password: PASSWORD,
				name: "Jane Doe",
				username: "jane",
				...overrides,
			}),
		}),
	);
}

/** Completes a whole GitHub sign-in for {@link GITHUB_PROFILE}. */
async function githubSignIn(): Promise<Response> {
	await app.fetch(new Request(authorizeUrl(fixtures)));

	let start = await app.fetch(
		new Request(`${ORIGIN}${routes.auth.provider.href({ provider: "github" })}`, {
			method: "POST",
			redirect: "manual",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: "",
		}),
	);

	let state = new URL(start.headers.get("location")!).searchParams.get("state")!;
	let callback = new URL(routes.auth.providerCallback.href({ provider: "github" }), ORIGIN);
	callback.searchParams.set("code", "gh-code");
	callback.searchParams.set("state", state);

	return await app.fetch(new Request(callback, { redirect: "manual" }));
}

/**
 * The verification email the app most recently queued, or `undefined` when it queued none.
 *
 * Identified by type rather than by copy, so a reworded subject does not break the search
 * and the wrong message being sent does.
 */
function lastVerification() {
	return app.mail.messages.filter((message) => message.email instanceof VerifyEmailEmail).at(-1);
}

/** The token out of the most recent verification message's link. */
function lastToken(): string {
	let html = lastVerification()?.html;
	if (!html) throw new Error("No verification email was queued");

	let match = html.match(/verify-email\?token=([A-Za-z0-9_-]+)/);
	if (!match?.[1]) throw new Error("The verification email carried no token");

	return match[1];
}

/**
 * Follows a verification link with a given token, the way opening the mail does.
 *
 * @param method - How the URL is fetched, so a test can probe it the way a scanner would.
 */
async function follow(token: string, method = "GET"): Promise<Response> {
	let url = new URL(routes.verifyEmail.index.href(), ORIGIN);
	url.searchParams.set("token", token);

	return await app.fetch(new Request(url, { method, redirect: "manual" }));
}

/** Presses the button the page carries, which is the request that spends the token. */
async function confirm(token: string): Promise<Response> {
	return await app.fetch(
		new Request(`${ORIGIN}${routes.verifyEmail.action.href()}`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			redirect: "manual",
			body: new URLSearchParams({ token }),
		}),
	);
}

/** The seeded subject's row, re-read so a test sees what the request wrote. */
async function storedSubject() {
	return await app.db.findOne(subjects, { where: { id: fixtures.subjectId } });
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
	app = await createTestApp();
	fixtures = await seed(app, { emailVerified: false });
});

describe("sending the verification email", () => {
	test("mails an unverified subject after a credential sign-in", async () => {
		let response = await credentialSignIn();

		expect(response.status).toBe(303);

		let message = lastVerification();
		expect(message).toBeDefined();
		expect(message!.to).toEqual([{ email: EMAIL }]);
		expect(message!.subject).toBe("Confirm your email address");
	});

	test("mails nothing when the address is already verified", async () => {
		app = await createTestApp();
		fixtures = await seed(app);

		await credentialSignIn();

		expect(lastVerification()).toBeUndefined();
	});

	test("mails a registration, whose address nothing has proven yet", async () => {
		await credentialSignIn({ email: NEW_EMAIL, username: "newcomer", name: "New Comer" });

		expect(lastVerification()?.to).toEqual([{ email: NEW_EMAIL }]);

		let registered = await app.db.findOne(subjects, { where: { email_address: NEW_EMAIL } });
		expect(registered?.email_verified_at).toBeNull();
	});

	test("mails a GitHub sign-in whose address GitHub did not report verified", async () => {
		respondWithProfile(false);

		await githubSignIn();

		expect(lastVerification()?.to).toEqual([{ email: GITHUB_PROFILE.email }]);
	});

	test("mails nothing for a GitHub sign-in whose address GitHub reported verified", async () => {
		respondWithProfile(true);

		await githubSignIn();

		expect(lastVerification()).toBeUndefined();
	});

	test("mails nothing when the sign-in is refused", async () => {
		// The whole reason this is gated on a successful sign-in: an endpoint that mails
		// whichever address was typed at it is an existence oracle with a mailer attached.
		let response = await credentialSignIn({ password: "not-the-password" });

		// The sign-in page again, carrying the refusal — and no mail of any kind behind it.
		expect(response.status).toBe(200);
		expect(await response.text()).toContain("Invalid email or password.");
		expect(lastVerification()).toBeUndefined();
		expect(app.mail.messages).toHaveLength(0);
	});

	test("mails nothing when an already-signed-in browser authorizes another client", async () => {
		await signIn(app, fixtures);
		app.mail.clear();

		// Answered by SSO: a session row opens, but nobody authenticated here.
		await app.fetch(new Request(authorizeUrl(fixtures)));

		expect(app.mail.messages).toHaveLength(0);
	});

	test("carries no session id, which is this server's refresh token", async () => {
		await credentialSignIn();

		let session = await app.db.findOne(sessions, { where: { subject_id: fixtures.subjectId } });
		let message = lastVerification()!;

		expect(session?.id).toBeTruthy();
		expect(message.html).not.toContain(session!.id);
		expect(message.text).not.toContain(session!.id);
		expect(message.subject).not.toContain(session!.id);
	});

	test("renders no locale key, so every string the message asks for exists", async () => {
		await credentialSignIn();

		let message = lastVerification()!;

		expect(message.text).not.toContain("emails.verifyEmail");
		expect(message.text).not.toContain("emails.footer");
		expect(message.subject).not.toContain("emails.");
	});
});

describe("the resend window", () => {
	test("holds a second send back inside five minutes", async () => {
		await credentialSignIn();
		expect(lastVerification()).toBeDefined();

		app.mail.clear();

		// A second successful sign-in for the same still-unverified address.
		await credentialSignIn();

		expect(lastVerification()).toBeUndefined();
	});

	test("sends again once the window has passed", async () => {
		await credentialSignIn();
		app.mail.clear();

		// KV expiring the marker is exactly this: the key stops being there.
		let cooldown = (await app.kv.list({ prefix: "email-verification-cooldown:" })).keys;
		expect(cooldown).toHaveLength(1);
		await app.kv.delete(cooldown[0]!.name);

		await credentialSignIn();

		expect(lastVerification()).toBeDefined();
	});

	test("leaves the suppressed request holding a token that still works", async () => {
		// The invariant the shared five minutes exists for: a held-back send never replaces a
		// live link, so suppression cannot strand somebody with no way to verify.
		await credentialSignIn();
		let token = lastToken();

		app.mail.clear();
		await credentialSignIn();
		expect(lastVerification()).toBeUndefined();

		expect((await confirm(token)).status).toBe(200);
		expect((await storedSubject())?.email_verified_at).not.toBeNull();
	});

	test("stores nothing that spells out the address", async () => {
		await credentialSignIn();

		let keys = (await app.kv.list()).keys.map((key) => key.name);

		for (let key of keys) expect(key).not.toContain(EMAIL);
	});
});

describe("the resend endpoint", () => {
	beforeEach(async () => {
		await signIn(app, fixtures);
		app.mail.clear();
	});

	/** Posts the resend form the profile page renders. */
	async function resend(): Promise<Response> {
		return await app.fetch(
			new Request(`${ORIGIN}${routes.account.verifyEmailResend.href()}`, {
				method: "POST",
				redirect: "manual",
				headers: { "content-type": "application/x-www-form-urlencoded", origin: ORIGIN },
				body: "",
			}),
		);
	}

	test("mails a fresh link to the signed-in subject's own address", async () => {
		// Signing in already spent the window, so let it lapse first.
		for (let key of (await app.kv.list({ prefix: "email-verification-cooldown:" })).keys) {
			await app.kv.delete(key.name);
		}

		let response = await resend();

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`/account/profile?resend=sent`);
		expect(lastVerification()?.to).toEqual([{ email: EMAIL }]);
	});

	test("reports suppression rather than sending inside the window", async () => {
		let response = await resend();

		expect(response.headers.get("location")).toBe(`/account/profile?resend=suppressed`);
		expect(lastVerification()).toBeUndefined();
	});

	test("refuses a visitor with no session", async () => {
		app.resetCookies();

		let response = await resend();

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.authorize.index.href());
		expect(app.mail.messages).toHaveLength(0);
	});
});

describe("following a verification link", () => {
	test("asks rather than confirms, and spends nothing", async () => {
		await credentialSignIn();

		let token = lastToken();
		let response = await follow(token);

		expect(response.status).toBe(200);

		let body = await response.text();

		expect(body).toContain("Confirm your email address");
		// The button is a real form: it posts back here, carrying the token in the body.
		expect(body).toContain(`method="post"`);
		expect(body).toContain(`action="${routes.verifyEmail.action.href()}"`);
		expect(body).toContain(token);

		// The whole point of the split: opening the link is not the confirmation.
		expect((await storedSubject())?.email_verified_at).toBeNull();
	});

	test("leaves the token usable after a scanner has fetched the link", async () => {
		// What a mail scanner or a link checker does to every URL in a message. Neither of
		// them presses anything, so neither of them may verify an address or burn a link.
		await credentialSignIn();
		let token = lastToken();

		expect((await follow(token)).status).toBe(200);
		expect((await follow(token, "HEAD")).status).toBe(200);
		expect((await follow(token)).status).toBe(200);

		expect((await storedSubject())?.email_verified_at).toBeNull();

		// And the person's own click still works, which is the failure this prevents.
		expect((await confirm(token)).status).toBe(200);
		expect((await storedSubject())?.email_verified_at).not.toBeNull();
	});

	test("answers a bodyless probe with no body and no verification", async () => {
		await credentialSignIn();

		let response = await follow(lastToken(), "HEAD");

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("");
		expect((await storedSubject())?.email_verified_at).toBeNull();
	});

	test("confirms the address and says so", async () => {
		await credentialSignIn();
		let token = lastToken();

		await follow(token);
		let response = await confirm(token);

		expect(response.status).toBe(200);
		expect(await response.text()).toContain("Email address confirmed");
		expect((await storedSubject())?.email_verified_at).not.toBeNull();
	});

	test("confirms without a session, because the link is followed from an inbox", async () => {
		await credentialSignIn();
		let token = lastToken();
		app.resetCookies();

		expect((await follow(token)).status).toBe(200);
		expect((await confirm(token)).status).toBe(200);
		expect((await storedSubject())?.email_verified_at).not.toBeNull();
	});

	test("refuses a token the second time it is used", async () => {
		await credentialSignIn();
		let token = lastToken();

		expect((await confirm(token)).status).toBe(200);

		let replay = await confirm(token);

		expect(replay.status).toBe(400);
		expect(await replay.text()).toContain("This link no longer works");
	});

	test("offers no button for a token that has already been spent", async () => {
		await credentialSignIn();
		let token = lastToken();

		await confirm(token);

		let response = await follow(token);

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("This link no longer works");
	});

	test("refuses a token KV has dropped", async () => {
		await credentialSignIn();
		let token = lastToken();

		// Expiry is the record ceasing to exist, which is what this does.
		for (let key of (await app.kv.list({ prefix: "email-verification:" })).keys) {
			await app.kv.delete(key.name);
		}

		expect((await follow(token)).status).toBe(400);

		let response = await confirm(token);

		expect(response.status).toBe(400);
		expect((await storedSubject())?.email_verified_at).toBeNull();
	});

	test("refuses a token whose address the account no longer holds", async () => {
		await credentialSignIn();
		let token = lastToken();

		// The token proves one address. Once the row names a different one, it proves nothing
		// about what stamping the column would now be asserting.
		await app.db.update(subjects, fixtures.subjectId, { email_address: "moved@example.com" });

		expect((await follow(token)).status).toBe(400);

		let response = await confirm(token);

		expect(response.status).toBe(400);
		expect((await storedSubject())?.email_verified_at).toBeNull();
	});

	test("refuses a token issued for another subject's address", async () => {
		// Two unverified subjects, each with their own live token; neither token may confirm
		// the other's address.
		await credentialSignIn();
		let janeToken = lastToken();

		app.resetCookies();
		app.mail.clear();
		await credentialSignIn({ email: NEW_EMAIL, username: "newcomer", name: "New Comer" });
		let newcomerToken = lastToken();

		expect(newcomerToken).not.toBe(janeToken);

		await confirm(newcomerToken);

		let newcomer = await app.db.findOne(subjects, { where: { email_address: NEW_EMAIL } });
		expect(newcomer?.email_verified_at).not.toBeNull();
		// The other account is untouched: a token confirms the address it was mailed to.
		expect((await storedSubject())?.email_verified_at).toBeNull();
	});

	test("answers a malformed token with the page, not a 500", async () => {
		expect((await follow("not-a-real-token")).status).toBe(400);

		let response = await confirm("not-a-real-token");

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("This link no longer works");
	});

	test("answers a missing token with the page, not a 500", async () => {
		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.verifyEmail.index.href()}`, { redirect: "manual" }),
		);

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("This link no longer works");
	});

	test("keeps the token out of the referrer and out of shared caches", async () => {
		await credentialSignIn();

		let response = await follow(lastToken());

		expect(response.headers.get("referrer-policy")).toBe("no-referrer");
		expect(response.headers.get("cache-control")).toBe("no-store");
	});
});

describe("the profile page's signal", () => {
	/** Fetches the profile page for the signed-in browser. */
	async function profile(query = ""): Promise<string> {
		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.account.profile.href()}${query}`),
		);

		expect(response.status).toBe(200);

		return await response.text();
	}

	test("tells an unverified subject their address is unconfirmed and offers a resend", async () => {
		await signIn(app, fixtures);

		let body = await profile();

		expect(body).toContain("Unverified");
		expect(body).toContain("Confirm your email address");
		expect(body).toContain(routes.account.verifyEmailResend.href());
	});

	test("shows a verified subject the badge and no panel", async () => {
		app = await createTestApp();
		fixtures = await seed(app);
		await signIn(app, fixtures);

		let body = await profile();

		expect(body).toContain("Verified");
		expect(body).not.toContain(routes.account.verifyEmailResend.href());
	});

	test("reports the outcome the resend redirect named", async () => {
		await signIn(app, fixtures);

		expect(await profile("?resend=sent")).toContain("Verification email sent");
		expect(await profile("?resend=suppressed")).toContain("sent to you in the last few minutes");
	});

	test("ignores an outcome nobody issued", async () => {
		await signIn(app, fixtures);

		let body = await profile("?resend=whatever");

		expect(body).not.toContain("Verification email sent");
		expect(body).not.toContain("could not be sent");
	});
});
