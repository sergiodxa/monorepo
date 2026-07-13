/**
 * Unit tests for the `Alert` data-access model: team-scoped CRUD, the per-team
 * {@link MAX_ALERTS_PER_TEAM} limit, and the HTTP-monitor-specific vs. team-wide
 * lookups `app/services/alerts.ts` uses to resolve applicable alerts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import type { Database, DataManipulationOperation, DataManipulationResult } from "remix/data-table";

import type { AlertConfig } from "~/database/schema";

import Alert, { MAX_ALERTS_PER_TEAM } from "~/app/data/alert";
import { createTestDatabase } from "~/app/lib/test/db";

/**
 * Patches a test database's adapter so writes to the given JSON-typed columns are
 * `JSON.stringify`-d before binding and `JSON.parse`-d back on read. The bun:sqlite
 * test adapter binds column values as-is with no column-type awareness, so passing a
 * plain object into a `c.json()` column (here, `config`) throws at the SQLite binding
 * layer. Every caller works with a parsed object (`alert.config.strategy` in
 * `app/services/alerts.ts`), so this codec is required to exercise `create`/`update`
 * against the real database instead of mocking the model away.
 */
function patchJsonColumns(db: Database, columns: string[]): void {
	let adapter = db.adapter;
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
	db = createTestDatabase().db;
	patchJsonColumns(db, ["config"]);
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

describe("Alert.listForHttpMonitor", () => {
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

		let alerts = await Alert.listForHttpMonitor(db, "team-1", "monitor-1");
		expect(new Set(alerts.map((alert) => alert.id))).toEqual(
			new Set([teamWide.id, monitorSpecific.id]),
		);
	});
});

describe("Alert.listTeamWide", () => {
	test("returns only team-wide alerts, scoped to the team", async () => {
		let teamWide = await Alert.create(db, "team-1", {
			monitor_id: null,
			name: "Team wide",
			config: emailConfig,
		});
		await Alert.create(db, "team-1", {
			monitor_id: "monitor-1",
			name: "Monitor specific",
			config: emailConfig,
		});
		await Alert.create(db, "team-2", {
			monitor_id: null,
			name: "Other team wide",
			config: emailConfig,
		});

		let alerts = await Alert.listTeamWide(db, "team-1");
		expect(alerts.map((alert) => alert.id)).toEqual([teamWide.id]);
	});
});
