/**
 * `db seed`, run through the app's command line on an in-memory database with every migration
 * applied, so the seed is checked against the schema the dev server serves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { invoke } from "@sdxc/cli/test";
import { describe, expect, test, vi } from "vitest";

import { createTestDatabase } from "~/app/test/db";
import { bindModels } from "~/app/test/models";
import { DEV_TEAM, DEV_USER } from "~/config/dev-user";

let { db } = createTestDatabase();

vi.doMock("~/app/initializers/local-database", async (importOriginal) => ({
	...(await importOriginal<object>()),
	openLocalDatabase: () => db,
}));

let { cli } = await import("~/app/initializers/cli");

describe("db seed", () => {
	test("writes the development user's team with a monitor of every kind", async () => {
		let run = await invoke(cli, ["db", "seed"]);

		expect(run.code).toBe(0);
		expect(run.stdout).toContain("Seeded team\n");

		let models = bindModels(db);
		let team = await models.teams.findByIdOrSlug(DEV_TEAM.slug);
		expect(team?.owner_id).toBe(DEV_USER.id);
		if (!team) return;
		expect(await models.memberships.findFor(team.id, DEV_USER.id)).toMatchObject({
			role: "admin",
		});

		let [http, dns, tcp, cron, flow] = await Promise.all([
			models.monitors.inTeam(team.id).all(),
			models.dnsMonitors.inTeam(team.id).all(),
			models.tcpMonitors.inTeam(team.id).all(),
			models.cronJobMonitors.inTeam(team.id).all(),
			models.flowMonitors.inTeam(team.id).all(),
		]);
		expect([http.length, dns.length, tcp.length, cron.length, flow.length]).toEqual([
			3, 1, 1, 2, 1,
		]);

		let [dnsMonitor] = dns;
		if (!dnsMonitor) return;
		expect(await models.dnsMonitorRecords.forMonitor(dnsMonitor.id).all()).toHaveLength(5);

		let [first] = http;
		if (!first) return;
		expect(await models.monitorDailyStats.listRecentDays(first.id, "http")).toHaveLength(90);
	});
});
