/**
 * Router-level tests of the session guards. A stub page is mapped onto test-only URLs
 * and protected by the real middleware, exercising the redirects, the silent
 * access-token refresh, and the role check through the whole middleware chain while
 * observing only the guard's own behavior at each URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok } from "@sdxc/http/response/json";
import { getContext } from "remix/middleware/async-context";
import { get, route } from "remix/routes";
import { beforeEach, describe, expect, test } from "vitest";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import { createTestApp } from "~/app/lib/test/http";
import { ORIGIN, seed, signIn } from "~/app/lib/test/seed";
import routes from "~/routes/web";

/**
 * A dynamic import loads these guards only after the test harness below installs the
 * `cloudflare:workers` bindings, so every service they reach binds to the harness's
 * own stubs from the start.
 */
let { default: requireSubject } = await import("~/app/http/middleware/require-subject");
let { default: requireAdmin } = await import("~/app/http/middleware/require-admin");

/**
 * Dedicated routes for these tests isolate each test's observation to the guard's own
 * answer, while the request still travels through the app's real router and
 * middleware chain.
 */
const guarded = route({
	subject: get("/__test/require-subject"),
	admin: get("/__test/require-admin"),
});

let app: TestApp;
let fixtures: Fixtures;

/** Answers with the subject the guard resolved, so a test can assert who got through. */
function whoami() {
	return ok({ id: getContext().subject.id, role: getContext().subject.role });
}

beforeEach(async () => {
	app = await createTestApp();
	fixtures = await seed(app);

	app.router.map(guarded.subject, { middleware: [requireSubject], handler: whoami });
	app.router.map(guarded.admin, { middleware: [requireAdmin], handler: whoami });
});

describe("requireSubject", () => {
	test("redirects an unauthenticated request to /authorize", async () => {
		let response = await app.fetch(
			new Request(`${ORIGIN}${guarded.subject.href()}`, { redirect: "manual" }),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.authorize.index.href());
	});

	test("lets a signed-in subject through and publishes them on the context", async () => {
		await signIn(app, fixtures);

		let response = await app.fetch(new Request(`${ORIGIN}${guarded.subject.href()}`));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ id: fixtures.subjectId, role: "user" });
	});

	test("signs the session out when its subject no longer exists", async () => {
		await signIn(app, fixtures);

		let { default: Subject } = await import("~/app/data/subject");
		await Subject.delete(app.db, fixtures.subjectId);

		let response = await app.fetch(
			new Request(`${ORIGIN}${guarded.subject.href()}`, { redirect: "manual" }),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.authorize.index.href());
	});

	test("signs the session out when the refresh token no longer resolves", async () => {
		let tokens = await signIn(app, fixtures);

		/**
		 * An access token already past its refresh threshold, paired with a session row
		 * that has been revoked, drives the guard through refresh, failure, and sign-out.
		 */
		let { default: Session } = await import("~/app/data/session");
		await Session.deleteById(app.db, tokens.refresh_token);
		await app.signIn(expiredAccessToken(fixtures.subjectId), tokens.refresh_token);

		let response = await app.fetch(
			new Request(`${ORIGIN}${guarded.subject.href()}`, { redirect: "manual" }),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.authorize.index.href());
	});

	test("refreshes an expiring access token and carries on", async () => {
		let tokens = await signIn(app, fixtures);
		await app.signIn(expiredAccessToken(fixtures.subjectId), tokens.refresh_token);

		let response = await app.fetch(new Request(`${ORIGIN}${guarded.subject.href()}`));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ id: fixtures.subjectId, role: "user" });
	});

	test("the refresh writes a usable access token back, so the next request needs none", async () => {
		let tokens = await signIn(app, fixtures);
		await app.signIn(expiredAccessToken(fixtures.subjectId), tokens.refresh_token);

		/**
		 * The refreshed token must persist to the session: the row is revoked between
		 * requests here, so only a previously stored, still-valid token can carry the
		 * second request through.
		 */
		expect((await app.fetch(new Request(`${ORIGIN}${guarded.subject.href()}`))).status).toBe(200);

		let { default: Session } = await import("~/app/data/session");
		await Session.deleteById(app.db, tokens.refresh_token);

		let second = await app.fetch(
			new Request(`${ORIGIN}${guarded.subject.href()}`, { redirect: "manual" }),
		);

		expect(second.status).toBe(200);
	});

	test("the refresh keeps the same refresh token, since it is the session row's id", async () => {
		let tokens = await signIn(app, fixtures);
		await app.signIn(expiredAccessToken(fixtures.subjectId), tokens.refresh_token);

		let { default: Session } = await import("~/app/data/session");
		let before = await Session.findById(app.db, tokens.refresh_token);

		await app.fetch(new Request(`${ORIGIN}${guarded.subject.href()}`));

		/**
		 * The row keyed by the presented token stays in place and only its timestamp
		 * updates, since replacing it with a new id would silently break every client
		 * holding this refresh token.
		 */
		let after = await Session.findById(app.db, tokens.refresh_token);
		expect(after).not.toBeNull();
		expect(after?.updated_at).toBeGreaterThanOrEqual(before?.updated_at ?? 0);
		expect(await Session.findBySubjectId(app.db, fixtures.subjectId)).toHaveLength(1);
	});
});

describe("requireAdmin", () => {
	test("redirects an unauthenticated request to /authorize", async () => {
		let response = await app.fetch(
			new Request(`${ORIGIN}${guarded.admin.href()}`, { redirect: "manual" }),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.authorize.index.href());
	});

	test("redirects a signed-in non-admin to their own account", async () => {
		await signIn(app, fixtures);

		let response = await app.fetch(
			new Request(`${ORIGIN}${guarded.admin.href()}`, { redirect: "manual" }),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.account.sessions.index.href());
	});

	test("lets an admin through", async () => {
		let { subjects } = await import("~/database/schema");
		await app.db.updateMany(subjects, { role: "admin" }, { where: { id: fixtures.subjectId } });

		await signIn(app, fixtures);

		let response = await app.fetch(new Request(`${ORIGIN}${guarded.admin.href()}`));

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ id: fixtures.subjectId, role: "admin" });
	});
});

/**
 * An unsigned access token whose `exp` is already in the past.
 *
 * The guard trusts its own session's token as already verified, since it never left
 * the signed session record — a bare payload is what drives the "expiring soon" branch.
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
