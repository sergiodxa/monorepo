/**
 * Router-level tests of the session guards. A stub page is mapped onto the real
 * account and admin URLs and protected by the real middleware, so the redirects, the
 * silent access-token refresh, and the role check are exercised through the whole
 * middleware chain rather than called directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import { ok } from "@pkg/http/response/json";
import { getContext } from "remix/async-context-middleware";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import requireAdmin from "~/app/http/middleware/require-admin";
import requireSubject from "~/app/http/middleware/require-subject";
import { createTestApp } from "~/app/lib/test/http";
import { ORIGIN, seed, signIn } from "~/app/lib/test/seed";
import routes from "~/routes/web";

let app: TestApp;
let fixtures: Fixtures;

/** Answers with the subject the guard resolved, so a test can assert who got through. */
function whoami() {
	return ok({ id: getContext().subject.id, role: getContext().subject.role });
}

beforeEach(async () => {
	app = await createTestApp();
	fixtures = await seed(app);

	app.router.map(routes.account.sessions.index, {
		middleware: [requireSubject],
		handler: whoami,
	});

	app.router.map(routes.admin.dashboard, {
		middleware: [requireAdmin],
		handler: whoami,
	});
});

describe("requireSubject", () => {
	test("redirects an unauthenticated request to /authorize", async () => {
		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.account.sessions.index.href()}`, { redirect: "manual" }),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.authorize.index.href());
	});

	test("lets a signed-in subject through and publishes them on the context", async () => {
		await signIn(app, fixtures);

		let response = await app.fetch(new Request(`${ORIGIN}${routes.account.sessions.index.href()}`));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ id: fixtures.subjectId, role: "user" });
	});

	test("signs the session out when its subject no longer exists", async () => {
		await signIn(app, fixtures);

		let { default: Subject } = await import("~/app/data/subject");
		await Subject.delete(app.db, fixtures.subjectId);

		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.account.sessions.index.href()}`, { redirect: "manual" }),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.authorize.index.href());
	});

	test("signs the session out when the refresh token no longer resolves", async () => {
		let tokens = await signIn(app, fixtures);

		// An access token already past its refresh threshold, paired with a session row
		// that has been revoked: the guard must refresh, fail, and sign out.
		let { default: Session } = await import("~/app/data/session");
		await Session.deleteById(app.db, tokens.refresh_token);
		await app.signIn(expiredAccessToken(fixtures.subjectId), tokens.refresh_token);

		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.account.sessions.index.href()}`, { redirect: "manual" }),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.authorize.index.href());
	});

	test("refreshes an expiring access token and carries on", async () => {
		let tokens = await signIn(app, fixtures);
		await app.signIn(expiredAccessToken(fixtures.subjectId), tokens.refresh_token);

		let response = await app.fetch(new Request(`${ORIGIN}${routes.account.sessions.index.href()}`));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ id: fixtures.subjectId, role: "user" });
	});
});

describe("requireAdmin", () => {
	test("redirects an unauthenticated request to /authorize", async () => {
		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.admin.dashboard.href()}`, { redirect: "manual" }),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.authorize.index.href());
	});

	test("redirects a signed-in non-admin to their own account", async () => {
		await signIn(app, fixtures);

		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.admin.dashboard.href()}`, { redirect: "manual" }),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.account.sessions.index.href());
	});

	test("lets an admin through", async () => {
		let { subjects } = await import("~/database/schema");
		await app.db.updateMany(subjects, { role: "admin" }, { where: { id: fixtures.subjectId } });

		await signIn(app, fixtures);

		let response = await app.fetch(new Request(`${ORIGIN}${routes.admin.dashboard.href()}`));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ id: fixtures.subjectId, role: "admin" });
	});
});

/**
 * An unsigned access token whose `exp` is already in the past.
 *
 * The guard reads its own session's token without verifying the signature — it never
 * left the signed session record — so a payload is all this needs to drive the
 * "expiring soon" branch.
 */
function expiredAccessToken(subjectId: string): string {
	let payload = {
		sub: subjectId,
		exp: Math.floor(Date.now() / 1000) - 60,
		iat: Math.floor(Date.now() / 1000) - 3660,
		iss: "auth.sergiodxa.com",
		aud: "client",
	};

	let encode = (value: object) =>
		btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");

	return `${encode({ alg: "ES256", typ: "JWT" })}.${encode(payload)}.signature`;
}
