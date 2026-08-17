/**
 * Tests for the alert delivery history page controller. Doesn't import
 * `~/app/data/monitor`, so no `cloudflare:workers` mock is needed. This page lists
 * `alert_events` (delivery outcomes), not alerts themselves, so the non-empty path
 * needs a seeded `alertEvents` row, not just an alert. `getViewer()`/`ctx.team`/
 * `ctx.membership`/`ctx.teams` are seeded directly by a fake middleware standing in for
 * the real `auth`/`requireUser`/`requireTeam` chain, matching the template in
 * `app/http/controllers/app/team/http-monitors.test.ts`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext, RequestHandler } from "remix/router";
import type { RemixNode } from "remix/ui";

import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { renderToStream } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { AlertConfig, SelectMembership, SelectTeam } from "~/database/schema";

import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import { alertEvents, alerts, memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

let { handler } = (await import("./alert-history")).default as { handler: RequestHandler<any> };

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
	router.map(routes.app.team.alerts.history, {
		middleware: [seedTeam(team, membership), i18n, renderWith(createHtmlRenderer) as Middleware],
		handler,
	});

	let request = new Request(
		new URL(routes.app.team.alerts.history.href({ team: team.slug }), "https://uptime.test"),
	);

	return container.scope(() => router.fetch(request));
}

const WEBHOOK_CONFIG: AlertConfig = {
	strategy: "webhook",
	config: { url: "https://example.com/hook", secret: "" },
};

describe("alertHistory", () => {
	test("renders the empty state when the team has no alert events", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Alert History");
		expect(body).toContain("No alert events yet");
	});

	test("lists a delivery event with its alert, monitor, type, and status", async () => {
		let { db, team, membership } = await createFixture();
		let alert = await db.create(
			alerts,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				monitor_id: null,
				name: "CTO Alert",
				notify_on_recovery: true,
				cooldown_minutes: 0,
				config: WEBHOOK_CONFIG,
			},
			{ touch: true, returnRow: true },
		);
		await db.create(
			alertEvents,
			{
				id: crypto.randomUUID(),
				sent_at: Date.now(),
				alert_id: alert.id,
				monitor_id: crypto.randomUUID(),
				event_type: "down",
				status: "sent",
				monitor_type: "http",
				monitor_name: "Homepage",
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("CTO Alert");
		expect(body).toContain("Homepage");
		expect(body).toContain("Down");
		expect(body).toContain("Sent");
	});

	test("labels an event the per-incident cap suppressed", async () => {
		let { db, team, membership } = await createFixture();
		let alert = await db.create(
			alerts,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				monitor_id: null,
				name: "CTO Alert",
				notify_on_recovery: true,
				cooldown_minutes: 15,
				config: WEBHOOK_CONFIG,
			},
			{ touch: true, returnRow: true },
		);
		await db.create(
			alertEvents,
			{
				id: crypto.randomUUID(),
				sent_at: Date.now(),
				alert_id: alert.id,
				monitor_id: crypto.randomUUID(),
				event_type: "down",
				status: "skipped_cap",
				monitor_type: "http",
				monitor_name: "Homepage",
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership);
		expect(response.status).toBe(200);
		expect(await response.text()).toContain("Skipped (Repeat Limit)");
	});

	test("falls back to the unknown-monitor label when the event has no resolved monitor name", async () => {
		let { db, team, membership } = await createFixture();
		/**
		 * `alertHistory`'s query only fetches events whose `alert_id` belongs to one of
		 * the team's current alerts (see `AlertEvent.listByAlertIds`), so the alert here
		 * always resolves — only `monitor_name` (recorded at delivery time, independent
		 * of the alerts query) can be missing, exercising the "Unknown Monitor" fallback.
		 */
		let alert = await db.create(
			alerts,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				monitor_id: null,
				name: "CTO Alert",
				notify_on_recovery: true,
				cooldown_minutes: 0,
				config: WEBHOOK_CONFIG,
			},
			{ touch: true, returnRow: true },
		);
		await db.create(
			alertEvents,
			{
				id: crypto.randomUUID(),
				sent_at: Date.now(),
				alert_id: alert.id,
				monitor_id: crypto.randomUUID(),
				event_type: "up",
				status: "failed",
				error_message: "Webhook timed out",
				monitor_type: null,
				monitor_name: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("CTO Alert");
		expect(body).toContain("Unknown Monitor");
		expect(body).toContain("Recovered");
		expect(body).toContain("Failed");
		expect(body).toContain("Webhook timed out");
	});
});
