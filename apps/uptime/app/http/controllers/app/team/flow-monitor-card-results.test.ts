/**
 * Tests for the flow monitor results fragment. `~/app/data/flow-monitor` doesn't import
 * `cloudflare:workers`, so no module mock is needed here. `getViewer()`/`ctx.team`/
 * `ctx.membership`/`ctx.teams` are seeded directly by a fake middleware standing in for the real
 * `auth`/`requireUser`/`requireTeam` chain, matching the template in
 * `app/http/controllers/actions/monitors.test.ts`.
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
import type { SelectMembership, SelectTeam } from "~/database/schema";

import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import { flowMonitorResults, flowMonitors, memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

let { handler } = (await import("./flow-monitor-card-results")).default as {
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

/** Middleware that seeds `ctx.team`/`ctx.membership`/`ctx.teams`/auth state. */
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

/**
 * Minimal request-scoped HTML renderer standing in for `bootstrap/app.tsx`'s renderer. Frame
 * resolution isn't exercised by a single-request page test, so `resolveFrame` is a no-op — the
 * results fragment this page frames has its own test.
 */
function createHtmlRenderer(ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit): Response {
		let stream = renderToStream(node, { frameSrc: ctx.request.url, resolveFrame: async () => "" });
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
	monitorId: string,
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({ middleware: [asyncContext()] });
	router.map(routes.app.team.flowMonitors.cards.results, {
		middleware: [seedTeam(team, membership), i18n, renderWith(createHtmlRenderer) as Middleware],
		handler,
	});

	let request = new Request(
		new URL(
			routes.app.team.flowMonitors.cards.results.href({ team: team.slug, monitorId }),
			"https://uptime.test",
		),
	);

	return container.scope(() => router.fetch(request));
}

/** Seeds one flow monitor, with whatever the case cares about overridden. */
async function seedMonitor(db: Database, teamId: string, changes: Record<string, unknown> = {}) {
	return await db.create(
		flowMonitors,
		{
			id: crypto.randomUUID(),
			team_id: teamId,
			name: "Sign in",
			source: 'test "signs in" {\n\tthen {\n\t\texpect true\n\t}\n}',
			interval_seconds: 3600,
			...changes,
		},
		{ touch: true, returnRow: true },
	);
}

/** Seeds one run for a monitor, with whatever the case cares about overridden. */
async function seedResult(db: Database, monitorId: string, changes: Record<string, unknown> = {}) {
	return await db.create(
		flowMonitorResults,
		{
			id: crypto.randomUUID(),
			flow_monitor_id: monitorId,
			status: "up",
			tests_total: 1,
			tests_passed: 1,
			tests_failed: 0,
			requests_made: 2,
			duration_ms: 412,
			checked_at: Date.now(),
			...changes,
		},
		{ touch: true, returnRow: true },
	);
}

describe("flowMonitorCardResults", () => {
	test("renders the flow's source with a number on every line", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await seedMonitor(db, team.id, {
			source: 'test "signs in" {\n\tthen {\n\t\texpect true\n\t}\n}',
		});

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("signs in");
		// Five lines, so a gutter counting to five.
		for (let number of [1, 2, 3, 4, 5]) expect(body).toContain(String(number));
	});

	test("no runs yet reports so, and the derived stats stay blank", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await seedMonitor(db, team.id);

		let body = await (await send(db, team, membership, monitor.id)).text();
		expect(body).toContain("No runs yet");
		expect(body).toContain("Pass rate");
	});

	test("a failing run marks the line it failed on and quotes the failure", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await seedMonitor(db, team.id);
		await seedResult(db, monitor.id, {
			status: "down",
			tests_passed: 0,
			tests_failed: 1,
			failed_test: "signs in",
			failed_at_line: 3,
			failure_detail: "expected 200, observed 500",
		});

		let body = await (await send(db, team, membership, monitor.id)).text();
		expect(body).toContain("Failing");
		expect(body).toContain("expected 200, observed 500");
		// The gutter marker only appears when a line is marked, so its presence is the assertion.
		expect(body).toContain("›");
	});

	test("a run that could not happen shows its reason and is left out of the pass rate", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await seedMonitor(db, team.id);
		await seedResult(db, monitor.id, { checked_at: Date.now() - 60_000 });
		await seedResult(db, monitor.id, {
			status: "error",
			tests_total: 0,
			tests_passed: 0,
			requests_made: 0,
			error_message: "no verified domain covers victim.invalid.test",
		});

		let body = await (await send(db, team, membership, monitor.id)).text();
		expect(body).toContain("Cannot run");
		expect(body).toContain("no verified domain covers");
		// One passing run and one that never ran: 100%, not 50%.
		expect(body).toContain("100%");
	});

	test("lists the runs newest first", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await seedMonitor(db, team.id);
		let now = Date.now();
		await seedResult(db, monitor.id, { checked_at: now - 60_000, duration_ms: 111 });
		await seedResult(db, monitor.id, { checked_at: now, duration_ms: 222 });

		let body = await (await send(db, team, membership, monitor.id)).text();
		expect(body.indexOf("222ms")).toBeLessThan(body.indexOf("111ms"));
	});

	test("404s on another team's monitor", async () => {
		let { db, team, membership } = await createFixture();
		let other = await db.create(
			teams,
			{ id: crypto.randomUUID(), owner_id: "owner-2", name: "Other", slug: "other", logo: null },
			{ touch: true, returnRow: true },
		);
		let monitor = await seedMonitor(db, other.id, { name: "Not Yours" });

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(404);
	});
});
