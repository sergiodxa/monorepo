/**
 * Tests that adding `maintenance_windows.monitor_type` leaves every window already in the
 * table covering exactly what it covered before.
 *
 * Both ways of getting the backfill wrong are silent: widening a monitor-scoped window
 * starts silencing every monitor the team owns for its duration, and leaving it null beside
 * a non-null id encodes a scope the application cannot resolve. Neither would raise an
 * error, so both are asserted against a real database and a real seed rather than read off
 * the SQL.
 *
 * Each test builds the schema as it stood immediately before this migration, seeds rows
 * against it, and then applies the one file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SqliteDatabase } from "@pkg/cloudflare-mocks/sqlite";

import { openDatabase } from "@pkg/cloudflare-mocks/sqlite";
import { beforeEach, describe, expect, test } from "vitest";

import { applyMigration, applyMigrations } from "~/app/lib/test/db";

/** The migration under test, and the point every seed is written before. */
const MIGRATION = "20260811110000_maintenance_monitor_scope.sql";

let sqlite: SqliteDatabase;

beforeEach(() => {
	sqlite = openDatabase(":memory:");
	applyMigrations(sqlite, MIGRATION);
});

/** One window as the schema held it before this migration: no `monitor_type` column. */
function seedWindow(window: { id: string; monitorId: string | null; name?: string }) {
	sqlite.exec(
		`INSERT INTO maintenance_windows (id, created_at, updated_at, team_id, monitor_id, name,
		                                  starts_at, ends_at, suppress_alerts, show_on_status_page)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			window.id,
			1_000,
			1_000,
			"team-1",
			window.monitorId,
			window.name ?? window.id,
			2_000,
			3_000,
			1,
			1,
		],
	);
}

function readWindows() {
	return sqlite
		.query(
			`SELECT id, monitor_type, monitor_id, name, starts_at, ends_at, suppress_alerts,
			        show_on_status_page
			   FROM maintenance_windows ORDER BY id ASC`,
		)
		.all() as {
		id: string;
		monitor_type: string | null;
		monitor_id: string | null;
		name: string;
		starts_at: number;
		ends_at: number;
		suppress_alerts: number;
		show_on_status_page: number;
	}[];
}

describe("maintenance window monitor scope migration", () => {
	test("leaves a team-wide window team-wide", () => {
		seedWindow({ id: "window-1", monitorId: null });

		applyMigration(sqlite, MIGRATION);

		let [window] = readWindows();
		expect(window?.monitor_type).toBeNull();
		expect(window?.monitor_id).toBeNull();
	});

	/**
	 * The only meaning that id ever had. Reading it as team-wide would suppress alerts for
	 * every monitor the team owns while one monitor is under maintenance.
	 */
	test("backfills a monitor-scoped window to HTTP, the only type its id could name", () => {
		seedWindow({ id: "window-1", monitorId: "monitor-1" });

		applyMigration(sqlite, MIGRATION);

		let [window] = readWindows();
		expect(window?.monitor_type).toBe("http");
		expect(window?.monitor_id).toBe("monitor-1");
	});

	test("never leaves a row with an id but no type, which no query could resolve", () => {
		seedWindow({ id: "window-1", monitorId: null });
		seedWindow({ id: "window-2", monitorId: "monitor-1" });
		seedWindow({ id: "window-3", monitorId: "monitor-2" });

		applyMigration(sqlite, MIGRATION);

		for (let window of readWindows()) {
			expect(window.monitor_id === null || window.monitor_type !== null).toBe(true);
		}
	});

	test("keeps every row, and every other column on it, untouched", () => {
		seedWindow({ id: "window-1", monitorId: null, name: "Quarterly failover" });
		seedWindow({ id: "window-2", monitorId: "monitor-1", name: "Database upgrade" });

		applyMigration(sqlite, MIGRATION);

		let windows = readWindows();
		expect(windows.map((window) => window.id)).toEqual(["window-1", "window-2"]);
		expect(windows.map((window) => window.name)).toEqual([
			"Quarterly failover",
			"Database upgrade",
		]);
		for (let window of windows) {
			expect(window.starts_at).toBe(2_000);
			expect(window.ends_at).toBe(3_000);
			expect(window.suppress_alerts).toBe(1);
			expect(window.show_on_status_page).toBe(1);
		}
	});

	/** The suppression lookup still seeks on it, so a rebuild that dropped it would go unnoticed. */
	test("keeps the index the suppression lookup seeks on", () => {
		applyMigration(sqlite, MIGRATION);

		let indexes = sqlite
			.query(
				`SELECT name FROM sqlite_master
				  WHERE type = 'index' AND tbl_name = 'maintenance_windows'`,
			)
			.all() as { name: string }[];

		expect(indexes.map((row) => row.name)).toContain("maintenance_windows_team_monitor_idx");
	});
});
