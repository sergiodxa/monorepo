/**
 * Tests for the edit maintenance window page controller. `cloudflare:workers` is
 * mocked because `~/app/data/monitor` (used here to populate the monitor-scope
 * dropdown) reads `env` at module load — following the exact pattern established in
 * `app/http/controllers/actions/monitors.test.ts`. It's a plain GET handler with no
 * branch that re-renders the form with validation errors (that only happens in the
 * `actions/maintenance-windows.ts` form-submission controller, tested separately), so
 * this only covers the 404, the pre-filled-form 200 case, and the conditional "End
 * maintenance now" button that only renders while the window is currently active.
 * `getViewer()`/`ctx.team`/`ctx.membership`/`ctx.teams` are seeded directly by a fake
 * middleware standing in for the real `auth`/`requireUser`/`requireTeam` chain,
 * matching the template in `app/http/controllers/app/team/http-monitors.test.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import type { Middleware, RequestContext, RequestHandler } from "remix/router";
import type { RemixNode } from "remix/ui";

import { createEnv } from "@pkg/cloudflare-mocks";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { renderToStream } from "remix/ui/server";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import { maintenanceWindows, memberships, monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

mock.module("cloudflare:workers", () => ({ env: createEnv<Env>({}) }));

let { handler } = (await import("./maintenance-window-edit")).default as {
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
	windowId: string,
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({ middleware: [asyncContext()] });
	router.map(routes.app.team.maintenanceWindows.edit, {
		middleware: [seedTeam(team, membership), i18n, renderWith(createHtmlRenderer) as Middleware],
		handler,
	});

	let request = new Request(
		new URL(
			routes.app.team.maintenanceWindows.edit.href({ team: team.slug, windowId }),
			"https://uptime.test",
		),
	);

	return container.scope(() => router.fetch(request));
}

describe("maintenanceWindowEdit", () => {
	test("responds 404 for a window that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership, crypto.randomUUID());
		expect(response.status).toBe(404);
	});

	test("renders the edit form pre-filled with the window's values, without the end-early button when not active", async () => {
		let { db, team, membership } = await createFixture();
		let now = Date.now();
		let window = await db.create(
			maintenanceWindows,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				monitor_id: null,
				name: "Database upgrade",
				starts_at: now + 3_600_000,
				ends_at: now + 7_200_000,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership, window.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Edit Database upgrade");
		expect(body).toContain('value="Database upgrade"');
		expect(body).toContain(
			`action="${routes.actions.maintenanceWindow.update.href({ team: team.slug })}"`,
		);
		expect(body).toContain(`value="${window.id}"`);
		expect(body).not.toContain("End maintenance now");
	});

	test("marks the scoped monitor's option as selected, not the all-monitors one", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
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
		let now = Date.now();
		let window = await db.create(
			maintenanceWindows,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				monitor_id: monitor.id,
				name: "Scoped upgrade",
				starts_at: now + 3_600_000,
				ends_at: now + 7_200_000,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership, window.id);
		let body = await response.text();

		/*
		 * `<select>` has no `defaultValue` attribute, so the saved scope has to be marked
		 * on the option itself — otherwise the first one wins and re-saving this window
		 * would widen it back to "all monitors". The row is seeded with no `monitor_type`,
		 * the shape every window had before the column existed, so this also covers that
		 * being read back as HTTP rather than as team-wide.
		 */
		expect(body).toContain(`value="monitor:http:${monitor.id}" selected`);
		expect(body).not.toContain(`value="" selected`);
		expect(body).not.toContain("defaultvalue");
	});

	/**
	 * Without an option of its own the `<select>` would show its first — team-wide — and
	 * saving the form untouched would silently widen the window to every monitor the team
	 * has. It gets a selected option saying the monitor is gone instead, and the value it
	 * carries fails the action's scope check until somebody picks one that exists.
	 */
	test("keeps a window scoped to a deleted monitor from reverting to team-wide", async () => {
		let { db, team, membership } = await createFixture();
		let now = Date.now();
		let window = await db.create(
			maintenanceWindows,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				monitor_type: "dns",
				monitor_id: "deleted-monitor",
				name: "Zone migration",
				starts_at: now + 3_600_000,
				ends_at: now + 7_200_000,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership, window.id);
		let body = await response.text();

		expect(body).toContain(`value="monitor:dns:deleted-monitor" selected`);
		expect(body).toContain("A monitor that no longer exists");
		expect(body).not.toContain(`value="" selected`);
	});

	test("only marks the behaviour switches checked when their stored values are true", async () => {
		let { db, team, membership } = await createFixture();

		async function renderWith(flags: boolean) {
			let now = Date.now();
			let window = await db.create(
				maintenanceWindows,
				{
					id: crypto.randomUUID(),
					team_id: team.id,
					monitor_id: null,
					name: "Database upgrade",
					starts_at: now + 3_600_000,
					ends_at: now + 7_200_000,
					suppress_alerts: flags,
					show_on_status_page: flags,
					is_recurring: flags,
				},
				{ touch: true, returnRow: true },
			);
			return await (await send(db, team, membership, window.id)).text();
		}

		/*
		 * Anchored to the attribute inside each switch's own tag rather than to the bare
		 * word, which also appears in the component's `~ input:checked` CSS. `checked` is
		 * an HTML boolean attribute: present at all — even as `checked="0"` for a `false`
		 * that came back from SQLite as the integer 0 — means the switch renders ON, and
		 * re-saving would flip the stored decision.
		 */
		let checkedInputs = [
			/<input[^>]*\bname="suppress_alerts"[^>]*\schecked/,
			/<input[^>]*\bname="show_on_status_page"[^>]*\schecked/,
			/<input[^>]*\bname="is_recurring"[^>]*\schecked/,
		];

		let checkedBody = await renderWith(true);
		let uncheckedBody = await renderWith(false);

		for (let pattern of checkedInputs) {
			expect(checkedBody).toMatch(pattern);
			expect(uncheckedBody).not.toMatch(pattern);
		}
	});

	test("shows the end-early button for a window that's currently active", async () => {
		let { db, team, membership } = await createFixture();
		let now = Date.now();
		let window = await db.create(
			maintenanceWindows,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				monitor_id: null,
				name: "Live migration",
				starts_at: now - 60_000,
				ends_at: now + 60_000,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership, window.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("End maintenance now");
		expect(body).toContain(
			`action="${routes.actions.maintenanceWindow.end.href({ team: team.slug })}"`,
		);
	});
});
