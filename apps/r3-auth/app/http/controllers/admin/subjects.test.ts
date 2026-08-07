/**
 * Router-level tests for the three subject-administration pages: the paginated listing,
 * the detail page with its sessions and provider links, its three intents, and the
 * editor. The session-revocation tests also pin that a session id — which is a refresh
 * token — is accepted from the form without appearing in the rendered page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import type { TestApp } from "~/app/lib/test/http";
import type { Fixtures } from "~/app/lib/test/seed";

import Connection from "~/app/data/connection";
import Grant from "~/app/data/grant";
import Session from "~/app/data/session";
import Subject from "~/app/data/subject";
import { createTestApp } from "~/app/lib/test/http";
import { ORIGIN, seed, signIn } from "~/app/lib/test/seed";
import routes from "~/routes/web";

/** A Chrome-on-macOS agent, so the device label has something recognizable to derive. */
const DESKTOP_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

let app: TestApp;
let fixtures: Fixtures;

/** Promotes the seeded subject and signs the client in as them. */
async function signInAsAdmin(): Promise<void> {
	await Subject.update(app.db, fixtures.subjectId, { role: "admin" });
	await signIn(app, fixtures);
}

/** Fetches an admin URL without following redirects. */
async function get(path: string): Promise<Response> {
	return await app.fetch(new Request(`${ORIGIN}${path}`, { redirect: "manual" }));
}

/** Posts a form to an admin URL without following redirects. */
async function post(path: string, body: Record<string, string>): Promise<Response> {
	return await app.fetch(
		new Request(`${ORIGIN}${path}`, {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			redirect: "manual",
			body: new URLSearchParams(body),
		}),
	);
}

/** Registers a second subject, so the listing and the deletions have a target. */
async function createOtherSubject(suffix = "1"): Promise<string> {
	let subject = await Subject.create(app.db, {
		email_address: `other-${suffix}@example.com`,
		display_name: `Other Person ${suffix}`,
		username: `other${suffix}`,
		avatar: "https://example.com/other.png",
	});
	return subject.id;
}

beforeEach(async () => {
	app = await createTestApp();
	fixtures = await seed(app);
	await signInAsAdmin();
});

describe("GET /admin/subjects", () => {
	test("lists the registered subjects with their address and role", async () => {
		let response = await get(routes.admin.subjects.href());
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain("Jane Doe");
		expect(html).toContain("jane@example.com");
		expect(html).toContain("Admin");
		expect(html).toContain(routes.admin.subject.index.href({ subjectId: fixtures.subjectId }));
	});

	test("paginates at ten rows", async () => {
		for (let index = 0; index < 10; index++) await createOtherSubject(String(index));

		let first = await (await get(routes.admin.subjects.href())).text();
		expect(first).toContain('data-slot="pagination"');
		expect(first).toContain("?page=2");

		// Oldest first, so the seeded subject leads page one and the last filler is alone
		// on page two.
		expect(first).toContain("Jane Doe");

		let second = await (await get(`${routes.admin.subjects.href()}?page=2`)).text();
		expect(second).toContain("Other Person 9");
		expect(second).not.toContain("Jane Doe");
	});

	test("renders an empty state when the page holds nothing", async () => {
		let html = await (await get(`${routes.admin.subjects.href()}?page=99`)).text();

		expect(html).toContain("No users found");
	});
});

describe("GET /admin/subjects/:subjectId", () => {
	test("renders the profile, the sessions and the connected accounts", async () => {
		await Connection.create(app.db, "github", "MDQ6VXNlcjE=", fixtures.subjectId);

		let response = await get(routes.admin.subject.index.href({ subjectId: fixtures.subjectId }));
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain("Jane Doe");
		expect(html).toContain("jane@example.com");
		expect(html).toContain("Active Sessions");
		expect(html).toContain("Connected Accounts");
		expect(html).toContain("github");
		expect(html).toContain("MDQ6VXNlcjE=");
	});

	test("labels a session's device and names the client it belongs to", async () => {
		let other = await createOtherSubject();
		await Session.create(app.db, other, fixtures.clientId, "203.0.113.9", DESKTOP_AGENT);

		let html = await (await get(routes.admin.subject.index.href({ subjectId: other }))).text();

		expect(html).toContain("Chrome");
		expect(html).toContain("macOS");
		expect(html).toContain("203.0.113.9");
		expect(html).toContain("Client App");
	});

	test("shows an empty sessions state and no revoke-all for a subject with none", async () => {
		let other = await createOtherSubject();

		let html = await (await get(routes.admin.subject.index.href({ subjectId: other }))).text();

		expect(html).toContain("No active sessions");
		expect(html).not.toContain("Revoke all sessions");
		expect(html).toContain("No connected accounts");
	});

	test("offers revoke-all only once there is more than one session", async () => {
		let other = await createOtherSubject();
		await Session.create(app.db, other, fixtures.clientId, null, DESKTOP_AGENT);

		let one = await (await get(routes.admin.subject.index.href({ subjectId: other }))).text();
		expect(one).not.toContain("Revoke all sessions");

		await Session.create(app.db, other, fixtures.clientId, null, DESKTOP_AGENT);

		let two = await (await get(routes.admin.subject.index.href({ subjectId: other }))).text();
		expect(two).toContain("Revoke all sessions");
	});

	test("each confirmation is a native dialog holding a real form that posts the intent", async () => {
		let other = await createOtherSubject();
		await Session.create(app.db, other, fixtures.clientId, null, DESKTOP_AGENT);

		let html = await (await get(routes.admin.subject.index.href({ subjectId: other }))).text();

		// Opened by an Invoker Command rather than script, sealed against backdrop
		// dismissal, and answered by a form post rather than a fetch.
		expect(html).toContain('command="show-modal"');
		expect(html).toContain('role="alertdialog"');
		expect(html).toContain('closedby="closerequest"');
		expect(html).toContain('<form method="post"');

		// Regression guard: a button inside a form with no explicit type is a submit
		// button, and the platform ignores an Invoker Command on a submit button — so a
		// cancel control without `type="button"` silently does nothing. Asserted per
		// attribute rather than as one pattern, because their order in the tag is not
		// part of the contract.
		let cancel = html.match(/<button[^>]*command="close"[^>]*>/);
		expect(cancel?.[0]).toContain('type="button"');
	});

	test("the revoke dialog is keyed by row position, never by the session id", async () => {
		let other = await createOtherSubject();
		let session = await Session.create(app.db, other, fixtures.clientId, null, DESKTOP_AGENT);

		let html = await (await get(routes.admin.subject.index.href({ subjectId: other }))).text();

		// The id is that session's refresh token. It belongs in the posted field and
		// nowhere else — not in an element id a stray script could read off the DOM.
		expect(html).toContain('id="revoke-session-0"');
		expect(html).not.toContain(`id="revoke-session-${session.id}"`);
		expect(html).toContain(`value="${session.id}"`);
	});

	test("answers 404 for a subject that does not exist", async () => {
		let response = await get(
			routes.admin.subject.index.href({ subjectId: "00000000-0000-0000-0000-000000000000" }),
		);

		expect(response.status).toBe(404);
	});
});

describe("POST /admin/subjects/:subjectId", () => {
	test("intent=revoke-session revokes exactly that session", async () => {
		let other = await createOtherSubject();
		let kept = await Session.create(app.db, other, fixtures.clientId, null, DESKTOP_AGENT);
		let doomed = await Session.create(app.db, other, fixtures.clientId, null, DESKTOP_AGENT);

		let response = await post(routes.admin.subject.action.href({ subjectId: other }), {
			intent: "revoke-session",
			sessionId: doomed.id,
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(
			routes.admin.subject.index.href({ subjectId: other }),
		);
		expect(await Session.findById(app.db, doomed.id)).toBeNull();
		expect(await Session.findById(app.db, kept.id)).not.toBeNull();
	});

	test("intent=revoke-all-sessions clears every session for that subject only", async () => {
		let other = await createOtherSubject();
		await Session.create(app.db, other, fixtures.clientId, null, DESKTOP_AGENT);
		await Session.create(app.db, other, fixtures.clientId, null, DESKTOP_AGENT);
		let adminSessionsBefore = await Session.findBySubjectId(app.db, fixtures.subjectId);

		let response = await post(routes.admin.subject.action.href({ subjectId: other }), {
			intent: "revoke-all-sessions",
		});

		expect(response.status).toBe(303);
		expect(await Session.findBySubjectId(app.db, other)).toHaveLength(0);
		expect(await Session.findBySubjectId(app.db, fixtures.subjectId)).toHaveLength(
			adminSessionsBefore.length,
		);
	});

	test("intent=delete removes the subject with its sessions and grants", async () => {
		let other = await createOtherSubject();
		await Session.create(app.db, other, fixtures.clientId, null, DESKTOP_AGENT);
		await Grant.findOrCreate(app.db, other, fixtures.clientId);

		let response = await post(routes.admin.subject.action.href({ subjectId: other }), {
			intent: "delete",
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.admin.subjects.href());
		expect(await Subject.findById(app.db, other)).toBeNull();
		expect(await Session.findBySubjectId(app.db, other)).toHaveLength(0);
		expect(await Grant.findBySubjectId(app.db, other)).toHaveLength(0);
	});

	test("an unknown intent is refused and nothing is removed", async () => {
		let other = await createOtherSubject();
		await Session.create(app.db, other, fixtures.clientId, null, DESKTOP_AGENT);

		let response = await post(routes.admin.subject.action.href({ subjectId: other }), {
			intent: "impersonate",
		});

		expect(response.status).toBe(400);
		expect(await Subject.findById(app.db, other)).not.toBeNull();
		expect(await Session.findBySubjectId(app.db, other)).toHaveLength(1);
	});

	test("revoke-session without a session id is refused", async () => {
		let other = await createOtherSubject();
		await Session.create(app.db, other, fixtures.clientId, null, DESKTOP_AGENT);

		let response = await post(routes.admin.subject.action.href({ subjectId: other }), {
			intent: "revoke-session",
		});

		expect(response.status).toBe(400);
		expect(await Session.findBySubjectId(app.db, other)).toHaveLength(1);
	});
});

describe("/admin/subjects/:subjectId/edit", () => {
	test("GET fills the form and shows the address as read-only", async () => {
		let response = await get(
			routes.admin.subjectEdit.index.href({ subjectId: fixtures.subjectId }),
		);
		let html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain('value="Jane Doe"');
		expect(html).toContain('value="jane"');
		expect(html).toContain("readonly");
		expect(html).toContain('name="role"');
	});

	test("POST persists the edit and redirects to the detail page", async () => {
		let response = await post(
			routes.admin.subjectEdit.action.href({ subjectId: fixtures.subjectId }),
			{
				displayName: "Jane Q. Doe",
				username: "janeq",
				avatar: "https://example.com/new.png",
				role: "user",
			},
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(
			routes.admin.subject.index.href({ subjectId: fixtures.subjectId }),
		);

		let subject = await Subject.findById(app.db, fixtures.subjectId);
		expect(subject?.display_name).toBe("Jane Q. Doe");
		expect(subject?.username).toBe("janeq");
		expect(subject?.avatar).toBe("https://example.com/new.png");
		expect(subject?.role).toBe("user");
		// The address is not a field on this form, so it cannot have moved.
		expect(subject?.email_address).toBe("jane@example.com");
	});

	test("the email-verified box round trips in both directions", async () => {
		let other = await createOtherSubject();

		await post(routes.admin.subjectEdit.action.href({ subjectId: other }), {
			displayName: "Other Person 1",
			username: "other1",
			avatar: "https://example.com/other.png",
			role: "user",
			emailVerified: "on",
		});
		expect((await Subject.findById(app.db, other))?.email_verified_at).not.toBeNull();

		await post(routes.admin.subjectEdit.action.href({ subjectId: other }), {
			displayName: "Other Person 1",
			username: "other1",
			avatar: "https://example.com/other.png",
			role: "user",
		});
		expect((await Subject.findById(app.db, other))?.email_verified_at).toBeNull();
	});

	test("POST can promote a subject to admin", async () => {
		let other = await createOtherSubject();

		await post(routes.admin.subjectEdit.action.href({ subjectId: other }), {
			displayName: "Other Person 1",
			username: "other1",
			avatar: "https://example.com/other.png",
			role: "admin",
		});

		expect((await Subject.findById(app.db, other))?.role).toBe("admin");
	});

	test("POST refuses a role the enum does not contain", async () => {
		let response = await post(
			routes.admin.subjectEdit.action.href({ subjectId: fixtures.subjectId }),
			{
				displayName: "Jane Doe",
				username: "jane",
				avatar: "https://example.com/jane.png",
				role: "superuser",
			},
		);

		expect(response.status).toBe(400);
		expect((await Subject.findById(app.db, fixtures.subjectId))?.role).toBe("admin");
	});

	test("POST re-renders with a 400 when the avatar is not a URL", async () => {
		let response = await post(
			routes.admin.subjectEdit.action.href({ subjectId: fixtures.subjectId }),
			{
				displayName: "Jane Doe",
				username: "jane",
				avatar: "nope",
				role: "admin",
			},
		);

		expect(response.status).toBe(400);
		expect((await Subject.findById(app.db, fixtures.subjectId))?.avatar).toBe(
			"https://example.com/jane.png",
		);
	});

	test("GET answers 404 for a subject that does not exist", async () => {
		let response = await get(
			routes.admin.subjectEdit.index.href({ subjectId: "00000000-0000-0000-0000-000000000000" }),
		);

		expect(response.status).toBe(404);
	});
});
