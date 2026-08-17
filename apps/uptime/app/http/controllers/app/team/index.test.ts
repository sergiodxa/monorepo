/**
 * Tests for the `/app/:team` entry redirect. `requireUser`/`requireTeam` are bypassed
 * (they need a real session cookie / real `auth` global middleware); `ctx.team` is
 * seeded directly instead, since the handler reads `ctx.team.slug` itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestHandler } from "remix/router";

import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

import * as indexModule from "./index";

/** Creates an in-memory database seeded with one team and a member's membership. */
async function createFixture() {
	let { db } = createTestDatabase();

	let team = await db.create(
		teams,
		{ id: crypto.randomUUID(), owner_id: "owner-1", name: "Acme", slug: "acme", logo: null },
		{ touch: true, returnRow: true },
	);
	let membership = await db.create(
		memberships,
		{ id: crypto.randomUUID(), subject_id: "member-1", team_id: team.id, role: "member" },
		{ touch: true, returnRow: true },
	);

	return { db, team, membership };
}

/** Middleware that seeds `ctx.team`/`ctx.membership`/auth state, standing in for the real chain. */
function seedTeam(team: SelectTeam, membership: SelectMembership): Middleware {
	let viewer: Viewer = {
		id: membership.subject_id,
		name: "Test Viewer",
		email: "viewer@example.com",
		avatar: "",
	};

	return (ctx, next) => {
		ctx.team = team;
		ctx.membership = membership;
		ctx.set(Auth, { ok: true, identity: viewer, method: "test" });
		return next();
	};
}

describe("app/team/index", () => {
	test("redirects to the team's dashboard", async () => {
		let { db, team, membership } = await createFixture();

		let container = new ServiceContainer();
		container.instance(Database, db);

		let router = createRouter({ middleware: [asyncContext()] });
		router.map(routes.app.team.index, {
			middleware: [seedTeam(team, membership)],
			handler: (indexModule.default as { handler: RequestHandler<any> }).handler,
		});

		let request = new Request(
			new URL(routes.app.team.index.href({ team: team.slug }), "https://uptime.test"),
		);
		let response = await container.scope(() => router.fetch(request));

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.dashboard.index.href({ team: team.slug }),
		);
	});
});
