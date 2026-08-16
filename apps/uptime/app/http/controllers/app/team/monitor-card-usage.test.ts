/**
 * Tests for the monitor detail page "Monthly Pings Usage" stat-card fragment
 * controller. `cloudflare:workers` is mocked because `~/app/data/monitor` reads `env`
 * at module load. Both figures the card shows are counted from the local check history,
 * so the fixture seeds `monitor_results` rows rather than any billing state, and no
 * billing client takes part. `ctx.team`/`ctx.membership`/auth/i18next state is seeded
 * directly, standing in for the real `requireUser`/`requireTeam`/i18n middleware chain.
 *
 * The three figures the card can produce are all pinned here, because two of them look
 * alike on screen and mean opposite things: a monitor that ran nothing is `0`, a failed
 * count is a dash plus a log line, and the two must never be confused.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, spyOn, test } from "bun:test";

import type {
	DataManipulationRequest,
	DataManipulationResult,
	DatabaseDriver,
} from "remix/data-table";
import type { Middleware, RequestContext, RequestHandler } from "remix/router";
import type { RemixNode } from "remix/ui";

import { createTranslator } from "@pkg/i18n";
import { logger } from "@pkg/logger";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { renderToStream } from "remix/ui/server";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectMonitor, SelectTeam } from "~/database/schema";

import { createBunSqliteDatabaseAdapter, createTestDatabase } from "~/app/lib/test/db";
import { createActiveSubscription } from "~/app/lib/test/polar";
import en from "~/app/locales/en";
import { memberships, monitorResults, monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

import type { Database as SqliteDatabase } from "bun:sqlite";

mock.module("cloudflare:workers", () => ({
	env: { CLOUDFLARE_ACCOUNT_ID: "acct-1", CLOUDFLARE_ANALYTICS_TOKEN: "token-1" },
}));

let monitorCardUsage = (await import("./monitor-card-usage")).default as {
	handler: RequestHandler<any>;
};

let { i18n: i18nextInstance } = await createTranslator({
	resources: { en: { translation: en } },
	supportedLanguages: ["en"],
	fallbackLanguage: "en",
})();

/** Minimal request-scoped HTML renderer standing in for `bootstrap/app.tsx`'s `createHtmlRenderer`. */
function createHtmlRenderer(ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit) {
		let stream = renderToStream(node, { frameSrc: ctx.request.url, resolveFrame: async () => "" });
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(stream, { ...init, headers });
	};
}

/** Middleware that seeds `ctx.team`/`ctx.membership`/auth/i18next state, standing in for the real chain. */
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
		ctx.locale = "en";
		ctx.i18next = i18nextInstance;
		ctx.set(Auth, { ok: true, identity: viewer, method: "test" });
		return next();
	};
}

/** Creates an in-memory database seeded with one team, an owner's membership, and one monitor. */
async function createFixture() {
	let { db, sqliteDb } = createTestDatabase();

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

	return { db, sqliteDb, team, membership, monitor };
}

/**
 * Records `count` completed checks for the monitor, stamped now so they land in both the
 * current calendar month and the raw-counting window whatever day the suite runs on.
 */
async function recordChecks(db: Database, monitor: SelectMonitor, count: number) {
	for (let index = 0; index < count; index++) {
		await db.create(
			monitorResults,
			{
				id: crypto.randomUUID(),
				monitor_id: monitor.id,
				response_status: 200,
				response_time_ms: 100,
				completed_at: Date.now(),
			},
			{ touch: true },
		);
	}
}

/**
 * A second handle over the fixture's storage whose raw statements fail, or answer with
 * `rows`, while every structural query still works. The consumed count is the only raw
 * statement the controller issues, so this is what isolates its failure from the
 * estimate and the monitor lookup that both have to keep working.
 */
function createRawFailingDatabase(
	sqliteDb: SqliteDatabase,
	rows?: Record<string, unknown>[],
): Database {
	let inner = createBunSqliteDatabaseAdapter(sqliteDb);

	let adapter: DatabaseDriver = {
		...inner,
		async execute(request: DataManipulationRequest): Promise<DataManipulationResult> {
			if (request.operation.kind === "raw") {
				if (rows) return { rows, affectedRows: undefined, insertId: undefined };
				throw new Error("D1_ERROR: no such table");
			}
			return await inner.execute(request);
		},
	};

	return new Database(adapter, { now: () => Date.now() });
}

/** Sends a GET request through a minimal router mapping only the monitor usage card route. */
async function send(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	monitorId: string,
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [asyncContext(), renderWith(createHtmlRenderer) as Middleware],
	});
	router.map(routes.app.team.monitors.cards.usage, {
		middleware: [seedTeam(team, membership)],
		handler: monitorCardUsage.handler,
	});

	let request = new Request(
		new URL(
			routes.app.team.monitors.cards.usage.href({ team: team.slug, monitorId }),
			"https://uptime.test",
		),
	);

	return container.scope(() => router.fetch(request));
}

describe("monitor-card-usage", () => {
	test("renders the pings this monitor consumed, counted from its check history", async () => {
		let { db, team, membership, monitor } = await createFixture();
		await createActiveSubscription(db, team.owner_id);
		await recordChecks(db, monitor, 3);

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Monthly Pings Usage");
		expect(body).toContain(">3<");
	});

	/**
	 * The count comes from this app's own data, so it is readable whether or not the team
	 * is paying. Seeding no subscription is the regression: the card used to gate the
	 * whole figure on one, and showed a dash to anyone without it.
	 */
	test("counts usage for a team with no active subscription", async () => {
		let { db, team, membership, monitor } = await createFixture();
		await recordChecks(db, monitor, 2);

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain(">2<");
		expect(body).not.toContain("—");
	});

	/**
	 * The distinction the card exists to keep: a monitor that ran nothing this month is a
	 * real answer and reads as `0`, while an unavailable count reads as a dash. Asserting
	 * the dash's absence is what makes this test fail if `0` is ever flattened into
	 * "unknown".
	 */
	test("renders a genuine zero as 0, not as unavailable", async () => {
		let { db, team, membership, monitor } = await createFixture();
		await createActiveSubscription(db, team.owner_id);

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Monthly Pings Usage");
		expect(body).not.toContain("—");
		expect(body).toContain(">0<");
	});

	/**
	 * A failing count has to stay a dash — showing the customer "0 used" for usage nobody
	 * could read is worse than showing nothing — but it must not stay silent, so the log
	 * line is asserted alongside the rendering. The estimate is unaffected and still
	 * renders, which is the whole reason the two are settled independently.
	 */
	test("renders unavailable and reports the failure when the count query fails", async () => {
		let { sqliteDb, team, membership, monitor } = await createFixture();
		let db = createRawFailingDatabase(sqliteDb);

		let errors = spyOn(logger, "error").mockImplementation(() => {});

		try {
			let response = await send(db, team, membership, monitor.id);
			expect(response.status).toBe(200);

			let body = await response.text();
			expect(body).toContain("—");
			expect(body).toContain("Out of");

			// The driver wraps the thrown error, so only the fields the card owns are pinned.
			expect(errors).toHaveBeenCalledWith(
				"monitor_usage_card.consumed_unavailable",
				expect.objectContaining({ monitorId: monitor.id, teamId: team.id }),
			);
		} finally {
			errors.mockRestore();
		}
	});

	/** A count that isn't a finite number is unknown, not a value to print as-is. */
	test("renders unavailable and reports a non-finite count", async () => {
		let { sqliteDb, team, membership, monitor } = await createFixture();
		let db = createRawFailingDatabase(sqliteDb, [{ consumed: Number.NaN }]);

		let errors = spyOn(logger, "error").mockImplementation(() => {});

		try {
			let response = await send(db, team, membership, monitor.id);
			let body = await response.text();

			expect(body).toContain("—");
			expect(body).not.toContain("NaN");
			expect(errors).toHaveBeenCalledWith("monitor_usage_card.consumed_unavailable", {
				monitorId: monitor.id,
				teamId: team.id,
				message: "non-finite value: NaN",
			});
		} finally {
			errors.mockRestore();
		}
	});

	test("404s for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership, crypto.randomUUID());
		expect(response.status).toBe(404);
	});
});
