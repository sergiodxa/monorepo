/**
 * Tests for the report downloads: the file each dialect writes, parsed back with the CSV
 * reader, the headers a download needs, and the redirect back to the builder for a query
 * the report cannot use. The auth chain is stood in for by a middleware seeding the team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";
import type { Middleware, RequestHandler } from "remix/router";

import { parse } from "@sdxc/csv";
import { unwrap } from "@sdxc/result";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { createRouter } from "remix/router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import MonitorDailyStats from "~/app/data/monitor-daily-stats";
import { database } from "~/app/http/middleware/database";
import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import { memberships, monitors, statusPages, teams } from "~/database/schema";
import routes from "~/routes/web";

let { handler } = (await import("./report-download")).default as { handler: RequestHandler<any> };

/** 2026-09-29T10:00Z, so "last month" is August 2026. */
const NOW = Date.UTC(2026, 8, 29, 10);

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW);
});

afterEach(() => {
	vi.useRealTimers();
});

/** One team, a member, an HTTP monitor with two days of roll-up in August, and a status page. */
async function createFixture() {
	let { db } = createTestDatabase();
	let write = { touch: true, returnRow: true } as const;

	let team = await db.create(
		teams,
		{ id: crypto.randomUUID(), owner_id: "owner-1", name: "Acme", slug: "acme", logo: null },
		write,
	);
	let membership = await db.create(
		memberships,
		{ id: crypto.randomUUID(), subject_id: "member-1", team_id: team.id, role: "member" },
		write,
	);
	let monitor = await db.create(
		monitors,
		{
			id: crypto.randomUUID(),
			team_id: team.id,
			name: "API, EU",
			author_id: "member-1",
			url: "https://api.example.com/health",
			enabled_at: NOW,
		},
		write,
	);

	for (let [date, successful] of [
		["2026-08-01", 1000],
		["2026-08-02", 999],
	] as const) {
		await MonitorDailyStats.upsertDay(db, {
			monitor_id: monitor.id,
			monitor_type: "http",
			date,
			total_checks: 1000,
			successful_checks: successful,
			failed_checks: 1000 - successful,
			avg_response_time_ms: 120.5,
			max_response_time_ms: 300,
			status: successful === 1000 ? "up" : "degraded",
		});
	}

	return { db, team, membership };
}

/** Seeds `ctx.team`/`ctx.membership`/`ctx.teams`/auth state in place of the real chain. */
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
		ctx.set(Auth, { ok: true, identity: viewer, method: "test" });
		return next();
	};
}

/** Sends a download request through a router mapping only the download route. */
async function download(
	fixture: { db: Database; team: SelectTeam; membership: SelectMembership },
	report: string,
	query: Record<string, string> = {},
	language = "en",
): Promise<Response> {
	let router = createRouter({ middleware: [asyncContext(), database(() => fixture.db)] });
	router.map(routes.app.team.reports.download, {
		middleware: [seedTeam(fixture.team, fixture.membership), i18n],
		handler,
	});

	let url = new URL(
		routes.app.team.reports.download.href({ team: fixture.team.slug, report }),
		"https://uptime.test",
	);
	for (let [name, value] of Object.entries(query)) url.searchParams.set(name, value);

	return router.fetch(new Request(url, { headers: { "Accept-Language": language } }));
}

describe("report downloads", () => {
	test("writes last month's summary in the standard dialect", async () => {
		let fixture = await createFixture();
		let response = await download(fixture, "uptime-summary", { dialect: "standard" });

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(response.headers.get("Content-Disposition")).toBe(
			'attachment; filename="acme-uptime-summary-2026-08.csv"',
		);

		let rows = unwrap(parse(await response.text())).rows;
		expect(rows).toEqual([
			{
				monitor: "API, EU",
				type: "http",
				target: "https://api.example.com/health",
				days_with_data: "2",
				total_checks: "2000",
				successful_checks: "1999",
				failed_checks: "1",
				uptime_percent: "99.95",
				avg_response_time_ms: "120.5",
				max_response_time_ms: "300",
				days_down: "0",
				days_degraded: "1",
				maintenance_minutes: "0",
			},
		]);
	});

	test("writes a spreadsheet file in the reader's locale", async () => {
		let fixture = await createFixture();
		let response = await download(fixture, "uptime-daily", {}, "es");

		let bytes = new Uint8Array(await response.arrayBuffer());
		expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);

		let text = new TextDecoder().decode(bytes);
		let [header] = text.split("\r\n");
		expect(header).toBe(
			"Fecha (UTC);Monitor;Tipo;Comprobaciones totales;Comprobaciones correctas;Comprobaciones fallidas;Disponibilidad %;Tiempo de respuesta medio (ms);Tiempo de respuesta máximo (ms);Estado;Mantenimiento (minutos)",
		);

		let rows = unwrap(parse(text, { delimiter: ";" })).rows;
		expect(rows.map((row) => [row["Fecha (UTC)"], row["Disponibilidad %"], row["Estado"]])).toEqual(
			[
				["2026-08-01", "100", "Disponible"],
				["2026-08-02", "99,9", "Degradado"],
			],
		);
		expect(rows[0]?.["Tiempo de respuesta medio (ms)"]).toBe("120,5");
	});

	test("names a custom range by its first and last day", async () => {
		let fixture = await createFixture();
		let response = await download(fixture, "uptime-daily", {
			from: "2026-08-02",
			to: "2026-08-10",
			dialect: "standard",
		});

		expect(response.headers.get("Content-Disposition")).toBe(
			'attachment; filename="acme-uptime-daily-2026-08-02_2026-08-10.csv"',
		);
		expect(unwrap(parse(await response.text())).rows.map((row) => row.date)).toEqual([
			"2026-08-02",
		]);
	});

	test("sends a query the report cannot use back to the builder, query intact", async () => {
		let fixture = await createFixture();
		let response = await download(fixture, "uptime-summary", {
			from: "2026-09-01",
			to: "2026-09-29",
		});

		expect(response.status).toBe(307);
		let location = new URL(response.headers.get("Location")!, "https://uptime.test");
		expect(location.pathname).toBe(routes.app.team.reports.index.href({ team: "acme" }));
		expect(location.searchParams.get("to")).toBe("2026-09-29");
	});

	test("refuses another team's status page", async () => {
		let fixture = await createFixture();
		let foreign = await fixture.db.create(
			statusPages,
			{
				id: crypto.randomUUID(),
				team_id: "someone-else",
				name: "Theirs",
				slug: "theirs",
				title: "Theirs",
			},
			{ touch: true, returnRow: true },
		);

		let response = await download(fixture, "uptime-summary", {
			monitors: `status-page:${foreign.id}`,
		});
		expect(response.status).toBe(307);
	});

	test("404s an unknown report", async () => {
		let fixture = await createFixture();
		expect((await download(fixture, "incidents")).status).toBe(404);
	});
});
