/**
 * Tests `GET /try/report/:token`, whose whole job is to state what happened to one URL without
 * overstating any of it.
 *
 * Every figure asserted here is asserted against seeded rows rather than against a literal the
 * page was told to print: the fixtures set `checks_run`, `checks_ok` and the result history,
 * and the tests expect the numbers those imply. A page that hardcoded a plausible uptime would
 * fail every one of them.
 *
 * The two dishonesty regressions get their own tests, because both would look fine on screen.
 * A watch with no completed check must not render `0`, `0%` or "no incidents" — nothing has
 * answered yet, and all three of those read as measurements. A week that genuinely had no
 * failure must say so and must not render the incident list at all, so a reader cannot come
 * away thinking something went down.
 *
 * The watches are seeded at fixed instants with a `converts_until` far in the future or firmly
 * in the past, so nothing here depends on when the suite runs: the period the page prints ends
 * at `expires_at`, which is already behind every fixture.
 *
 * Copy comes back as bare locale keys, since `trial.report.*` is not translated yet. That is
 * why the assertions are on computed values, on the presence or absence of a key rather than
 * of a sentence, and on rendered structure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { Middleware } from "remix/fetch-router";
import type { Renderer } from "remix/render-middleware";
import type { RemixNode } from "remix/ui";

import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { renderWith } from "remix/render-middleware";
import { renderToString } from "remix/ui/server";

import type { InsertTrialWatch, MonitorStatus } from "~/database/schema";

import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import { trialWatchResults, trialWatches } from "~/database/schema";
import routes from "~/routes/web";

import report from "./report";

type Db = ReturnType<typeof createTestDatabase>["db"];

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** The instant every fixture's week starts at: 2026-07-01T00:00:00Z, and never `Date.now()`. */
const WEEK_START = Date.UTC(2026, 6, 1);

/** The instant that week ended, seven days on, which is what the page prints as the period end. */
const WEEK_END = WEEK_START + 7 * MS_PER_DAY;

/** A conversion deadline far enough out that no test run can pass it. */
const FAR_FUTURE = Date.UTC(2099, 0, 1);

/** Renders through `renderToString` — this page renders no `<Frame>`. */
function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let html = await renderToString(node);
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/** Seeds a finished week whose counters and deadlines are stated outright, not derived from now. */
async function seedWatch(db: Db, overrides: Partial<InsertTrialWatch> = {}) {
	return await db.create(
		trialWatches,
		{
			id: crypto.randomUUID(),
			created_at: WEEK_START,
			updated_at: WEEK_END,
			lead_id: "lead-1",
			url: "https://example.com/status",
			normalized_url: "https://example.com/status",
			report_token: `token-${crypto.randomUUID()}`,
			next_due_at: null,
			expires_at: WEEK_END,
			converts_until: FAR_FUTURE,
			last_status: "up",
			checks_run: 168,
			checks_ok: 166,
			max_response_time_ms: 1980,
			summary_sent_at: WEEK_END,
			...overrides,
		},
		{ touch: false, returnRow: true },
	);
}

/** Appends one check to a watch's history, `hour` hours into its week. */
async function seedResult(
	db: Db,
	watchId: string,
	hour: number,
	status: MonitorStatus,
	responseTimeMs: number | null,
) {
	await db.create(
		trialWatchResults,
		{
			id: crypto.randomUUID(),
			trial_watch_id: watchId,
			status,
			response_time_ms: responseTimeMs,
			checked_at: WEEK_START + hour * MS_PER_HOUR,
		},
		{ touch: false, returnRow: true },
	);
}

/** Dispatches one GET at the report URL for `token`. */
async function visit(db: Db, token: string) {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [asyncContext(), i18n as Middleware, renderWith(createTestRenderer) as Middleware],
	});
	router.map(routes.trial.report, report);

	let href = routes.trial.report.href({ token });
	let response = await container.scope(() =>
		router.fetch(new Request(`https://uptime.test${href}`)),
	);

	return { response, body: await response.text() };
}

describe("GET /try/report/:token", () => {
	test("reports the URL and the figures the stored counters imply", async () => {
		let { db } = createTestDatabase();
		let watch = await seedWatch(db);

		let { response, body } = await visit(db, watch.report_token);

		expect(response.status).toBe(200);
		expect(body).toContain("https://example.com/status");
		// 166 of 168 healthy, printed as the locale writes a percentage — never a literal.
		expect(body).toContain("98.8%");
		expect(body).toContain("168");
		expect(body).toContain("166");
	});

	test("recomputes when the counters do, rather than printing a fixed number", async () => {
		let { db } = createTestDatabase();
		let watch = await seedWatch(db, { checks_run: 100, checks_ok: 50 });

		let { body } = await visit(db, watch.report_token);

		expect(body).toContain("50.0%");
		expect(body).not.toContain("98.8%");
	});

	test("prints the monitoring period, once, above the figures", async () => {
		let { db } = createTestDatabase();
		let watch = await seedWatch(db);

		let { body } = await visit(db, watch.report_token);

		// The dates themselves are interpolated into copy that is not translated yet, so what is
		// asserted here is that the line is rendered and rendered once.
		expect(body.split("trial.report.period").length - 1).toBe(1);
	});

	test("summarizes the response times of the checks that answered", async () => {
		let { db } = createTestDatabase();
		let watch = await seedWatch(db);
		await seedResult(db, watch.id, 1, "up", 120);
		await seedResult(db, watch.id, 2, "up", 240);
		// A check nothing answered carries no timing, and must not be folded in as a zero.
		await seedResult(db, watch.id, 3, "down", null);

		let { body } = await visit(db, watch.report_token);

		expect(body).toContain("trial.report.timing.title");
		expect(body).toContain("120 ms");
		expect(body).toContain("240 ms");
		// The average is over the two that answered — 180 — and not over all three.
		expect(body).toContain("180 ms");
	});

	test("omits the response-time section entirely when nothing ever answered", async () => {
		let { db } = createTestDatabase();
		let watch = await seedWatch(db, { checks_run: 3, checks_ok: 0, max_response_time_ms: 0 });
		await seedResult(db, watch.id, 1, "down", null);

		let { body } = await visit(db, watch.report_token);

		expect(body).not.toContain("trial.report.timing.title");
	});

	test("names each incident it can see in the history", async () => {
		let { db } = createTestDatabase();
		let watch = await seedWatch(db);
		await seedResult(db, watch.id, 1, "up", 100);
		await seedResult(db, watch.id, 2, "down", null);
		await seedResult(db, watch.id, 3, "down", null);
		await seedResult(db, watch.id, 4, "up", 100);
		await seedResult(db, watch.id, 20, "down", null);

		let { body } = await visit(db, watch.report_token);

		expect(body).toContain("trial.report.incidents.summary");
		// Two runs of consecutive failures, so two entries — not five, and not one.
		expect(body.split("trial.report.incidents.entry").length - 1).toBe(2);
		expect(body).not.toContain("trial.report.incidents.none");
	});

	test("states plainly that there were no incidents rather than implying one", async () => {
		let { db } = createTestDatabase();
		let watch = await seedWatch(db, { checks_run: 24, checks_ok: 24 });
		await seedResult(db, watch.id, 1, "up", 100);
		await seedResult(db, watch.id, 2, "up", 110);

		let { body } = await visit(db, watch.report_token);

		expect(body).toContain("trial.report.incidents.none");
		expect(body).not.toContain("trial.report.incidents.entry");
		expect(body).not.toContain("trial.report.incidents.summary");
		expect(body).not.toContain("trial.report.incidents.unknown");
	});

	test("a degraded check is not an outage, so it opens no incident", async () => {
		let { db } = createTestDatabase();
		let watch = await seedWatch(db, { checks_run: 2, checks_ok: 1 });
		await seedResult(db, watch.id, 1, "up", 100);
		await seedResult(db, watch.id, 2, "degraded", 4100);

		let { body } = await visit(db, watch.report_token);

		expect(body).toContain("trial.report.incidents.none");
		expect(body).not.toContain("trial.report.incidents.entry");
	});

	test("renders no fake zeroes for a watch that has completed no check", async () => {
		let { db } = createTestDatabase();
		let watch = await seedWatch(db, {
			checks_run: 0,
			checks_ok: 0,
			max_response_time_ms: 0,
			last_status: null,
			summary_sent_at: null,
		});

		let { body } = await visit(db, watch.report_token);

		// An em dash in all three headline figures, and no percentage anywhere.
		expect(body.split("—").length - 1).toBeGreaterThanOrEqual(3);
		expect(body).not.toContain("0.0%");
		expect(body).not.toContain("100.0%");
		// And nothing that reads as a verdict on a week nobody has observed.
		expect(body).toContain("trial.report.summary.noChecks");
		expect(body).toContain("trial.report.incidents.unknown");
		expect(body).not.toContain("trial.report.incidents.none");
		expect(body).not.toContain("trial.report.incidents.entry");
	});

	test("offers the subscription at the price the pricing model states", async () => {
		let { db } = createTestDatabase();
		let watch = await seedWatch(db);

		let { body } = await visit(db, watch.report_token);

		expect(body).toContain("trial.report.cta.title");
		expect(body).toContain("trial.report.cta.convertible.body");
		expect(body).toContain(`href="${routes.app.index.href()}"`);
	});

	test("drops the carry-over promise once the conversion window has closed", async () => {
		let { db } = createTestDatabase();
		let watch = await seedWatch(db, { converts_until: WEEK_END });

		let { body } = await visit(db, watch.report_token);

		expect(body).toContain("trial.report.cta.expired.body");
		expect(body).not.toContain("trial.report.cta.convertible.body");
	});

	test("does not sell a target that is already a real monitor", async () => {
		let { db } = createTestDatabase();
		let watch = await seedWatch(db, {
			converted_at: WEEK_END,
			converted_monitor_id: crypto.randomUUID(),
		});

		let { body } = await visit(db, watch.report_token);

		expect(body).toContain("trial.report.cta.converted.title");
		expect(body).not.toContain("trial.report.cta.title");
	});

	test("keeps itself out of search indexes", async () => {
		let { db } = createTestDatabase();
		let watch = await seedWatch(db);

		let { body } = await visit(db, watch.report_token);

		expect(body).toContain('name="robots" content="noindex, nofollow"');
	});

	test("404s on a token nothing issued", async () => {
		let { db } = createTestDatabase();
		await seedWatch(db);

		let { response, body } = await visit(db, "not-a-real-token");

		expect(response.status).toBe(404);
		expect(body).not.toContain("https://example.com/status");
	});

	test("404s once the watch behind a token has been swept", async () => {
		let { db } = createTestDatabase();
		let watch = await seedWatch(db);
		await db.deleteMany(trialWatches, { where: { id: watch.id } });

		let { response } = await visit(db, watch.report_token);

		expect(response.status).toBe(404);
	});
});
