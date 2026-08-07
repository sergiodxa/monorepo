/**
 * Router-level tests of the profile view and its edit form: what the page shows, that
 * the guard covers both, and every outcome the update can have — saved, rejected by the
 * validator with the typing preserved, and refused because the username is taken.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import Subject from "~/app/data/subject";
import { createTestApp } from "~/app/lib/test/http";
import { EMAIL, ORIGIN, seed, signIn } from "~/app/lib/test/seed";
import routes from "~/routes/web";

let app: TestApp;
let fixtures: Fixtures;

beforeEach(async () => {
	app = await createTestApp();
	fixtures = await seed(app);
});

/** Posts the edit form with the given fields, without following the redirect. */
async function submitEdit(fields: Record<string, string>): Promise<Response> {
	return await app.fetch(
		new Request(`${ORIGIN}${routes.account.profileEdit.action.href()}`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			redirect: "manual",
			body: new URLSearchParams(fields),
		}),
	);
}

describe("GET /account/profile", () => {
	test("redirects a request with no session to /authorize", async () => {
		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.account.profile.href()}`, { redirect: "manual" }),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.authorize.index.href());
	});

	test("shows the signed-in subject's name, username and email", async () => {
		await signIn(app, fixtures);

		let response = await app.fetch(new Request(`${ORIGIN}${routes.account.profile.href()}`));
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain("Jane Doe");
		expect(html).toContain("@jane");
		expect(html).toContain(EMAIL);
		expect(html).toContain(routes.account.profileEdit.index.href());
	});

	test("marks its own navigation link as the current page", async () => {
		await signIn(app, fixtures);

		let response = await app.fetch(new Request(`${ORIGIN}${routes.account.profile.href()}`));
		let html = await response.text();

		expect(html).toContain(`href="${routes.account.profile.href()}" aria-current="page"`);
	});

	test("offers the admin link only to an admin", async () => {
		await signIn(app, fixtures);

		let asUser = await (
			await app.fetch(new Request(`${ORIGIN}${routes.account.profile.href()}`))
		).text();
		expect(asUser).not.toContain(routes.admin.dashboard.href());

		let { subjects } = await import("~/database/schema");
		await app.db.updateMany(subjects, { role: "admin" }, { where: { id: fixtures.subjectId } });

		let asAdmin = await (
			await app.fetch(new Request(`${ORIGIN}${routes.account.profile.href()}`))
		).text();
		expect(asAdmin).toContain(routes.admin.dashboard.href());
	});
});

describe("GET /account/profile/edit", () => {
	test("redirects a request with no session to /authorize", async () => {
		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.account.profileEdit.index.href()}`, { redirect: "manual" }),
		);

		expect(response.status).toBe(303);
	});

	test("pre-fills the form from the stored row", async () => {
		await signIn(app, fixtures);

		let response = await app.fetch(
			new Request(`${ORIGIN}${routes.account.profileEdit.index.href()}`),
		);
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain('value="Jane Doe"');
		expect(html).toContain('value="jane"');
		expect(html).toContain('value="https://example.com/jane.png"');
	});
});

describe("POST /account/profile/edit", () => {
	test("saves the three editable fields and redirects to the profile", async () => {
		await signIn(app, fixtures);

		let response = await submitEdit({
			displayName: "Jane R. Doe",
			username: "janedoe",
			avatar: "https://example.com/new.png",
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.account.profile.href());

		let subject = await Subject.findById(app.db, fixtures.subjectId);
		expect(subject?.display_name).toBe("Jane R. Doe");
		expect(subject?.username).toBe("janedoe");
		expect(subject?.avatar).toBe("https://example.com/new.png");
	});

	test("never changes the email address, even when the form carries one", async () => {
		await signIn(app, fixtures);

		await submitEdit({
			displayName: "Jane Doe",
			username: "jane",
			avatar: "https://example.com/jane.png",
			email: "attacker@example.com",
			role: "admin",
		});

		let subject = await Subject.findById(app.db, fixtures.subjectId);
		expect(subject?.email_address).toBe(EMAIL);
		expect(subject?.role).toBe("user");
	});

	test("re-renders with the submitted values when the avatar is not a URL", async () => {
		await signIn(app, fixtures);

		let response = await submitEdit({
			displayName: "Jane Kept",
			username: "jane",
			avatar: "not-a-url",
		});
		let html = await response.text();

		expect(response.status).toBe(400);
		// The typing survives the rejection rather than the form resetting to stored values.
		expect(html).toContain('value="Jane Kept"');
		expect(html).toContain('value="not-a-url"');

		let subject = await Subject.findById(app.db, fixtures.subjectId);
		expect(subject?.display_name).toBe("Jane Doe");
	});

	test("re-renders when the display name is empty", async () => {
		await signIn(app, fixtures);

		let response = await submitEdit({
			displayName: "",
			username: "jane",
			avatar: "https://example.com/jane.png",
		});

		expect(response.status).toBe(400);

		let subject = await Subject.findById(app.db, fixtures.subjectId);
		expect(subject?.display_name).toBe("Jane Doe");
	});

	test("reports a username somebody else already holds instead of failing", async () => {
		await Subject.create(app.db, {
			email_address: "other@example.com",
			display_name: "Other Person",
			username: "taken",
			avatar: "https://example.com/other.png",
		});

		await signIn(app, fixtures);

		let response = await submitEdit({
			displayName: "Jane Doe",
			username: "taken",
			avatar: "https://example.com/jane.png",
		});
		let html = await response.text();

		expect(response.status).toBe(400);
		expect(html).toContain("already taken");

		let subject = await Subject.findById(app.db, fixtures.subjectId);
		expect(subject?.username).toBe("jane");
	});

	test("redirects an unauthenticated post without touching anything", async () => {
		let response = await submitEdit({
			displayName: "Nobody",
			username: "nobody",
			avatar: "https://example.com/nobody.png",
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.authorize.index.href());

		let subject = await Subject.findById(app.db, fixtures.subjectId);
		expect(subject?.display_name).toBe("Jane Doe");
	});
});
