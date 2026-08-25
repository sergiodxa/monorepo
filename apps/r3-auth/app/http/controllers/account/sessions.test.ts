/**
 * Router-level tests of the device list and its two revocations. The cases that matter
 * most are the ones where a session id is a live refresh token: revoking the current one
 * must end the browser session too, and a submitted id belonging to somebody else must
 * leave it alone and answer exactly as an already-revoked id does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "vitest";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import Session from "~/app/data/session";
import Subject from "~/app/data/subject";
import { createTestApp } from "~/app/lib/test/http";
import { ORIGIN, seed, signIn } from "~/app/lib/test/seed";
import routes from "~/routes/web";

let app: TestApp;
let fixtures: Fixtures;

beforeEach(async () => {
	app = await createTestApp();
	fixtures = await seed(app);
});

/** Posts an intent to the sessions page, returning the redirect response itself. */
async function post(fields: Record<string, string>): Promise<Response> {
	return await app.fetch(
		new Request(`${ORIGIN}${routes.account.sessions.action.href()}`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			redirect: "manual",
			body: new URLSearchParams(fields),
		}),
	);
}

/** Opens an extra session for the seeded subject, standing in for another device. */
async function extraSession(ua: string, ip: string): Promise<string> {
	let session = await Session.create(app.db, fixtures.subjectId, fixtures.clientId, ip, ua);
	return session.id;
}

describe("GET /account/sessions", () => {
	test("redirects a request with no session to /authorize", async () => {
		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.account.sessions.index.href()}`, { redirect: "manual" }),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.authorize.index.href());
	});

	test("lists each session with its parsed device, address and client", async () => {
		await signIn(app, fixtures);
		await extraSession(
			"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
			"203.0.113.7",
		);

		let response = await app.fetch(new Request(`${ORIGIN}${routes.account.sessions.index.href()}`));
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain("Safari");
		expect(html).toContain("iOS");
		expect(html).toContain("Mobile");
		expect(html).toContain("203.0.113.7");
		expect(html).toContain("Client App");
	});

	test("marks exactly one row as the current session", async () => {
		await signIn(app, fixtures);
		await extraSession("Mozilla/5.0 (Macintosh) Chrome/120.0 Safari/537.36", "198.51.100.4");

		let html = await (
			await app.fetch(new Request(`${ORIGIN}${routes.account.sessions.index.href()}`))
		).text();

		expect(html.split("Your current session").length - 1).toBe(1);
	});

	test("is never stored: the page carries one live refresh token per row", async () => {
		await signIn(app, fixtures);

		let response = await app.fetch(new Request(`${ORIGIN}${routes.account.sessions.index.href()}`));

		expect(response.headers.get("cache-control")).toContain("no-store");
	});

	test("says so when the subject holds no session", async () => {
		let tokens = await signIn(app, fixtures);
		await Session.deleteById(app.db, tokens.refresh_token);

		let html = await (
			await app.fetch(new Request(`${ORIGIN}${routes.account.sessions.index.href()}`))
		).text();

		expect(html).toContain("No active sessions found.");
	});

	test("opens a confirmation dialog per row rather than shipping script", async () => {
		await signIn(app, fixtures);

		let html = await (
			await app.fetch(new Request(`${ORIGIN}${routes.account.sessions.index.href()}`))
		).text();

		expect(html).toContain('command="show-modal"');
		expect(html).toContain("<dialog");
		expect(html).toContain('role="alertdialog"');
		expect(html).not.toContain("confirm(");
	});
});

describe("POST /account/sessions intent=revoke", () => {
	test("revokes another device's session and stays signed in", async () => {
		await signIn(app, fixtures);
		let other = await extraSession("Mozilla/5.0 (X11; Linux) Firefox/121.0", "192.0.2.9");

		let response = await post({ intent: "revoke", sessionId: other });

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.account.sessions.index.href());
		expect(response.headers.get("clear-site-data")).toBeNull();
		expect(await Session.findById(app.db, other)).toBeNull();

		let after = await app.fetch(new Request(`${ORIGIN}${routes.account.sessions.index.href()}`));
		expect(after.status).toBe(200);
	});

	test("revoking the current session signs the browser out and clears its cookies", async () => {
		let tokens = await signIn(app, fixtures);
		await extraSession("Mozilla/5.0 (X11; Linux) Firefox/121.0", "192.0.2.9");

		let response = await post({ intent: "revoke", sessionId: tokens.refresh_token });

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.authorize.index.href());
		expect(response.headers.get("clear-site-data")).toBe('"cookies"');
		expect(await Session.findById(app.db, tokens.refresh_token)).toBeNull();

		let after = await app.fetch(
			new Request(`${ORIGIN}${routes.account.sessions.index.href()}`, { redirect: "manual" }),
		);
		expect(after.status).toBe(303);
		expect(after.headers.get("location")).toBe(routes.authorize.index.href());
	});

	test("revoking the last remaining session signs the browser out", async () => {
		let tokens = await signIn(app, fixtures);

		let response = await post({ intent: "revoke", sessionId: tokens.refresh_token });

		expect(response.headers.get("clear-site-data")).toBe('"cookies"');
	});

	test("refuses a session id belonging to another subject", async () => {
		let victim = await Subject.create(app.db, {
			email_address: "victim@example.com",
			display_name: "Victim",
			username: "victim",
			avatar: "https://example.com/victim.png",
		});
		let victimSession = await Session.create(
			app.db,
			victim.id,
			fixtures.clientId,
			"192.0.2.1",
			"Mozilla/5.0",
		);

		await signIn(app, fixtures);

		let response = await post({ intent: "revoke", sessionId: victimSession.id });

		expect(response.status).toBe(303);
		expect(await Session.findById(app.db, victimSession.id)).not.toBeNull();
	});

	test("accepts an id that no longer exists without erroring", async () => {
		await signIn(app, fixtures);

		let response = await post({
			intent: "revoke",
			sessionId: "00000000-0000-4000-8000-000000000000",
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.account.sessions.index.href());
	});

	test("ignores a submission naming no intent it knows", async () => {
		await signIn(app, fixtures);
		let other = await extraSession("Mozilla/5.0 (X11; Linux) Firefox/121.0", "192.0.2.9");

		let response = await post({ intent: "delete-everything", sessionId: other });

		expect(response.status).toBe(303);
		expect(await Session.findById(app.db, other)).not.toBeNull();
	});
});

describe("POST /account/sessions intent=revoke-all", () => {
	test("revokes every other session and keeps the current one", async () => {
		let tokens = await signIn(app, fixtures);
		let first = await extraSession("Mozilla/5.0 (X11; Linux) Firefox/121.0", "192.0.2.9");
		let second = await extraSession("Mozilla/5.0 (Macintosh) Chrome/120.0", "192.0.2.10");

		let response = await post({ intent: "revoke-all" });

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.account.sessions.index.href());
		expect(response.headers.get("clear-site-data")).toBeNull();
		expect(await Session.findById(app.db, first)).toBeNull();
		expect(await Session.findById(app.db, second)).toBeNull();
		expect(await Session.findById(app.db, tokens.refresh_token)).not.toBeNull();
	});

	test("signs the browser out when its own session row was already gone", async () => {
		let tokens = await signIn(app, fixtures);
		await extraSession("Mozilla/5.0 (X11; Linux) Firefox/121.0", "192.0.2.9");
		await Session.deleteById(app.db, tokens.refresh_token);

		let response = await post({ intent: "revoke-all" });

		expect(response.headers.get("location")).toBe(routes.authorize.index.href());
		expect(response.headers.get("clear-site-data")).toBe('"cookies"');
	});

	test("never touches another subject's sessions", async () => {
		let bystander = await Subject.create(app.db, {
			email_address: "bystander@example.com",
			display_name: "Bystander",
			username: "bystander",
			avatar: "https://example.com/bystander.png",
		});
		let theirs = await Session.create(
			app.db,
			bystander.id,
			fixtures.clientId,
			"192.0.2.2",
			"Mozilla/5.0",
		);

		await signIn(app, fixtures);
		await post({ intent: "revoke-all" });

		expect(await Session.findById(app.db, theirs.id)).not.toBeNull();
	});
});
