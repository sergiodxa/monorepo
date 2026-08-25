/**
 * Router-level tests for the admin dashboard and for the boundary around the whole
 * area: the counts it renders, and the guard that sends a signed-in non-admin to their
 * own account. The guard reads the role from the database on every request, so a
 * demotion takes effect on the next one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "vitest";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import Client from "~/app/data/client";
import Subject from "~/app/data/subject";
import { createTestApp } from "~/app/lib/test/http";
import { ORIGIN, seed, signIn } from "~/app/lib/test/seed";
import routes from "~/routes/web";

let app: TestApp;
let fixtures: Fixtures;

/** Promotes the seeded subject and signs the client in as them. */
async function signInAsAdmin(): Promise<void> {
	await Subject.update(app.db, fixtures.subjectId, { role: "admin" });
	await signIn(app, fixtures);
}

/** Fetches an admin URL, returning a guard's redirect as the response. */
async function get(path: string): Promise<Response> {
	return await app.fetch(new Request(`${ORIGIN}${path}`, { redirect: "manual" }));
}

beforeEach(async () => {
	app = await createTestApp();
	fixtures = await seed(app);
});

describe("GET /admin", () => {
	test("renders the client, subject and active-session counts", async () => {
		await signInAsAdmin();

		let response = await get(routes.admin.dashboard.href());
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain("Total Clients");
		expect(html).toContain("Total Users");
		expect(html).toContain("Active Sessions");
		expect(html).toContain(">1<");
	});

	test("counts every registered client", async () => {
		await Client.create(app.db, {
			name: "Second App",
			redirect_uri: "https://second.example.com/callback",
			logout_uri: "https://second.example.com/logout",
		});
		await signInAsAdmin();

		let html = await (await get(routes.admin.dashboard.href())).text();

		expect(html).toContain(">2<");
	});

	test("carries the admin navigation and the current-section marker", async () => {
		await signInAsAdmin();

		let html = await (await get(routes.admin.dashboard.href())).text();

		expect(html).toContain("Admin navigation");
		expect(html).toContain('aria-current="page"');
		expect(html).toContain(routes.admin.clients.index.href());
		expect(html).toContain(routes.admin.subjects.href());
	});
});

describe("requireAdmin", () => {
	test("redirects a signed-in non-admin subject to /account/sessions", async () => {
		await signIn(app, fixtures);

		let response = await get(routes.admin.dashboard.href());

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.account.sessions.index.href());
	});

	test("refuses a non-admin on every admin URL, not only the dashboard", async () => {
		await signIn(app, fixtures);

		for (let path of [
			routes.admin.clients.index.href(),
			routes.admin.clientNew.index.href(),
			routes.admin.client.index.href({ clientId: fixtures.clientId }),
			routes.admin.clientEdit.index.href({ clientId: fixtures.clientId }),
			routes.admin.subjects.href(),
			routes.admin.subject.index.href({ subjectId: fixtures.subjectId }),
			routes.admin.subjectEdit.index.href({ subjectId: fixtures.subjectId }),
		]) {
			let response = await get(path);
			expect(response.status).toBe(303);
			expect(response.headers.get("location")).toBe(routes.account.sessions.index.href());
		}
	});

	test("sends an unauthenticated visitor to /authorize instead", async () => {
		let response = await get(routes.admin.dashboard.href());

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.authorize.index.href());
	});

	test("a subject demoted after signing in loses access on the next request", async () => {
		await signInAsAdmin();
		expect((await get(routes.admin.dashboard.href())).status).toBe(200);

		await Subject.update(app.db, fixtures.subjectId, { role: "user" });

		expect((await get(routes.admin.dashboard.href())).status).toBe(303);
	});
});
