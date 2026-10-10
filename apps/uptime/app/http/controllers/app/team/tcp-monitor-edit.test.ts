/**
 * Tests the TCP monitor edit page against models bound to an in-memory database: a GET
 * render behind a 404 guard, with inline validation errors left to the update action's tests.
 * A fake middleware seeds `getViewer()`, `ctx.team`, `ctx.membership` and `ctx.teams` in
 * place of the real `auth`/`requireUser`/`requireTeam` chain.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";
import type { Middleware, RequestHandler } from "remix/router";

import { unwrap } from "@sdxc/result";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { database } from "~/app/http/middleware/database";
import i18n from "~/app/http/middleware/i18n";
import models from "~/app/http/middleware/models";
import { htmlRendering } from "~/app/http/render";
import { createTestDatabase } from "~/app/lib/test/db";
import { bindModels } from "~/app/lib/test/models";
import { memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

let { handler } = (await import("./tcp-monitor-edit")).default as { handler: RequestHandler<any> };

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

/** Middleware that seeds `ctx.team`/`ctx.membership`/`ctx.teams`/auth state, standing in for the real chain. */
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
		ctx.teams = [team];
		ctx.set(Auth, { ok: true, identity: viewer, method: "test" });
		return next();
	};
}

/** Sends a GET request through a minimal router mapping a single page route. */
async function send(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	monitorId: string,
): Promise<Response> {
	let router = createRouter({ middleware: [asyncContext(), database(() => db), models()] });
	router.map(routes.app.team.tcpMonitors.edit, {
		middleware: [seedTeam(team, membership), i18n, ...htmlRendering()],
		handler,
	});

	let request = new Request(
		new URL(
			routes.app.team.tcpMonitors.edit.href({ team: team.slug, monitorId }),
			"https://uptime.test",
		),
	);

	return router.fetch(request);
}

describe("tcpMonitorEdit", () => {
	test("renders the edit form pre-filled with the monitor's values", async () => {
		let { db, team, membership } = await createFixture();
		let models = bindModels(db);
		let monitor = unwrap(
			await models.tcpMonitors.create({
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Database",
				host: "db.example.com",
				port: 5432,
			}),
		);

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Edit TCP Monitor");
		expect(body).toContain("Database");
		expect(body).toContain('value="db.example.com"');
		expect(body).toContain("Save Changes");
		/**
		 * The +/- buttons only step once their island hydrates, and the markup is
		 * identical before and after, so asserting the stepper's module URL is what
		 * proves the island is wired in.
		 */
		expect(body).toContain('"moduleUrl":"/assets/resources/components/stepper-field.js"');
		expect(body).toContain('command="--step-up" commandfor="tcp-monitor-port"');
	});

	test("404s for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership, crypto.randomUUID());
		expect(response.status).toBe(404);
	});
});
