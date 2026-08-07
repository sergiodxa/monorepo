/**
 * Router-level tests of password recovery: that a registered address is mailed a link and
 * an unregistered one is answered identically with nothing sent, that the per-address
 * cooldown suppresses a second request, that a token is single-use and bound to the subject
 * it was issued for, that a completed reset replaces the password and revokes every session,
 * and that neither message carries a session id.
 *
 * Mail is recorded rather than mocked, so the app's real mailer and real email classes run
 * and the token under test is the one a reader would have received.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import { password } from "@pkg/crypto";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import Credential from "~/app/data/credential";
import Subject from "~/app/data/subject";
import { PasswordChangedEmail } from "~/app/emails/password-changed";
import { ResetPasswordEmail } from "~/app/emails/reset-password";
import { createTestApp } from "~/app/lib/test/http";
import { authorizeUrl, EMAIL, ORIGIN, PASSWORD, seed } from "~/app/lib/test/seed";
import { sessions } from "~/database/schema";
import routes from "~/routes/web";

/** The password a reset in these tests changes the account to. */
const NEW_PASSWORD = "a-brand-new-password";

/** An address no fixture registers, used to drive the unknown-address branch. */
const UNKNOWN_EMAIL = "nobody@example.com";

/** A second registered subject, so token binding can be tested against a real neighbour. */
const OTHER_EMAIL = "john@example.com";

/** That subject's password, which must survive somebody else's reset untouched. */
const OTHER_PASSWORD = "another-good-password";

/** Seconds the reset token is expected to live for, as the copy and the store agree on. */
const EXPECTED_TOKEN_TTL_SECONDS = 30 * 60;

/** Seconds one address is expected to be inside its cooldown for. */
const EXPECTED_COOLDOWN_SECONDS = 5 * 60;

let app: TestApp;
let fixtures: Fixtures;

beforeEach(async () => {
	app = await createTestApp();
	fixtures = await seed(app);
});

/** Posts the "forgot my password" form for an address. */
async function requestReset(email: string): Promise<Response> {
	return await app.fetch(
		new Request(`${ORIGIN}${routes.password.forgot.action.href()}`, {
			method: "POST",
			redirect: "manual",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ email }),
		}),
	);
}

/** The token out of the most recent reset mail, as a reader's browser would carry it. */
function tokenFromMail(): string {
	let html = app.mail.last?.html;
	if (!html) throw new Error("No reset mail was recorded");

	let match = /\/password\/reset\?token=([A-Za-z0-9_-]+)/.exec(html);
	if (!match?.[1]) throw new Error("The reset mail carried no token");

	return match[1];
}

/** Opens the reset link, which is what a reader's first click does. */
async function openResetLink(token: string): Promise<Response> {
	let url = new URL(routes.password.reset.index.href(), ORIGIN);
	url.searchParams.set("token", token);
	return await app.fetch(new Request(url, { redirect: "manual" }));
}

/** Submits the new-password form for a token. */
async function submitReset(
	token: string,
	newPassword: string,
	confirmation = newPassword,
): Promise<Response> {
	return await app.fetch(
		new Request(`${ORIGIN}${routes.password.reset.action.href()}`, {
			method: "POST",
			redirect: "manual",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				token,
				password: newPassword,
				passwordConfirmation: confirmation,
			}),
		}),
	);
}

/** Runs request → open → submit, and returns the final response. */
async function completeReset(newPassword = NEW_PASSWORD): Promise<Response> {
	await requestReset(EMAIL);
	let token = tokenFromMail();
	await openResetLink(token);
	return await submitReset(token, newPassword);
}

/** Registers a second subject with a password of their own. */
async function seedOtherSubject(): Promise<string> {
	let subject = await Subject.create(app.db, {
		email_address: OTHER_EMAIL,
		display_name: "John Doe",
		username: "john",
		avatar: "https://example.com/john.png",
	});

	let hash = await password.hash(OTHER_PASSWORD);
	if (hash.status === "failure") throw new Error("Could not hash the second fixture password");

	await Credential.create(app.db, subject.id, hash.data, Date.now());

	return subject.id;
}

/** Signs in with the credential form, so a password can be proven to work or not. */
async function signInWith(email: string, secret: string): Promise<Response> {
	app.resetCookies();
	await app.fetch(new Request(authorizeUrl(fixtures)));

	return await app.fetch(
		new Request(`${ORIGIN}${routes.authorize.action.href()}`, {
			method: "POST",
			redirect: "manual",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({ email, password: secret, name: "Jane Doe", username: "jane" }),
		}),
	);
}

/** The single key under a prefix, so a test can read what the store actually holds. */
async function keysUnder(prefix: string): Promise<{ name: string; expiration?: number }[]> {
	let listing = await app.kv.list({ prefix });
	return listing.keys;
}

describe("requesting a password reset", () => {
	test("mails a reset link to a registered address", async () => {
		let response = await requestReset(EMAIL);

		expect(response.status).toBe(200);
		expect(app.mail.messages).toHaveLength(1);

		let message = app.mail.last!;
		expect(message.email).toBeInstanceOf(ResetPasswordEmail);
		expect(message.to).toEqual([{ email: EMAIL }]);
		expect(message.from).toEqual({ email: "no-reply@auth.sergiodxa.com", name: "Auth" });
		expect(message.subject).toBe("Reset your password");
		expect(message.html).toContain("https://auth.sergiodxa.com/password/reset?token=");
	});

	test("answers an unknown address with the identical page and sends nothing", async () => {
		let known = await requestReset(EMAIL);
		let knownBody = await known.text();

		app.resetCookies();
		app.mail.clear();

		let unknown = await requestReset(UNKNOWN_EMAIL);
		let unknownBody = await unknown.text();

		expect(unknown.status).toBe(known.status);
		expect(unknownBody).toBe(knownBody);
		expect(unknown.headers.get("content-type")).toBe(known.headers.get("content-type"));
		expect(app.mail.messages).toHaveLength(0);
	});

	test("claims the cooldown for an unknown address too, so the two cost the same", async () => {
		await requestReset(UNKNOWN_EMAIL);

		expect(await keysUnder("password-reset-cooldown:")).toHaveLength(1);
		expect(await keysUnder("password-reset:")).toHaveLength(0);
	});

	test("suppresses a second request for the same address inside the cooldown", async () => {
		await requestReset(EMAIL);
		expect(app.mail.messages).toHaveLength(1);

		let second = await requestReset(EMAIL);

		expect(second.status).toBe(200);
		expect(app.mail.messages).toHaveLength(1);
	});

	test("mails again once the cooldown record is gone, which is what its expiry does", async () => {
		await requestReset(EMAIL);

		let [cooldown] = await keysUnder("password-reset-cooldown:");
		await app.kv.delete(cooldown!.name);

		await requestReset(EMAIL);

		expect(app.mail.messages).toHaveLength(2);
	});

	test("stores the token and the cooldown with the lifetimes the copy promises", async () => {
		await requestReset(EMAIL);

		let nowSeconds = Math.floor(Date.now() / 1000);
		let [token] = await keysUnder("password-reset:");
		let [cooldown] = await keysUnder("password-reset-cooldown:");

		expect(token!.expiration).toBeGreaterThanOrEqual(nowSeconds + EXPECTED_TOKEN_TTL_SECONDS - 5);
		expect(token!.expiration).toBeLessThanOrEqual(nowSeconds + EXPECTED_TOKEN_TTL_SECONDS + 5);
		expect(cooldown!.expiration).toBeGreaterThanOrEqual(nowSeconds + EXPECTED_COOLDOWN_SECONDS - 5);
		expect(cooldown!.expiration).toBeLessThanOrEqual(nowSeconds + EXPECTED_COOLDOWN_SECONDS + 5);
		// The cooldown must never outlive the token, or a suppressed request would strand
		// somebody with no usable link.
		expect(cooldown!.expiration!).toBeLessThan(token!.expiration!);
	});

	test("keeps the token out of the store: only its digest is written", async () => {
		await requestReset(EMAIL);

		let token = tokenFromMail();
		let [stored] = await keysUnder("password-reset:");

		expect(stored!.name).not.toContain(token);
		expect(await app.kv.get(`password-reset:${token}`)).toBeNull();
	});

	test("keeps the address out of the store and out of the logs", async () => {
		await requestReset(EMAIL);

		let keys = [
			...(await keysUnder("password-reset:")),
			...(await keysUnder("password-reset-cooldown:")),
			...(await keysUnder("password-reset-latest:")),
		];

		for (let key of keys) expect(key.name).not.toContain(EMAIL);
	});

	test("re-renders the form for a malformed address", async () => {
		let response = await requestReset("not-an-address");

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("Enter a valid email address.");
		expect(app.mail.messages).toHaveLength(0);
	});

	test("retires the previous token when a new one is issued", async () => {
		await requestReset(EMAIL);
		let first = tokenFromMail();

		let [cooldown] = await keysUnder("password-reset-cooldown:");
		await app.kv.delete(cooldown!.name);

		await requestReset(EMAIL);
		let second = tokenFromMail();

		expect(second).not.toBe(first);
		// Exactly one live reset per account: the older link is gone rather than parallel.
		expect(await keysUnder("password-reset:")).toHaveLength(1);

		let replayed = await submitReset(first, NEW_PASSWORD);
		expect(replayed.status).toBe(400);
		expect(await replayed.text()).toContain("This link no longer works");
	});
});

describe("the reset mail", () => {
	test("carries no session id and no untranslated key", async () => {
		// A session on the account first, so there is a real refresh token to look for.
		await signInWith(EMAIL, PASSWORD);
		app.mail.clear();
		app.resetCookies();

		await requestReset(EMAIL);

		let session = await app.db.findOne(sessions, { where: { subject_id: fixtures.subjectId } });
		let message = app.mail.last!;

		expect(session?.id).toBeTruthy();
		expect(message.html).not.toContain(session!.id);
		expect(message.text).not.toContain(session!.id);
		expect(message.html).not.toContain("emails.");
		expect(message.text).not.toContain("emails.");
	});
});

describe("opening a reset link", () => {
	test("renders the new-password form for a live token", async () => {
		await requestReset(EMAIL);

		let response = await openResetLink(tokenFromMail());

		expect(response.status).toBe(200);
		expect(response.headers.get("referrer-policy")).toBe("no-referrer");
		expect(await response.text()).toContain("Choose a new password");
	});

	test("does not spend the token, so the link can be reloaded", async () => {
		await requestReset(EMAIL);
		let token = tokenFromMail();

		await openResetLink(token);
		let second = await openResetLink(token);

		expect(second.status).toBe(200);
		expect(await second.text()).toContain("Choose a new password");
	});

	test("answers a malformed link with a page rather than a 500", async () => {
		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.password.reset.index.href()}`, { redirect: "manual" }),
		);

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("This link no longer works");
	});

	test("answers a token whose record is gone the same way, which is what expiry produces", async () => {
		await requestReset(EMAIL);
		let token = tokenFromMail();

		let [stored] = await keysUnder("password-reset:");
		await app.kv.delete(stored!.name);

		let response = await openResetLink(token);

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("This link no longer works");
	});
});

describe("completing a reset", () => {
	test("changes the password, and the new one then signs in", async () => {
		let response = await completeReset();

		expect(response.status).toBe(200);
		expect(await response.text()).toContain("Password changed");

		let signedIn = await signInWith(EMAIL, NEW_PASSWORD);

		expect(signedIn.status).toBe(303);
		expect(new URL(signedIn.headers.get("location")!).searchParams.get("code")).toBeTruthy();
	});

	test("stops the old password from working", async () => {
		await completeReset();

		let refused = await signInWith(EMAIL, PASSWORD);

		expect(refused.headers.get("location")).toBeNull();
		expect(await refused.text()).toContain("Invalid email or password.");
	});

	test("marks the credential usable, so the reset is not a dead end", async () => {
		await completeReset();

		let credential = await Credential.find(app.db, fixtures.subjectId);

		expect(credential?.verified_at).toBeGreaterThan(0);
	});

	test("gives a subject with no credential a usable one, since the inbox proved ownership", async () => {
		let subjectId = await Subject.create(app.db, {
			email_address: "social@example.com",
			display_name: "Social Only",
			username: "social",
			avatar: "https://example.com/social.png",
		}).then((subject) => subject.id);

		await requestReset("social@example.com");
		let token = tokenFromMail();
		let response = await submitReset(token, NEW_PASSWORD);

		expect(response.status).toBe(200);

		let credential = await Credential.find(app.db, subjectId);
		expect(credential).not.toBeNull();
		expect(credential!.verified_at).toBeGreaterThan(0);

		let verified = await password.verify(credential!.password_hash, NEW_PASSWORD);
		expect(verified.status === "success" && verified.data).toBe(true);
	});

	test("spends the token: a replay answers with the unusable-link page", async () => {
		await requestReset(EMAIL);
		let token = tokenFromMail();

		let first = await submitReset(token, NEW_PASSWORD);
		expect(first.status).toBe(200);

		let replay = await submitReset(token, "yet-another-password");

		expect(replay.status).toBe(400);
		expect(await replay.text()).toContain("This link no longer works");

		// The replayed submission changed nothing: the first new password still works.
		let credential = await Credential.find(app.db, fixtures.subjectId);
		let stillFirst = await password.verify(credential!.password_hash, NEW_PASSWORD);
		expect(stillFirst.status === "success" && stillFirst.data).toBe(true);
	});

	test("cannot reset a different subject than the one it was issued for", async () => {
		let otherId = await seedOtherSubject();

		// A token for the seeded subject, spent while another account exists.
		await completeReset();

		let otherCredential = await Credential.find(app.db, otherId);
		let untouched = await password.verify(otherCredential!.password_hash, OTHER_PASSWORD);

		expect(untouched.status === "success" && untouched.data).toBe(true);

		let signedIn = await signInWith(OTHER_EMAIL, OTHER_PASSWORD);
		expect(signedIn.status).toBe(303);
	});

	test("revokes every session on the account", async () => {
		await signInWith(EMAIL, PASSWORD);
		expect(await app.db.count(sessions, { where: { subject_id: fixtures.subjectId } })).toBe(1);

		app.resetCookies();
		await completeReset();

		expect(await app.db.count(sessions, { where: { subject_id: fixtures.subjectId } })).toBe(0);
	});

	test("leaves another subject's sessions alone", async () => {
		let otherId = await seedOtherSubject();
		await signInWith(OTHER_EMAIL, OTHER_PASSWORD);
		expect(await app.db.count(sessions, { where: { subject_id: otherId } })).toBe(1);

		app.resetCookies();
		await completeReset();

		expect(await app.db.count(sessions, { where: { subject_id: otherId } })).toBe(1);
	});

	test("notifies the subject that the password changed", async () => {
		await completeReset();

		let notice = app.mail.messages.find((message) => message.email instanceof PasswordChangedEmail);

		expect(notice).toBeDefined();
		expect(notice!.to).toEqual([{ email: EMAIL }]);
		expect(notice!.subject).toBe("Your password was changed");
		expect(notice!.html).not.toContain("emails.");
		expect(notice!.text).not.toContain("emails.");
	});

	test("re-renders the form when the two passwords do not match", async () => {
		await requestReset(EMAIL);
		let token = tokenFromMail();

		let response = await submitReset(token, NEW_PASSWORD, "something-else");

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("The two passwords do not match.");

		// The token survives a refused submission, so the person can simply try again.
		let retry = await submitReset(token, NEW_PASSWORD);
		expect(retry.status).toBe(200);
	});

	test("re-renders the form when the new password is too short", async () => {
		await requestReset(EMAIL);
		let token = tokenFromMail();

		let response = await submitReset(token, "short");

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("Use at least 8 characters.");
	});

	test("answers a submission carrying no token with the unusable-link page", async () => {
		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.password.reset.action.href()}`, {
				method: "POST",
				redirect: "manual",
				headers: { "content-type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({ password: NEW_PASSWORD, passwordConfirmation: NEW_PASSWORD }),
			}),
		);

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("This link no longer works");
	});
});
