/**
 * Unit tests for the `Alert` data-access model: team-scoped CRUD, the per-team
 * {@link MAX_ALERTS_PER_TEAM} limit, and the scope resolution `app/services/alerts.ts`
 * uses to decide which alerts a check result reaches — team-wide, one monitor type, or
 * one monitor, including the pre-`monitor_type` rows that predate the distinction.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	Database,
	DataManipulationOperation,
	DataManipulationResult,
	DatabaseDriver,
} from "remix/data-table";

import { beforeEach, describe, expect, test } from "vitest";

import type { AlertConfig } from "~/database/schema";

import Alert, { MAX_ALERTS_PER_TEAM } from "~/app/data/alert";
import { createTestDatabase } from "~/app/lib/test/db";

/**
 * Patches a test database's driver so writes to the given JSON-typed columns are
 * `JSON.stringify`-d before binding and `JSON.parse`-d back on read. The SQLite
 * test adapter binds column values as-is with no column-type awareness, so passing a
 * plain object into a `c.json()` column (here, `config`) throws at the SQLite binding
 * layer. Every caller works with a parsed object (`alert.config.strategy` in
 * `app/services/alerts.ts`), so this codec is required to exercise `create`/`update`
 * against the real database instead of mocking the model away.
 */
function patchJsonColumns(adapter: DatabaseDriver, columns: string[]): void {
	let originalExecute = adapter.execute.bind(adapter);

	adapter.execute = async (request) => {
		let operation = encodeJsonColumns(request.operation, columns);
		let result = await originalExecute({ ...request, operation });
		return decodeJsonColumns(result, columns);
	};
}

function encodeRow(row: Record<string, unknown>, columns: string[]): Record<string, unknown> {
	let output = { ...row };
	for (let column of columns) {
		if (column in output && output[column] !== null && typeof output[column] !== "string") {
			output[column] = JSON.stringify(output[column]);
		}
	}
	return output;
}

function encodeJsonColumns(
	operation: DataManipulationOperation,
	columns: string[],
): DataManipulationOperation {
	if (operation.kind === "insert") {
		return { ...operation, values: encodeRow(operation.values, columns) };
	}
	if (operation.kind === "update") {
		return { ...operation, changes: encodeRow(operation.changes, columns) };
	}
	return operation;
}

function decodeJsonColumns(
	result: DataManipulationResult,
	columns: string[],
): DataManipulationResult {
	if (!result.rows) return result;

	return {
		...result,
		rows: result.rows.map((row) => {
			let output = { ...row };
			for (let column of columns) {
				if (column in output && typeof output[column] === "string") {
					try {
						output[column] = JSON.parse(output[column] as string);
					} catch {
						// Not JSON — leave the raw string as-is.
					}
				}
			}
			return output;
		}),
	};
}

let db: Database;

let emailConfig: AlertConfig = {
	strategy: "email",
	config: { to: "team@example.com", subjectPrefix: "[Alert]" },
};

beforeEach(() => {
	let database = createTestDatabase();
	db = database.db;
	patchJsonColumns(database.adapter, ["config"]);
});

describe("Alert.create", () => {
	test("creates a team-wide alert", async () => {
		let alert = await Alert.create(db, "team-1", {
			monitor_id: null,
			name: "Email the team",
			config: emailConfig,
		});

		expect(alert.id).toBeTruthy();
		expect(alert.team_id).toBe("team-1");
		expect(alert.monitor_id).toBeNull();
		expect(alert.name).toBe("Email the team");
		expect(alert.config).toEqual(emailConfig);
		expect(typeof alert.created_at).toBe("number");
	});

	test("creates a monitor-specific alert", async () => {
		let alert = await Alert.create(db, "team-1", {
			monitor_id: "monitor-1",
			name: "Monitor alert",
			config: emailConfig,
		});

		expect(alert.monitor_id).toBe("monitor-1");
	});
});

describe("Alert.listByTeam", () => {
	test("lists only the team's alerts, newest first", async () => {
		let first = await Alert.create(db, "team-1", {
			monitor_id: null,
			name: "First",
			config: emailConfig,
		});
		let second = await Alert.create(db, "team-1", {
			monitor_id: null,
			name: "Second",
			config: emailConfig,
		});
		await Alert.create(db, "team-2", { monitor_id: null, name: "Other team", config: emailConfig });

		/** Backdate the first alert so ordering doesn't depend on same-millisecond ties. */
		await Alert.updateById(db, first.id, { created_at: Date.now() - 60_000 });

		let alerts = await Alert.listByTeam(db, "team-1");
		expect(alerts.map((alert) => alert.id)).toEqual([second.id, first.id]);
	});

	test("returns an empty array for a team with no alerts", async () => {
		expect(await Alert.listByTeam(db, "team-1")).toEqual([]);
	});
});

describe("Alert.countByTeam", () => {
	test("counts a team's alerts, honoring the max-alerts limit", async () => {
		await Alert.create(db, "team-1", { monitor_id: null, name: "A", config: emailConfig });
		await Alert.create(db, "team-1", { monitor_id: null, name: "B", config: emailConfig });
		await Alert.create(db, "team-2", { monitor_id: null, name: "C", config: emailConfig });

		expect(await Alert.countByTeam(db, "team-1")).toBe(2);
		expect(await Alert.countByTeam(db, "team-2")).toBe(1);
		expect(MAX_ALERTS_PER_TEAM).toBe(10);
	});
});

describe("Alert.findByIdForTeam", () => {
	test("finds an alert scoped to its team", async () => {
		let alert = await Alert.create(db, "team-1", {
			monitor_id: null,
			name: "A",
			config: emailConfig,
		});

		expect(await Alert.findByIdForTeam(db, "team-1", alert.id)).toEqual(alert);
	});

	test("returns null when the alert belongs to a different team", async () => {
		let alert = await Alert.create(db, "team-1", {
			monitor_id: null,
			name: "A",
			config: emailConfig,
		});

		expect(await Alert.findByIdForTeam(db, "team-2", alert.id)).toBeNull();
	});

	test("returns null for a missing id", async () => {
		expect(await Alert.findByIdForTeam(db, "team-1", "missing")).toBeNull();
	});
});

describe("Alert.updateById", () => {
	test("updates an alert's editable fields, including config", async () => {
		let alert = await Alert.create(db, "team-1", {
			monitor_id: null,
			name: "A",
			config: emailConfig,
		});

		let webhookConfig: AlertConfig = {
			strategy: "webhook",
			config: { url: "https://example.com/hook", secret: "s3cr3t" },
		};
		let updated = await Alert.updateById(db, alert.id, {
			name: "Renamed",
			cooldown_minutes: 15,
			config: webhookConfig,
		});

		expect(updated.name).toBe("Renamed");
		expect(updated.cooldown_minutes).toBe(15);
		expect(updated.config).toEqual(webhookConfig);
	});
});

describe("Alert.deleteById", () => {
	test("deletes an alert", async () => {
		let alert = await Alert.create(db, "team-1", {
			monitor_id: null,
			name: "A",
			config: emailConfig,
		});

		expect(await Alert.deleteById(db, alert.id)).toBe(true);
		expect(await Alert.findByIdForTeam(db, "team-1", alert.id)).toBeNull();
	});
});

describe("Alert.listForMonitor", () => {
	test("returns the monitor-specific alert plus every team-wide alert", async () => {
		let teamWide = await Alert.create(db, "team-1", {
			monitor_id: null,
			name: "Team wide",
			config: emailConfig,
		});
		let monitorSpecific = await Alert.create(db, "team-1", {
			monitor_id: "monitor-1",
			name: "Monitor 1",
			config: emailConfig,
		});
		await Alert.create(db, "team-1", {
			monitor_id: "monitor-2",
			name: "Monitor 2 (different monitor)",
			config: emailConfig,
		});
		await Alert.create(db, "team-2", {
			monitor_id: "monitor-1",
			name: "Other team",
			config: emailConfig,
		});

		let alerts = await Alert.listForMonitor(db, "team-1", "http", "monitor-1");
		expect(new Set(alerts.map((alert) => alert.id))).toEqual(
			new Set([teamWide.id, monitorSpecific.id]),
		);
	});

	test("puts monitor-scoped alerts before team-wide ones", async () => {
		let teamWide = await Alert.create(db, "team-1", {
			monitor_id: null,
			name: "Team wide",
			config: emailConfig,
		});
		let monitorSpecific = await Alert.create(db, "team-1", {
			monitor_id: "monitor-1",
			name: "Monitor 1",
			config: emailConfig,
		});

		let alerts = await Alert.listForMonitor(db, "team-1", "http", "monitor-1");
		expect(alerts.map((alert) => alert.id)).toEqual([monitorSpecific.id, teamWide.id]);
	});

	test("finds the team's alerts and never another team's", async () => {
		let ours = await Alert.create(db, "team-1", {
			monitor_id: "monitor-1",
			name: "Ours",
			config: emailConfig,
		});
		let oursTeamWide = await Alert.create(db, "team-1", {
			monitor_id: null,
			name: "Ours, team wide",
			config: emailConfig,
		});
		let theirs = await Alert.create(db, "team-2", {
			monitor_id: "monitor-1",
			name: "Theirs",
			config: emailConfig,
		});
		let theirsTeamWide = await Alert.create(db, "team-2", {
			monitor_id: null,
			name: "Theirs, team wide",
			config: emailConfig,
		});

		let found = await Alert.listForMonitor(db, "team-1", "http", "monitor-1");
		let ids = found.map((alert) => alert.id);

		expect(ids).toContain(ours.id);
		expect(ids).toContain(oursTeamWide.id);
		expect(ids).not.toContain(theirs.id);
		expect(ids).not.toContain(theirsTeamWide.id);
	});

	test("keeps every alert's notify_on_recovery flag for downstream filtering", async () => {
		await Alert.create(db, "team-1", {
			monitor_id: "monitor-1",
			name: "Recovery on",
			config: emailConfig,
		});
		let silent = await Alert.create(db, "team-1", {
			monitor_id: null,
			name: "Recovery off",
			config: emailConfig,
		});
		await Alert.updateById(db, silent.id, { notify_on_recovery: false });

		let alerts = await Alert.listForMonitor(db, "team-1", "http", "monitor-1");
		expect(alerts.filter((alert) => alert.notify_on_recovery).map((alert) => alert.name)).toEqual([
			"Recovery on",
		]);
	});

	test("returns an empty array when the team has no applicable alerts", async () => {
		await Alert.create(db, "team-2", { monitor_id: null, name: "Other", config: emailConfig });

		expect(await Alert.listForMonitor(db, "team-1", "http", "monitor-1")).toEqual([]);
	});
});

describe("Alert.listForMonitor scoping", () => {
	/** The three scopes a team can express, all present at once, plus another team's copy. */
	async function seedScopes() {
		let teamWide = await Alert.create(db, "team-1", {
			monitor_type: null,
			monitor_id: null,
			name: "Team wide",
			config: emailConfig,
		});
		let everyDns = await Alert.create(db, "team-1", {
			monitor_type: "dns",
			monitor_id: null,
			name: "Every DNS monitor",
			config: emailConfig,
		});
		let oneDns = await Alert.create(db, "team-1", {
			monitor_type: "dns",
			monitor_id: "dns-1",
			name: "One DNS monitor",
			config: emailConfig,
		});
		let everyHttp = await Alert.create(db, "team-1", {
			monitor_type: "http",
			monitor_id: null,
			name: "Every HTTP monitor",
			config: emailConfig,
		});
		let oneHttp = await Alert.create(db, "team-1", {
			monitor_type: "http",
			monitor_id: "http-1",
			name: "One HTTP monitor",
			config: emailConfig,
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
			let alerts = await Alert.listForMonitor(db, "team-1", type, id);
			expect(alerts.map((alert) => alert.id)).toContain(teamWide.id);
		}
	});

	test("a type-scoped alert matches every monitor of that type and no other type", async () => {
		let { everyDns } = await seedScopes();

		let dnsAlerts = await Alert.listForMonitor(db, "team-1", "dns", "dns-7");
		expect(dnsAlerts.map((alert) => alert.id)).toContain(everyDns.id);

		let tcpAlerts = await Alert.listForMonitor(db, "team-1", "tcp", "tcp-1");
		expect(tcpAlerts.map((alert) => alert.id)).not.toContain(everyDns.id);
	});

	test("a monitor-scoped alert matches only that monitor", async () => {
		let { oneDns } = await seedScopes();

		let matched = await Alert.listForMonitor(db, "team-1", "dns", "dns-1");
		expect(matched.map((alert) => alert.id)).toContain(oneDns.id);

		let sibling = await Alert.listForMonitor(db, "team-1", "dns", "dns-2");
		expect(sibling.map((alert) => alert.id)).not.toContain(oneDns.id);
	});

	test("a DNS finding never reaches an alert scoped to HTTP", async () => {
		let { teamWide, everyDns, oneDns, everyHttp, oneHttp } = await seedScopes();

		let matched = await Alert.listForMonitor(db, "team-1", "dns", "dns-1");
		let ids = matched.map((alert) => alert.id);

		expect(new Set(ids)).toEqual(new Set([teamWide.id, everyDns.id, oneDns.id]));
		expect(ids).not.toContain(everyHttp.id);
		expect(ids).not.toContain(oneHttp.id);
	});

	test("an HTTP monitor sees only the alerts that watch it", async () => {
		let { teamWide, everyHttp, oneHttp, everyDns } = await seedScopes();

		let matched = await Alert.listForMonitor(db, "team-1", "http", "http-1");
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
		let legacy = await Alert.create(db, "team-1", {
			monitor_type: null,
			monitor_id: "http-1",
			name: "Legacy",
			config: emailConfig,
		});

		let http = await Alert.listForMonitor(db, "team-1", "http", "http-1");
		expect(http.map((alert) => alert.id)).toContain(legacy.id);

		let otherHttp = await Alert.listForMonitor(db, "team-1", "http", "http-2");
		expect(otherHttp.map((alert) => alert.id)).not.toContain(legacy.id);

		let dns = await Alert.listForMonitor(db, "team-1", "dns", "http-1");
		expect(dns.map((alert) => alert.id)).not.toContain(legacy.id);
	});

	test("never returns another team's alerts, however they are scoped", async () => {
		await seedScopes();
		let theirs = await Alert.create(db, "team-2", {
			monitor_type: "dns",
			monitor_id: "dns-1",
			name: "Theirs",
			config: emailConfig,
		});

		let matched = await Alert.listForMonitor(db, "team-1", "dns", "dns-1");
		expect(matched.map((alert) => alert.id)).not.toContain(theirs.id);
	});
});
