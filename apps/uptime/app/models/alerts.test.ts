/**
 * Tests the alerts model against a migrated in-memory database: team-scoped reads and
 * writes, the per-team limit, the broken-destination mark, and the scope resolution that
 * decides which alerts a check result reaches, legacy rows without a `monitor_type` included.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { Pagination } from "@sdxc/pagination";
import { unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { AlertConfig } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { bindModels } from "~/app/lib/test/models";
import { MAX_ALERTS_PER_TEAM } from "~/app/models/alerts";
import { NEWEST_FIRST } from "~/app/services/pagination";
import { alerts } from "~/database/schema";

let db: Database;
let models: ReturnType<typeof bindModels>;

let emailConfig: AlertConfig = {
	strategy: "email",
	config: { to: "team@example.com", subjectPrefix: "[Alert]" },
};

beforeEach(() => {
	db = createTestDatabase().db;
	models = bindModels(db);
});

/** Creates an alert for `teamId`, failing the test when the write is refused. */
async function createAlert(
	teamId: string,
	values: {
		name: string;
		monitor_id: string | null;
		monitor_type?: "http" | "dns" | "tcp" | "cron" | "flow" | null;
	},
) {
	return unwrap(await models.alerts.create({ team_id: teamId, config: emailConfig, ...values }));
}

describe("alerts.create", () => {
	test("creates a team-wide alert", async () => {
		let alert = await createAlert("team-1", { monitor_id: null, name: "Email the team" });

		expect(alert.id).toBeTruthy();
		expect(alert.team_id).toBe("team-1");
		expect(alert.monitor_id).toBeNull();
		expect(alert.name).toBe("Email the team");
		expect(alert.config).toEqual(emailConfig);
		expect(typeof alert.created_at).toBe("number");
	});

	test("creates a monitor-specific alert", async () => {
		let alert = await createAlert("team-1", { monitor_id: "monitor-1", name: "Monitor alert" });

		expect(alert.monitor_id).toBe("monitor-1");
	});
});

describe("alerts.inTeam", () => {
	test("lists only the team's alerts, newest first", async () => {
		let first = await createAlert("team-1", { monitor_id: null, name: "First" });
		let second = await createAlert("team-1", { monitor_id: null, name: "Second" });
		await createAlert("team-2", { monitor_id: null, name: "Other team" });

		/** Backdate the first alert so the ordering assertion rests on a real time gap. */
		unwrap(await models.alerts.update(first.id, { created_at: Date.now() - 60_000 }));

		let alerts = await models.alerts.inTeam("team-1").orderBy("created_at", "desc").all();
		expect(alerts.map((alert) => alert.id)).toEqual([second.id, first.id]);
	});

	test("returns an empty array for a team with no alerts", async () => {
		expect(await models.alerts.inTeam("team-1").all()).toEqual([]);
	});

	test("pages a team's alerts newest first, leaving the ordering to the pager", async () => {
		let first = await createAlert("team-1", { monitor_id: null, name: "First" });
		let second = await createAlert("team-1", { monitor_id: null, name: "Second" });
		await createAlert("team-2", { monitor_id: null, name: "Other team" });

		/** Backdate the first alert so the ordering assertion rests on a real time gap. */
		unwrap(await models.alerts.update(first.id, { created_at: Date.now() - 60_000 }));

		let page = unwrap(
			await Pagination.byKeyset(models.alerts.inTeam("team-1"), {
				orderBy: NEWEST_FIRST,
				limit: 1,
			}),
		);
		expect(page.items.map((alert) => alert.id)).toEqual([second.id]);

		let next = unwrap(
			await Pagination.byKeyset(models.alerts.inTeam("team-1"), {
				orderBy: NEWEST_FIRST,
				cursor: page.cursors.next,
				limit: 1,
			}),
		);
		expect(next.items.map((alert) => alert.id)).toEqual([first.id]);
	});

	test("counts a team's alerts, honoring the max-alerts limit", async () => {
		await createAlert("team-1", { monitor_id: null, name: "A" });
		await createAlert("team-1", { monitor_id: null, name: "B" });
		await createAlert("team-2", { monitor_id: null, name: "C" });

		expect(await models.alerts.inTeam("team-1").count()).toBe(2);
		expect(await models.alerts.inTeam("team-2").count()).toBe(1);
		expect(MAX_ALERTS_PER_TEAM).toBe(10);
	});

	test("finds an alert scoped to its team", async () => {
		let alert = await createAlert("team-1", { monitor_id: null, name: "A" });

		expect(await models.alerts.inTeam("team-1").where({ id: alert.id }).first()).toEqual(alert);
	});

	test("finds nothing when the alert belongs to a different team", async () => {
		let alert = await createAlert("team-1", { monitor_id: null, name: "A" });

		expect(await models.alerts.inTeam("team-2").where({ id: alert.id }).first()).toBeNull();
	});

	test("finds nothing for a missing id", async () => {
		expect(await models.alerts.inTeam("team-1").where({ id: "missing" }).first()).toBeNull();
	});
});

describe("alerts.update", () => {
	test("updates an alert's editable fields, including config", async () => {
		let alert = await createAlert("team-1", { monitor_id: null, name: "A" });

		let webhookConfig: AlertConfig = {
			strategy: "webhook",
			config: { url: "https://example.com/hook", secret: "s3cr3t" },
		};
		let updated = unwrap(
			await models.alerts.update(alert.id, {
				name: "Renamed",
				cooldown_minutes: 15,
				config: webhookConfig,
			}),
		);

		expect(updated.name).toBe("Renamed");
		expect(updated.cooldown_minutes).toBe(15);
		expect(updated.config).toEqual(webhookConfig);
	});
});

describe("broken destinations", () => {
	test("marks an alert broken with the platform's reason", async () => {
		let alert = await createAlert("team-1", { monitor_id: null, name: "A" });

		await models.alerts.markBroken(alert.id, "Slack answered no_service");

		let found = await models.alerts.find(alert.id);
		expect(found?.broken_at).toEqual(expect.any(Number));
		expect(found?.broken_reason).toBe("Slack answered no_service");
	});

	/** Regression: marking an alert broken used to stamp `updated_at` as if its owner edited it. */
	test("keeps the owner's last edit time when marking an alert broken", async () => {
		let alert = await createAlert("team-1", { monitor_id: null, name: "A" });
		let editedAt = Date.now() - 60_000;
		await db.update(alerts, alert.id, { updated_at: editedAt }, { touch: false });

		await models.alerts.markBroken(alert.id, "gone");

		expect((await models.alerts.find(alert.id))?.updated_at).toBe(editedAt);
	});

	test("clears the broken mark when the alert's channel is saved again", async () => {
		let alert = await createAlert("team-1", { monitor_id: null, name: "A" });
		await models.alerts.markBroken(alert.id, "gone");

		let updated = unwrap(await models.alerts.update(alert.id, { config: emailConfig }));

		expect(updated.broken_at).toBeNull();
		expect(updated.broken_reason).toBeNull();
	});

	test("keeps the broken mark when only the alert's name changes", async () => {
		let alert = await createAlert("team-1", { monitor_id: null, name: "A" });
		await models.alerts.markBroken(alert.id, "gone");

		let updated = unwrap(await models.alerts.update(alert.id, { name: "Renamed" }));

		expect(updated.broken_reason).toBe("gone");
	});
});

describe("alerts.delete", () => {
	test("deletes an alert", async () => {
		let alert = await createAlert("team-1", { monitor_id: null, name: "A" });

		unwrap(await models.alerts.delete(alert.id));
		expect(await models.alerts.find(alert.id)).toBeNull();
	});
});

describe("alerts.listForMonitor", () => {
	test("returns the monitor-specific alert plus every team-wide alert", async () => {
		let teamWide = await createAlert("team-1", { monitor_id: null, name: "Team wide" });
		let monitorSpecific = await createAlert("team-1", {
			monitor_id: "monitor-1",
			name: "Monitor 1",
		});
		await createAlert("team-1", { monitor_id: "monitor-2", name: "Monitor 2 (different monitor)" });
		await createAlert("team-2", { monitor_id: "monitor-1", name: "Other team" });

		let alerts = await models.alerts.listForMonitor("team-1", "http", "monitor-1");
		expect(new Set(alerts.map((alert) => alert.id))).toEqual(
			new Set([teamWide.id, monitorSpecific.id]),
		);
	});

	test("puts monitor-scoped alerts before team-wide ones", async () => {
		let teamWide = await createAlert("team-1", { monitor_id: null, name: "Team wide" });
		let monitorSpecific = await createAlert("team-1", {
			monitor_id: "monitor-1",
			name: "Monitor 1",
		});

		let alerts = await models.alerts.listForMonitor("team-1", "http", "monitor-1");
		expect(alerts.map((alert) => alert.id)).toEqual([monitorSpecific.id, teamWide.id]);
	});

	test("finds the team's alerts and never another team's", async () => {
		let ours = await createAlert("team-1", { monitor_id: "monitor-1", name: "Ours" });
		let oursTeamWide = await createAlert("team-1", { monitor_id: null, name: "Ours, team wide" });
		let theirs = await createAlert("team-2", { monitor_id: "monitor-1", name: "Theirs" });
		let theirsTeamWide = await createAlert("team-2", {
			monitor_id: null,
			name: "Theirs, team wide",
		});

		let found = await models.alerts.listForMonitor("team-1", "http", "monitor-1");
		let ids = found.map((alert) => alert.id);

		expect(ids).toContain(ours.id);
		expect(ids).toContain(oursTeamWide.id);
		expect(ids).not.toContain(theirs.id);
		expect(ids).not.toContain(theirsTeamWide.id);
	});

	test("keeps every alert's notify_on_recovery flag for downstream filtering", async () => {
		await createAlert("team-1", { monitor_id: "monitor-1", name: "Recovery on" });
		let silent = await createAlert("team-1", { monitor_id: null, name: "Recovery off" });
		unwrap(await models.alerts.update(silent.id, { notify_on_recovery: false }));

		let alerts = await models.alerts.listForMonitor("team-1", "http", "monitor-1");
		expect(alerts.filter((alert) => alert.notify_on_recovery).map((alert) => alert.name)).toEqual([
			"Recovery on",
		]);
	});

	test("returns an empty array when the team has no applicable alerts", async () => {
		await createAlert("team-2", { monitor_id: null, name: "Other" });

		expect(await models.alerts.listForMonitor("team-1", "http", "monitor-1")).toEqual([]);
	});
});

describe("alerts.listForMonitor scoping", () => {
	/** The three scopes a team can express, all present at once, plus another team's copy. */
	async function seedScopes() {
		let teamWide = await createAlert("team-1", {
			monitor_type: null,
			monitor_id: null,
			name: "Team wide",
		});
		let everyDns = await createAlert("team-1", {
			monitor_type: "dns",
			monitor_id: null,
			name: "Every DNS monitor",
		});
		let oneDns = await createAlert("team-1", {
			monitor_type: "dns",
			monitor_id: "dns-1",
			name: "One DNS monitor",
		});
		let everyHttp = await createAlert("team-1", {
			monitor_type: "http",
			monitor_id: null,
			name: "Every HTTP monitor",
		});
		let oneHttp = await createAlert("team-1", {
			monitor_type: "http",
			monitor_id: "http-1",
			name: "One HTTP monitor",
		});

		return { teamWide, everyDns, oneDns, everyHttp, oneHttp };
	}

	test("an unscoped alert still matches every monitor of every type", async () => {
		let { teamWide } = await seedScopes();

		for (let [type, id] of [
			["http", "http-1"],
			["dns", "dns-9"],
			["tcp", "tcp-1"],
			["cron", "cron-1"],
		] as const) {
			let alerts = await models.alerts.listForMonitor("team-1", type, id);
			expect(alerts.map((alert) => alert.id)).toContain(teamWide.id);
		}
	});

	test("a type-scoped alert matches every monitor of that type and no other type", async () => {
		let { everyDns } = await seedScopes();

		let dnsAlerts = await models.alerts.listForMonitor("team-1", "dns", "dns-7");
		expect(dnsAlerts.map((alert) => alert.id)).toContain(everyDns.id);

		let tcpAlerts = await models.alerts.listForMonitor("team-1", "tcp", "tcp-1");
		expect(tcpAlerts.map((alert) => alert.id)).not.toContain(everyDns.id);
	});

	test("a monitor-scoped alert matches only that monitor", async () => {
		let { oneDns } = await seedScopes();

		let matched = await models.alerts.listForMonitor("team-1", "dns", "dns-1");
		expect(matched.map((alert) => alert.id)).toContain(oneDns.id);

		let sibling = await models.alerts.listForMonitor("team-1", "dns", "dns-2");
		expect(sibling.map((alert) => alert.id)).not.toContain(oneDns.id);
	});

	test("a DNS finding never reaches an alert scoped to HTTP", async () => {
		let { teamWide, everyDns, oneDns, everyHttp, oneHttp } = await seedScopes();

		let matched = await models.alerts.listForMonitor("team-1", "dns", "dns-1");
		let ids = matched.map((alert) => alert.id);

		expect(new Set(ids)).toEqual(new Set([teamWide.id, everyDns.id, oneDns.id]));
		expect(ids).not.toContain(everyHttp.id);
		expect(ids).not.toContain(oneHttp.id);
	});

	test("an HTTP monitor sees only the alerts that watch it", async () => {
		let { teamWide, everyHttp, oneHttp, everyDns } = await seedScopes();

		let matched = await models.alerts.listForMonitor("team-1", "http", "http-1");
		let ids = matched.map((alert) => alert.id);

		expect(new Set(ids)).toEqual(new Set([teamWide.id, everyHttp.id, oneHttp.id]));
		expect(ids).not.toContain(everyDns.id);
	});

	/**
	 * The pre-`monitor_type` shape, which the migration backfills but which the model must
	 * read correctly regardless: an id with no type could only ever have been an HTTP
	 * monitor, so widening it to every type would start alerting on things nobody chose.
	 */
	test("a legacy row with a monitor but no type is read as HTTP-scoped", async () => {
		let legacy = await createAlert("team-1", {
			monitor_type: null,
			monitor_id: "http-1",
			name: "Legacy",
		});

		let http = await models.alerts.listForMonitor("team-1", "http", "http-1");
		expect(http.map((alert) => alert.id)).toContain(legacy.id);

		let otherHttp = await models.alerts.listForMonitor("team-1", "http", "http-2");
		expect(otherHttp.map((alert) => alert.id)).not.toContain(legacy.id);

		let dns = await models.alerts.listForMonitor("team-1", "dns", "http-1");
		expect(dns.map((alert) => alert.id)).not.toContain(legacy.id);
	});

	test("never returns another team's alerts, however they are scoped", async () => {
		await seedScopes();
		let theirs = await createAlert("team-2", {
			monitor_type: "dns",
			monitor_id: "dns-1",
			name: "Theirs",
		});

		let matched = await models.alerts.listForMonitor("team-1", "dns", "dns-1");
		expect(matched.map((alert) => alert.id)).not.toContain(theirs.id);
	});
});
