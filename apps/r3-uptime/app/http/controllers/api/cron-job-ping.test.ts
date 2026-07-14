/**
 * Tests `POST /api/v1/cron-jobs/:cronJobId/ping`: the public, unauthenticated
 * ping endpoint for dead man's switch monitoring. Covers a healthy on-time ping,
 * 404 for an unknown cron job id, 409 for a disabled job, and 429 for a ping
 * within the rate-limit window. `Resend` is registered as a fake in the service
 * container the same way `app/jobs/check-ssl.test.ts` does; no seeded alerts means
 * `notifyCronJobResult` never actually dispatches, so no real network call happens.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { Resend } from "resend";

import CronJobMonitor from "~/app/data/cron-job";
import cronJobPing from "~/app/http/controllers/api/cron-job-ping";
import { createTestDatabase } from "~/app/lib/test/db";
import { cronJobMonitors, cronJobPings, teams } from "~/database/schema";
import routes from "~/routes/web";

type Db = ReturnType<typeof createTestDatabase>["db"];

async function createTeamRow(db: Db) {
	return await db.create(
		teams,
		{
			id: crypto.randomUUID(),
			owner_id: crypto.randomUUID(),
			name: "Acme",
			slug: `acme-${crypto.randomUUID()}`,
			logo: null,
		},
		{ touch: true, returnRow: true },
	);
}

async function createCronJobRow(db: Db, teamId: string, overrides: Record<string, unknown> = {}) {
	return await CronJobMonitor.create(db, teamId, {
		name: "Nightly backup",
		description: null,
		cron_expression: "0 0 * * *",
		grace_period_seconds: 300,
		timezone: "UTC",
		alert_on_late: false,
		enabled_at: Date.now(),
		...overrides,
	});
}

async function dispatch(db: Db, request: Request) {
	let router = createRouter({ middleware: [asyncContext()] });
	router.map(routes.api.cronJobPing, cronJobPing);

	let container = new ServiceContainer();
	container.singleton(Database, () => db);
	container.singleton(Resend, () => new Resend("re_test_key"));

	return container.scope(() => router.fetch(request));
}

function ping(cronJobId: string) {
	return new Request(`https://uptime.test${routes.api.cronJobPing.href({ cronJobId })}`, {
		method: "POST",
	});
}

describe("POST /api/v1/cron-jobs/:cronJobId/ping", () => {
	test("records an on-time ping and returns 201", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let monitor = await createCronJobRow(db, team.id);

		let response = await dispatch(db, ping(monitor.id));
		expect(response.status).toBe(201);

		let body = (await response.json()) as { wasOnTime: boolean };
		expect(body.wasOnTime).toBe(true);

		let updated = await db.findOne(cronJobMonitors, { where: { id: monitor.id } });
		expect(updated?.status).toBe("healthy");
		expect(updated?.last_ping_at).not.toBeNull();

		let pings = await db.findMany(cronJobPings, { where: { cron_job_monitor_id: monitor.id } });
		expect(pings).toHaveLength(1);
		expect(pings[0]?.was_on_time).toBeTruthy();
	});

	test("returns 404 for an unknown cron job id", async () => {
		let { db } = createTestDatabase();

		let response = await dispatch(db, ping(crypto.randomUUID()));
		expect(response.status).toBe(404);
	});

	test("returns 409 for a disabled job", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let monitor = await createCronJobRow(db, team.id, { enabled_at: null });

		let response = await dispatch(db, ping(monitor.id));
		expect(response.status).toBe(409);

		let unchanged = await db.findOne(cronJobMonitors, { where: { id: monitor.id } });
		expect(unchanged?.last_ping_at).toBeNull();
	});

	test("returns 429 for a ping within the rate-limit window", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let monitor = await createCronJobRow(db, team.id);
		await CronJobMonitor.updateById(db, monitor.id, { last_ping_at: Date.now() - 1000 });

		let response = await dispatch(db, ping(monitor.id));
		expect(response.status).toBe(429);

		let pings = await db.findMany(cronJobPings, { where: { cron_job_monitor_id: monitor.id } });
		expect(pings).toHaveLength(0);
	});
});
