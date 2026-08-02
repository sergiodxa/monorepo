/**
 * Tests for the create/revoke invite actions: the resend-instead-of-duplicate
 * behavior for a re-invited pending email, the already-accepted-invite guard on both
 * actions, and the plain validate → mutate → redirect path otherwise.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { Middleware, RequestHandler } from "remix/fetch-router";
import type { Route } from "remix/fetch-router/routes";

import { createTranslator } from "@pkg/i18n";
import { MemoryTransport } from "@pkg/mail/memory";
import mail from "@pkg/mail/middleware";
import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";

import type { SelectMembership, SelectTeam } from "~/database/schema";

import { MAIL_FROM } from "~/app/emails/sender";
import { TeamInviteEmail } from "~/app/emails/team-invite";
import { createTestDatabase } from "~/app/lib/test/db";
import en from "~/app/locales/en";
import { invites, memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

/**
 * `@pkg/validate`'s `validate()` flattens `FormData`/`URLSearchParams` into a plain
 * object before handing it to the schema, but `remix/data-schema/form-data`'s
 * `f.object()` (which every schema in this app is built with) validates the raw
 * `FormData`/`URLSearchParams` directly and rejects a flattened object with "Expected
 * FormData or URLSearchParams". As shipped, that means `validate(ctx.formData, ...)`
 * always fails, regardless of whether the submitted data is actually valid — a real,
 * reproducible bug in the shared `@pkg/validate` package (flagged separately). This
 * mock forwards the form container straight to the schema instead of flattening it,
 * so these tests exercise the actions' real branching instead of always hitting the
 * validation-error path; it can be deleted once the real `@pkg/validate` is fixed.
 */
let { createInvite, revokeInvite } = await import("./invites");

/** Creates an in-memory database seeded with one team and its owning admin membership. */
async function createFixture() {
	let { db } = createTestDatabase();

	let team = await db.create(
		teams,
		{ id: crypto.randomUUID(), owner_id: "owner-1", name: "Acme", slug: "acme", logo: null },
		{ touch: true, returnRow: true },
	);
	let membership = await db.create(
		memberships,
		{ id: crypto.randomUUID(), subject_id: "owner-1", team_id: team.id, role: "admin" },
		{ touch: true, returnRow: true },
	);

	return { db, team, membership };
}

/** Stands in for the language middleware, which this router does not run. */
let { i18n: i18nextInstance } = await createTranslator({
	resources: { en: { translation: en } },
	supportedLanguages: ["en"],
	fallbackLanguage: "en",
	i18next: { interpolation: { escapeValue: false } },
})();

/**
 * Middleware that seeds `ctx.team`/`ctx.membership` in place of
 * `requireTeam`/`requireRole`, plus the translator the invite email is built with.
 */
function seedTeam(team: SelectTeam, membership: SelectMembership): Middleware {
	return (ctx, next) => {
		ctx.team = team;
		ctx.membership = membership;
		ctx.locale = "en";
		ctx.i18next = i18nextInstance;
		return next();
	};
}

/** Sends a form request through a minimal router mapping a single action route. */
async function send(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	transport: MemoryTransport,
	route: Route,
	handler: RequestHandler<any>,
	method: string,
	params: Record<string, string>,
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [asyncContext(), formData() as Middleware, mail({ transport, from: MAIL_FROM })],
	});
	router.map(route, {
		middleware: [seedTeam(team, membership)],
		handler: handler as RequestHandler<any>,
	});

	let request = new Request(new URL(route.href({ team: team.slug }), "https://uptime.test"), {
		method,
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(params).toString(),
	});

	return container.scope(() => router.fetch(request));
}

describe("createInvite", () => {
	test("creates a pending invite and redirects to team settings", async () => {
		let { db, team, membership } = await createFixture();
		let transport = new MemoryTransport();

		let response = await send(
			db,
			team,
			membership,
			transport,
			routes.teamAdminActions.invite.create,
			createInvite as RequestHandler<any>,
			"POST",
			{ email: "new-member@example.com" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.settings.href({ team: team.slug }),
		);

		let invite = await db.findOne(invites, {
			where: { team_id: team.id, email: "new-member@example.com" },
		});
		expect(invite).not.toBeNull();
		expect(invite?.sender_id).toBe(membership.subject_id);
		expect(invite?.accepted_at).toBeNull();

		// Identified by type rather than by subject: a string assertion passes when the
		// wrong email goes out with similar copy, and fails when the copy is reworded.
		expect(transport.messages).toHaveLength(1);
		expect(transport.find((message) => message.email instanceof TeamInviteEmail)).toBeDefined();
		expect(transport.last?.to).toEqual([{ email: "new-member@example.com" }]);
		expect(transport.last?.text).toContain(routes.invite.href({ inviteId: invite?.id ?? "" }));
	});

	test("resends instead of duplicating a pending invite for the same email", async () => {
		let { db, team, membership } = await createFixture();
		let transport = new MemoryTransport();

		let existing = await db.create(
			invites,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				sender_id: membership.subject_id,
				email: "pending@example.com",
				accepted_at: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			transport,
			routes.teamAdminActions.invite.create,
			createInvite as RequestHandler<any>,
			"POST",
			{ email: "pending@example.com" },
		);

		expect(response.status).toBe(303);

		let matching = await db.findMany(invites, {
			where: { team_id: team.id, email: "pending@example.com" },
		});
		expect(matching).toHaveLength(1);
		expect(matching[0]?.id).toBe(existing.id);
		expect(transport.messages).toHaveLength(1);
	});

	test("rejects an already-accepted email without creating another invite", async () => {
		let { db, team, membership } = await createFixture();
		let transport = new MemoryTransport();

		await db.create(
			invites,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				sender_id: membership.subject_id,
				email: "member@example.com",
				accepted_at: Date.now(),
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			transport,
			routes.teamAdminActions.invite.create,
			createInvite as RequestHandler<any>,
			"POST",
			{ email: "member@example.com" },
		);

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("already accepted an invite");

		let matching = await db.findMany(invites, {
			where: { team_id: team.id, email: "member@example.com" },
		});
		expect(matching).toHaveLength(1);
		expect(transport.messages).toHaveLength(0);
	});

	test("redirects back without creating an invite when the email is invalid", async () => {
		let { db, team, membership } = await createFixture();
		let transport = new MemoryTransport();

		let response = await send(
			db,
			team,
			membership,
			transport,
			routes.teamAdminActions.invite.create,
			createInvite as RequestHandler<any>,
			"POST",
			{ email: "not-an-email" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.settings.href({ team: team.slug }),
		);

		let matching = await db.findMany(invites, { where: { team_id: team.id } });
		expect(matching).toHaveLength(0);
		expect(transport.messages).toHaveLength(0);
	});
});

describe("revokeInvite", () => {
	test("deletes a pending invite and redirects to team settings", async () => {
		let { db, team, membership } = await createFixture();
		let transport = new MemoryTransport();

		let invite = await db.create(
			invites,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				sender_id: membership.subject_id,
				email: "revoke-me@example.com",
				accepted_at: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			transport,
			routes.teamAdminActions.invite.revoke,
			revokeInvite as RequestHandler<any>,
			"DELETE",
			{ invite_id: invite.id },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.settings.href({ team: team.slug }),
		);

		let found = await db.findOne(invites, { where: { id: invite.id } });
		expect(found).toBeNull();
	});

	test("responds 404 for an invite that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();
		let transport = new MemoryTransport();

		let otherTeam = await db.create(
			teams,
			{ id: crypto.randomUUID(), owner_id: "owner-2", name: "Other", slug: "other", logo: null },
			{ touch: true, returnRow: true },
		);
		let invite = await db.create(
			invites,
			{
				id: crypto.randomUUID(),
				team_id: otherTeam.id,
				sender_id: "owner-2",
				email: "foreign@example.com",
				accepted_at: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			transport,
			routes.teamAdminActions.invite.revoke,
			revokeInvite as RequestHandler<any>,
			"DELETE",
			{ invite_id: invite.id },
		);

		expect(response.status).toBe(404);

		let found = await db.findOne(invites, { where: { id: invite.id } });
		expect(found).not.toBeNull();
	});

	test("rejects revoking an already-accepted invite", async () => {
		let { db, team, membership } = await createFixture();
		let transport = new MemoryTransport();

		let invite = await db.create(
			invites,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				sender_id: membership.subject_id,
				email: "accepted@example.com",
				accepted_at: Date.now(),
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			transport,
			routes.teamAdminActions.invite.revoke,
			revokeInvite as RequestHandler<any>,
			"DELETE",
			{ invite_id: invite.id },
		);

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("already accepted");

		let found = await db.findOne(invites, { where: { id: invite.id } });
		expect(found).not.toBeNull();
	});

	test("redirects back without deleting anything when invite_id is missing", async () => {
		let { db, team, membership } = await createFixture();
		let transport = new MemoryTransport();

		let invite = await db.create(
			invites,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				sender_id: membership.subject_id,
				email: "untouched@example.com",
				accepted_at: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			transport,
			routes.teamAdminActions.invite.revoke,
			revokeInvite as RequestHandler<any>,
			"DELETE",
			{},
		);

		expect(response.status).toBe(303);

		let found = await db.findOne(invites, { where: { id: invite.id } });
		expect(found).not.toBeNull();
	});
});
