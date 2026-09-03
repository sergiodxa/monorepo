/**
 * Tests for the new maintenance window page controller. `cloudflare:workers` is mocked
 * because `~/app/data/monitor` reads `env` at module load; the empty-form render is
 * checked only for a 200 and that every create-action field survived being regrouped
 * into cards. `getViewer()`/`ctx.team`/`ctx.membership`/`ctx.teams` are seeded by a
 * fake middleware standing in for the real `auth`/`requireUser`/`requireTeam` chain.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext, RequestHandler } from "remix/router";
import type { RemixNode } from "remix/ui";

import { createEnv } from "@sdxc/cloudflare-mocks";
import { ServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { renderToStream } from "remix/ui/server";
import { describe, expect, test, vi } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import { memberships, monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

vi.doMock("cloudflare:workers", () => ({ env: createEnv<Env>({}) }));

let { handler } = (await import("./maintenance-window-new")).default as {
	handler: RequestHandler<any>;
};

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

/** Minimal request-scoped HTML renderer standing in for `bootstrap/app.tsx`'s `createHtmlRenderer`. */
function createHtmlRenderer(ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit): Response {
		let stream = renderToStream(node, { frameSrc: ctx.request.url });
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(stream, { ...init, headers });
	};
}

/** Sends a GET request through a minimal router mapping a single page route. */
async function send(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({ middleware: [asyncContext()] });
	router.map(routes.app.team.maintenanceWindows.new, {
		middleware: [seedTeam(team, membership), i18n, renderWith(createHtmlRenderer) as Middleware],
		handler,
	});

	let request = new Request(
		new URL(
			routes.app.team.maintenanceWindows.new.href({ team: team.slug }),
			"https://uptime.test",
		),
	);

	return container.scope(() => router.fetch(request));
}

describe("maintenanceWindowNew", () => {
	/** The default lives on the selected `<option>`, the only place a `<select>` exposes it. */
	test("renders the empty schedule-maintenance form", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Schedule Maintenance");
		expect(body).toContain('name="name"');
		expect(body).toContain('name="scope"');
		expect(body).toContain('name="starts_at"');
		expect(body).toContain('name="ends_at"');
		expect(body).toContain('name="suppress_alerts"');
		expect(body).toContain('name="is_recurring"');
		expect(body).toContain('value="" selected');
		expect(body).not.toContain("defaultvalue");
		expect(body).toContain(
			`action="${routes.actions.maintenanceWindow.create.href({ team: team.slug })}"`,
		);
	});

	test("lists the team's monitors in the scope dropdown, grouped by type", async () => {
		let { db, team, membership } = await createFixture();
		await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				author_id: membership.subject_id,
				enabled_at: Date.now(),
				name: "Homepage",
				url: "https://example.com",
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("HTTP Monitors");
		expect(body).toContain("Every HTTP monitor");
		expect(body).toContain("Homepage");
	});
});
