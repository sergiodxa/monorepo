/**
 * Tests `/invite/:inviteId`: visiting the link accepts the invite as a side
 * effect of the GET, creating the membership and redirecting to the dashboard
 * for a valid pending invite matching the viewer's email. An unknown,
 * already-accepted, or mismatched invite renders the invite-unavailable page,
 * and `requireUser` bounces anonymous visitors home.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database as TestDb } from "remix/data-table";
import type { Renderer } from "remix/middleware/render";
import type { Middleware } from "remix/router";
import type { RemixNode } from "remix/ui";

import { ServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { renderToString } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";

import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import { invites, memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

import invite from "./invite";

/** Renders through `renderToString` — this page renders no `<Frame>`, so no `resolveFrame` is needed. */
function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let html = await renderToString(node);
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/** Sets the `Auth` context state directly, standing in for the real session-backed `auth` middleware. */
function seedAuth(viewer: Viewer | null): Middleware {
	return (ctx, next) => {
		if (viewer) ctx.set(Auth, { ok: true, identity: viewer, method: "test" });
		else ctx.set(Auth, { ok: false });
		return next();
	};
}

async function getInvite(db: TestDb, viewer: Viewer | null, inviteId: string) {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [
			asyncContext(),
			seedAuth(viewer),
			i18n as Middleware,
			renderWith(createTestRenderer) as Middleware,
		],
	});
	router.map(routes.invite, invite);

	let request = new Request(`https://uptime.test${routes.invite.href({ inviteId })}`);
	return container.scope(() => router.fetch(request));
}

async function createFixture(db: TestDb, options?: { acceptedAt?: number | null; email?: string }) {
	let team = await db.create(
		teams,
		{ id: crypto.randomUUID(), owner_id: "owner-1", name: "Acme", slug: "acme", logo: null },
		{ touch: true, returnRow: true },
	);
	let invite = await db.create(
		invites,
		{
			id: crypto.randomUUID(),
			team_id: team.id,
			sender_id: "owner-1",
			email: options?.email ?? "ada@example.com",
			accepted_at: options?.acceptedAt ?? null,
		},
		{ touch: true, returnRow: true },
	);
	return { team, invite };
}

let VIEWER: Viewer = { id: "user-1", name: "Ada Lovelace", email: "ada@example.com", avatar: "" };

describe("GET /invite/:inviteId", () => {
	test("redirects an anonymous visitor home instead of accepting the invite", async () => {
		let { db } = createTestDatabase();
		let { invite: pending } = await createFixture(db);

		let response = await getInvite(db, null, pending.id);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(routes.home.href());
		expect(await db.findOne(invites, { where: { id: pending.id } })).toMatchObject({
			accepted_at: null,
		});
	});

	test("accepts a valid pending invite and redirects to the team dashboard", async () => {
		let { db } = createTestDatabase();
		let { team, invite: pending } = await createFixture(db);

		let response = await getInvite(db, VIEWER, pending.id);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.dashboard.index.href({ team: team.id }),
		);

		let accepted = await db.findOne(invites, { where: { id: pending.id } });
		expect(accepted?.accepted_at).not.toBeNull();

		let membership = await db.findOne(memberships, {
			where: { team_id: team.id, subject_id: VIEWER.id },
		});
		expect(membership).not.toBeNull();
		expect(membership?.role).toBe("member");
	});

	test("renders an error page for an unknown invite id, without creating a membership", async () => {
		let { db } = createTestDatabase();

		let response = await getInvite(db, VIEWER, crypto.randomUUID());

		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).toContain("This invite does not exist.");

		let matching = await db.findMany(memberships, { where: { subject_id: VIEWER.id } });
		expect(matching).toHaveLength(0);
	});

	test("renders an error page for an already-accepted invite", async () => {
		let { db } = createTestDatabase();
		let { invite: accepted } = await createFixture(db, { acceptedAt: Date.now() });

		let response = await getInvite(db, VIEWER, accepted.id);

		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).toContain("This invite has already been accepted.");
	});

	test("renders an error page when the invite was sent to a different email", async () => {
		let { db } = createTestDatabase();
		let { invite: mismatched } = await createFixture(db, { email: "someone-else@example.com" });

		let response = await getInvite(db, VIEWER, mismatched.id);

		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).toContain("This invite was sent to someone-else@example.com.");

		let matching = await db.findMany(memberships, { where: { subject_id: VIEWER.id } });
		expect(matching).toHaveLength(0);
	});
});
