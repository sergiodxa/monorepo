/**
 * Router-level tests of the session guards. A stub page is mapped onto test-only URLs
 * and protected by the real middleware, so the redirects, the silent access-token
 * refresh, and the role check are exercised through the whole middleware chain rather
 * than called directly, and without observing whichever real page shares a URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok } from "@pkg/http/response/json";
import { getContext } from "remix/middleware/async-context";
import { get, route } from "remix/routes";
import { beforeEach, describe, expect, test } from "vitest";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import { createTestApp } from "~/app/lib/test/http";
import { ORIGIN, seed, signIn } from "~/app/lib/test/seed";
import routes from "~/routes/web";

/**
 * The two guards under test, imported after the harness above rather than alongside it.
 *
 * The harness installs the `cloudflare:workers` bindings as it loads, and a module only
 * sees them if it loads afterwards. A static import here would sort before the harness
 * and pull the guards — and every service they reach — in against the default binding
 * stub instead; the app built below would then reuse those same cached modules, and the
 * sign-in the tests drive would fail inside them rather than at any assertion.
 */
let { default: requireSubject } = await import("~/app/http/middleware/require-subject");
let { default: requireAdmin } = await import("~/app/http/middleware/require-admin");

/**
 * URLs that exist only for these tests.
 *
 * The guards are mapped onto routes of their own rather than onto the real account and
 * admin pages, so what each test observes is the guard's own answer and not whichever
 * page happens to be mapped there. The chain a request passes through is the real one
 * either way — these routes are added to the app's own router.
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

		// An access token already past its refresh threshold, paired with a session row
		// that has been revoked: the guard must refresh, fail, and sign out.
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

		// The first request refreshes. If the new token were not written back to the
		// session, the second would refresh again — and would still succeed — so the
		// session row's revocation between them is what makes the assertion sharp: only a
		// stored, still-valid access token can carry the second request through.
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

		// The row the presented token names is still there and was touched, rather than a
		// new row having been created under a new id. Anything else would silently break
		// every client holding this refresh token.
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
