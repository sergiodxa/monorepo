/**
 * Tests for the monitor detail page "Monthly Pings Usage" stat-card fragment
 * controller. `cloudflare:workers` is mocked because `~/app/data/monitor` reads
 * `env` at module load, and both figures come from local check history rather
 * than billing state. `ctx.team`/`ctx.membership`/auth/i18next are seeded
 * directly, standing in for the real middleware chain. The three figures the
 * card can produce are pinned here since two look alike but mean opposite
 * things and must never be confused.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SqliteDatabase } from "@sdxc/cloudflare-mocks/sqlite";
import type {
	DataManipulationRequest,
	DataManipulationResult,
	DatabaseDriver,
} from "remix/data-table";
import type { Middleware, RequestContext, RequestHandler } from "remix/router";
import type { RemixNode } from "remix/ui";

import { createEnv } from "@sdxc/cloudflare-mocks";
import { createTranslator } from "@sdxc/i18n";
import { Log } from "@sdxc/logger";
import { log } from "@sdxc/logger/middleware";
import { ServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { renderToStream } from "remix/ui/server";
import { describe, expect, test, vi } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectMonitor, SelectTeam } from "~/database/schema";

import { createActiveSubscription } from "~/app/lib/test/billing";
import { createSqliteDatabaseAdapter, createTestDatabase } from "~/app/lib/test/db";
import en from "~/app/locales/en";
import { memberships, monitorResults, monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({ CLOUDFLARE_ACCOUNT_ID: "acct-1", CLOUDFLARE_ANALYTICS_TOKEN: "token-1" }),
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
		ctx.log.set({ team: { id: team.id } });
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
 * A second handle over the fixture's storage whose raw statements fail, or answer
 * with `rows`, while structural queries keep working — isolating the failure to
 * the consumed count, the controller's only raw statement, from the estimate and lookup.
 */
function createRawFailingDatabase(
	sqliteDb: SqliteDatabase,
	rows?: Record<string, unknown>[],
): Database {
	let inner = createSqliteDatabaseAdapter(sqliteDb);

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
	records: Record<string, unknown>[] = [],
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [asyncContext(), log() as Middleware, renderWith(createHtmlRenderer) as Middleware],
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

	/**
	 * Run inside a log the caller can read back; its sink also keeps the record this
	 * request emits out of the console.
	 */
	let requestLog = new Log({ kind: "request", sink: (record) => void records.push(record) });

	return requestLog.run(() => container.scope(() => router.fetch(request)));
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
	 * A monitor that ran nothing this month is a real answer and reads as `0` — the
	 * distinction this card exists to keep from an unavailable count's dash. Asserting
	 * the dash's absence catches `0` ever being flattened into "unknown".
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
	 * A failing count renders as a dash, distinct at a glance from a real `0`; the
	 * asserted log line is what keeps that failure visible. The assertion pins only
	 * the fields the card owns, since the driver wraps the thrown error.
	 */
	test("renders unavailable and reports the failure when the count query fails", async () => {
		let { sqliteDb, team, membership, monitor } = await createFixture();
		let db = createRawFailingDatabase(sqliteDb);

		let records: Record<string, unknown>[] = [];
		let response = await send(db, team, membership, monitor.id, records);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("—");
		expect(body).toContain("Out of");

		expect(records[0]).toMatchObject({
			"monitor.id": monitor.id,
			"team.id": team.id,
			outcome: "degraded",
		});
		expect(records[0]?.notes).toContainEqual(
			expect.objectContaining({ level: "warn", name: "monitor.usage_consumed_unavailable" }),
		);
	});

	/** A non-finite count is treated as unknown, so it renders as unavailable like any other failed count. */
	test("renders unavailable and reports a non-finite count", async () => {
		let { sqliteDb, team, membership, monitor } = await createFixture();
		let db = createRawFailingDatabase(sqliteDb, [{ consumed: Number.NaN }]);

		let records: Record<string, unknown>[] = [];
		let response = await send(db, team, membership, monitor.id, records);
		let body = await response.text();

		expect(body).toContain("—");
		expect(body).not.toContain("NaN");
		expect(records[0]?.notes).toContainEqual(
			expect.objectContaining({
				level: "warn",
				name: "monitor.usage_consumed_unavailable",
				message: "non-finite value: NaN",
			}),
		);
	});

	test("404s for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership, crypto.randomUUID());
		expect(response.status).toBe(404);
	});
});
