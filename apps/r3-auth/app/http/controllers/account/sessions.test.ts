/**
 * Router-level tests of the device list and its two revocations. The cases that matter
 * most are the ones where a session id is a live refresh token: revoking the current one
 * must end the browser session too, and a submitted id belonging to somebody else must
 * leave it alone and answer exactly as an already-revoked id does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

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
	let session = unwrap(
		await app.models.sessions.create({
			subject_id: fixtures.subjectId,
			client_id: fixtures.clientId,
			ip_address: ip,
			user_agent: ua,
		}),
	);
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

	/**
	 * The layout's header carries the page title as the one `<h1>`, so the card repeating
	 * it sits a level below and the document outline names the page once.
	 */
	test("names the page with a single level-one heading", async () => {
		await signIn(app, fixtures);

		let html = await (
			await app.fetch(new Request(`${ORIGIN}${routes.account.sessions.index.href()}`))
		).text();

		expect(html.match(/<h1\b/g)).toHaveLength(1);
		expect(html).toMatch(/<h2\b[^>]*>\s*Sessions\s*</);
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
		await app.models.sessions.delete(tokens.refresh_token);

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
		expect(await app.models.sessions.find(other)).toBeNull();

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
		expect(await app.models.sessions.find(tokens.refresh_token)).toBeNull();

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
		let victim = unwrap(
			await app.models.subjects.create({
				email_address: "victim@example.com",
				display_name: "Victim",
				username: "victim",
				avatar: "https://example.com/victim.png",
			}),
		);
		let victimSession = unwrap(
			await app.models.sessions.create({
				subject_id: victim.id,
				client_id: fixtures.clientId,
				ip_address: "192.0.2.1",
				user_agent: "Mozilla/5.0",
			}),
		);

		await signIn(app, fixtures);

		let response = await post({ intent: "revoke", sessionId: victimSession.id });

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.account.sessions.index.href());
		expect(await app.models.sessions.find(victimSession.id)).not.toBeNull();
	});

	test("refuses another subject's session to an admin as well", async () => {
		let victim = unwrap(
			await app.models.subjects.create({
				email_address: "victim@example.com",
				display_name: "Victim",
				username: "victim",
				avatar: "https://example.com/victim.png",
			}),
		);
		let victimSession = unwrap(
			await app.models.sessions.create({
				subject_id: victim.id,
				client_id: fixtures.clientId,
				ip_address: "192.0.2.1",
				user_agent: "Mozilla/5.0",
			}),
		);
		unwrap(await app.models.subjects.update(fixtures.subjectId, { role: "admin" }));

		await signIn(app, fixtures);

		let response = await post({ intent: "revoke", sessionId: victimSession.id });

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.account.sessions.index.href());
		expect(await app.models.sessions.find(victimSession.id)).not.toBeNull();
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
		expect(await app.models.sessions.find(other)).not.toBeNull();
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
		expect(await app.models.sessions.find(first)).toBeNull();
		expect(await app.models.sessions.find(second)).toBeNull();
		expect(await app.models.sessions.find(tokens.refresh_token)).not.toBeNull();
	});

	test("signs the browser out when its own session row was already gone", async () => {
		let tokens = await signIn(app, fixtures);
		await extraSession("Mozilla/5.0 (X11; Linux) Firefox/121.0", "192.0.2.9");
		await app.models.sessions.delete(tokens.refresh_token);

		let response = await post({ intent: "revoke-all" });

		expect(response.headers.get("location")).toBe(routes.authorize.index.href());
		expect(response.headers.get("clear-site-data")).toBe('"cookies"');
	});

	test("never touches another subject's sessions", async () => {
		let bystander = unwrap(
			await app.models.subjects.create({
				email_address: "bystander@example.com",
				display_name: "Bystander",
				username: "bystander",
				avatar: "https://example.com/bystander.png",
			}),
		);
		let theirs = unwrap(
			await app.models.sessions.create({
				subject_id: bystander.id,
				client_id: fixtures.clientId,
				ip_address: "192.0.2.2",
				user_agent: "Mozilla/5.0",
			}),
		);

		await signIn(app, fixtures);
		await post({ intent: "revoke-all" });

		expect(await app.models.sessions.find(theirs.id)).not.toBeNull();
	});
});
