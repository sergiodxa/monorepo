/**
 * Tests that adding `alerts.monitor_type` leaves every alert already in the table doing
 * exactly what it did before.
 *
 * Alerts are the rows an on-call rotation depends on, and both ways of getting the
 * backfill wrong are silent: widening a monitor-scoped alert starts sending it everything
 * the team monitors, and leaving it null beside a non-null id encodes a scope the
 * application cannot resolve. Neither would raise an error, so both are asserted against a
 * real database and a real seed rather than read off the SQL.
 *
 * Each test builds the schema as it stood immediately before this migration, seeds rows
 * against it, and then applies the one file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "vitest";

import type { SqliteDatabase } from "@pkg/cloudflare-mocks/sqlite";

import { openDatabase } from "@pkg/cloudflare-mocks/sqlite";

import { applyMigration, applyMigrations } from "~/app/lib/test/db";

/** The migration under test, and the point every seed is written before. */
const MIGRATION = "20260811100000_alert_monitor_scope.sql";

let sqlite: SqliteDatabase;

beforeEach(() => {
	sqlite = openDatabase(":memory:");
	applyMigrations(sqlite, MIGRATION);
});

/** One alert as the schema held it before this migration: no `monitor_type` column. */
function seedAlert(alert: { id: string; monitorId: string | null; name?: string }) {
	sqlite.exec(
		`INSERT INTO alerts (id, created_at, updated_at, team_id, monitor_id, config, name,
		                     notify_on_recovery, cooldown_minutes)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			alert.id,
			1_000,
			1_000,
			"team-1",
			alert.monitorId,
			'{"strategy":"email","config":{"to":"ops@example.com","subjectPrefix":""}}',
			alert.name ?? alert.id,
			1,
			60,
		],
	);
}

function readAlerts() {
	return sqlite
		.query(
			`SELECT id, monitor_type, monitor_id, name, notify_on_recovery, cooldown_minutes, config
			   FROM alerts ORDER BY id ASC`,
		)
		.all() as {
		id: string;
		monitor_type: string | null;
		monitor_id: string | null;
		name: string;
		notify_on_recovery: number;
		cooldown_minutes: number;
		config: string;
	}[];
}

describe("alert monitor scope migration", () => {
	test("leaves a team-wide alert team-wide", () => {
		seedAlert({ id: "alert-1", monitorId: null });

		applyMigration(sqlite, MIGRATION);

		let [alert] = readAlerts();
		expect(alert?.monitor_type).toBeNull();
		expect(alert?.monitor_id).toBeNull();
	});

	/**
	 * The only meaning that id ever had. Reading it as team-wide would subscribe the channel
	 * to every monitor the team owns, which is the failure this backfill exists to prevent.
	 */
	test("backfills a monitor-scoped alert to HTTP, the only type its id could name", () => {
		seedAlert({ id: "alert-1", monitorId: "monitor-1" });

		applyMigration(sqlite, MIGRATION);

		let [alert] = readAlerts();
		expect(alert?.monitor_type).toBe("http");
		expect(alert?.monitor_id).toBe("monitor-1");
	});

	test("never leaves a row with an id but no type, which no query could resolve", () => {
		seedAlert({ id: "alert-1", monitorId: null });
		seedAlert({ id: "alert-2", monitorId: "monitor-1" });
		seedAlert({ id: "alert-3", monitorId: "monitor-2" });

		applyMigration(sqlite, MIGRATION);

		for (let alert of readAlerts()) {
			expect(alert.monitor_id === null || alert.monitor_type !== null).toBe(true);
		}
	});

	test("keeps every row, and every other column on it, untouched", () => {
		seedAlert({ id: "alert-1", monitorId: null, name: "Personal" });
		seedAlert({ id: "alert-2", monitorId: "monitor-1", name: "Discord Alert" });

		applyMigration(sqlite, MIGRATION);

		let alerts = readAlerts();
		expect(alerts.map((alert) => alert.id)).toEqual(["alert-1", "alert-2"]);
		expect(alerts.map((alert) => alert.name)).toEqual(["Personal", "Discord Alert"]);
		for (let alert of alerts) {
			expect(alert.notify_on_recovery).toBe(1);
			expect(alert.cooldown_minutes).toBe(60);
			expect((JSON.parse(alert.config) as { strategy: string }).strategy).toBe("email");
		}
	});

	/** The dispatch lookup still seeks on it, so a rebuild that dropped it would go unnoticed. */
	test("keeps the index the dispatch lookup seeks on", () => {
		applyMigration(sqlite, MIGRATION);

		let indexes = sqlite
			.query("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'alerts'")
			.all() as { name: string }[];

		expect(indexes.map((row) => row.name)).toContain("alerts_team_monitor_idx");
	});
});
