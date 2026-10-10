/**
 * Tests for the report archive: both reports land in one ZIP under the names the single
 * downloads use, in the dialect the builder chose, and a query the reports cannot use goes
 * back to the builder. The auth chain is stood in for by a middleware seeding the team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";
import type { Middleware, RequestHandler } from "remix/router";

import { parse } from "@sdxc/csv";
import { unwrap } from "@sdxc/result";
import { unzipSync } from "fflate";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { createRouter } from "remix/router";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { database } from "~/app/http/middleware/database";
import i18n from "~/app/http/middleware/i18n";
import models from "~/app/http/middleware/models";
import { createTestDatabase } from "~/app/lib/test/db";
import { bindModels } from "~/app/lib/test/models";
import { memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

let { handler } = (await import("./report-archive")).default as { handler: RequestHandler<any> };

/** 2026-09-29T10:00Z, so "last month" is August 2026. */
const NOW = Date.UTC(2026, 8, 29, 10);

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW);
});

afterEach(() => {
	vi.useRealTimers();
});

/** One team, a member, and an HTTP monitor with two days of roll-up in August. */
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
	let monitor = unwrap(
		await bindModels(db).monitors.create({
			id: crypto.randomUUID(),
			team_id: team.id,
			name: "API, EU",
			author_id: "member-1",
			url: "https://api.example.com/health",
			enabled_at: NOW,
		}),
	);

	for (let [date, successful] of [
		["2026-08-01", 1000],
		["2026-08-02", 999],
	] as const) {
		unwrap(
			await bindModels(db).monitorDailyStats.upsertDay({
				monitor_id: monitor.id,
				monitor_type: "http",
				date,
				total_checks: 1000,
				successful_checks: successful,
				failed_checks: 1000 - successful,
				avg_response_time_ms: 120.5,
				max_response_time_ms: 300,
				status: successful === 1000 ? "up" : "degraded",
			}),
		);
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

/** Sends an archive request through a router mapping only the archive route. */
async function archive(
	fixture: { db: Database; team: SelectTeam; membership: SelectMembership },
	query: Record<string, string> = {},
	language = "en",
): Promise<Response> {
	let router = createRouter({ middleware: [asyncContext(), database(() => fixture.db), models()] });
	router.map(routes.app.team.reports.archive, {
		middleware: [seedTeam(fixture.team, fixture.membership), i18n],
		handler,
	});

	let url = new URL(
		routes.app.team.reports.archive.href({ team: fixture.team.slug }),
		"https://uptime.test",
	);
	for (let [name, value] of Object.entries(query)) url.searchParams.set(name, value);

	return router.fetch(new Request(url, { headers: { "Accept-Language": language } }));
}

describe("report archive", () => {
	test("bundles both of last month's reports under their download names", async () => {
		let response = await archive(await createFixture(), { dialect: "standard" });

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("application/zip");
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(response.headers.get("Content-Disposition")).toBe(
			'attachment; filename="acme-uptime-reports-2026-08.zip"',
		);

		let files = unzipSync(new Uint8Array(await response.arrayBuffer()));
		expect(Object.keys(files)).toEqual([
			"acme-uptime-summary-2026-08.csv",
			"acme-uptime-daily-2026-08.csv",
		]);

		let decoder = new TextDecoder();
		let summary = unwrap(parse(decoder.decode(files["acme-uptime-summary-2026-08.csv"]))).rows;
		expect(summary.map((row) => [row.monitor, row.uptime_percent])).toEqual([["API, EU", "99.95"]]);

		let daily = unwrap(parse(decoder.decode(files["acme-uptime-daily-2026-08.csv"]))).rows;
		expect(daily.map((row) => [row.date, row.status])).toEqual([
			["2026-08-01", "up"],
			["2026-08-02", "degraded"],
		]);
	});

	test("writes both files in the spreadsheet dialect of the reader's locale", async () => {
		let response = await archive(await createFixture(), {}, "es");
		let files = unzipSync(new Uint8Array(await response.arrayBuffer()));

		for (let bytes of Object.values(files)) {
			expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
		}
		let daily = new TextDecoder().decode(files["acme-uptime-daily-2026-08.csv"]);
		expect(daily).toContain("Fecha (UTC);Monitor;");
	});

	test("names a custom range's archive and files by its first and last day", async () => {
		let response = await archive(await createFixture(), {
			from: "2026-08-02",
			to: "2026-08-10",
			dialect: "standard",
		});
		let files = unzipSync(new Uint8Array(await response.arrayBuffer()));

		expect(response.headers.get("Content-Disposition")).toBe(
			'attachment; filename="acme-uptime-reports-2026-08-02_2026-08-10.zip"',
		);
		expect(Object.keys(files)).toEqual([
			"acme-uptime-summary-2026-08-02_2026-08-10.csv",
			"acme-uptime-daily-2026-08-02_2026-08-10.csv",
		]);
	});

	test("sends a query the reports cannot use back to the builder, query intact", async () => {
		let response = await archive(await createFixture(), { from: "2026-09-01", to: "2026-09-29" });

		expect(response.status).toBe(307);
		let location = new URL(response.headers.get("Location")!, "https://uptime.test");
		expect(location.pathname).toBe(routes.app.team.reports.index.href({ team: "acme" }));
		expect(location.searchParams.get("to")).toBe("2026-09-29");
	});
});
