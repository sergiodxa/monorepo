/**
 * Tests for the status page maintenance feed and the single-window download. Each feed is
 * read back through the iCalendar parser, so the assertions are on what a calendar client
 * would see: which windows are published, their RRULEs and lengths, and their descriptions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";
import type { Middleware, RequestHandler } from "remix/router";

import { createTranslator } from "@sdxc/i18n";
import { parse } from "@sdxc/icalendar";
import { stringifyRecurrence } from "@sdxc/icalendar/rrule";
import { isFailure, unwrap } from "@sdxc/result";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { InsertMaintenanceWindow } from "~/database/schema";

import { database } from "~/app/http/middleware/database";
import models from "~/app/http/middleware/models";
import { createTestDatabase } from "~/app/lib/test/db";
import { bindModels } from "~/app/lib/test/models";
import en from "~/app/locales/en";
import { monitors, statusPageMonitors, statusPages, teams } from "~/database/schema";
import routes from "~/routes/web";

import statusPageCalendar from "./status-page-calendar";
import statusPageMaintenanceEvent from "./status-page-maintenance-event";

let { intl } = createTranslator({
	resources: { en },
	supportedLanguages: ["en"],
	fallbackLanguage: "en",
})();

/** Seeds `ctx.locale` and `ctx.intl`, all a public route reads from i18n. */
function seedLocale(): Middleware {
	return (ctx, next) => {
		ctx.locale = "en";
		ctx.intl = intl;
		return next();
	};
}

/** A team with one public page showing one HTTP monitor under a public label. */
async function createFixture(options: { isPublic?: boolean } = {}) {
	let { db } = createTestDatabase();
	let team = await db.create(
		teams,
		{ id: crypto.randomUUID(), owner_id: "owner-1", name: "Acme", slug: "acme", logo: null },
		{ touch: true, returnRow: true },
	);
	let monitor = await db.create(
		monitors,
		{
			id: crypto.randomUUID(),
			team_id: team.id,
			author_id: "member-1",
			enabled_at: Date.now(),
			name: "internal-api-prod",
			url: "https://example.com",
		},
		{ touch: true, returnRow: true },
	);
	let page = await db.create(
		statusPages,
		{
			id: crypto.randomUUID(),
			team_id: team.id,
			name: "Acme Status",
			slug: "acme-status",
			title: "Acme Status",
			description: null,
			logo_url: null,
			custom_domain: null,
			is_public: options.isPublic ?? true,
			show_overall_status: true,
		},
		{ touch: true, returnRow: true },
	);
	await db.create(statusPageMonitors, {
		status_page_id: page.id,
		monitor_id: monitor.id,
		display_name: "API",
		order: 0,
	});
	return { db, team, monitor, page };
}

/** Creates a window for the team, running for the next hour unless overridden. */
async function createWindow(
	db: Database,
	teamId: string,
	overrides: Partial<InsertMaintenanceWindow> = {},
) {
	let now = Date.now();
	return unwrap(
		await bindModels(db).maintenanceWindows.create({
			name: "Database upgrade",
			starts_at: now,
			ends_at: now + 3_600_000,
			monitor_id: null,
			...overrides,
			team_id: teamId,
		}),
	);
}

/** Sends a GET through a router mapping both calendar routes. */
async function get(db: Database, path: string): Promise<Response> {
	let router = createRouter({
		middleware: [asyncContext(), database(() => db), models(), seedLocale()],
	});
	router.map(routes.statusPageCalendar, statusPageCalendar as RequestHandler<any>);
	router.map(routes.statusPageMaintenanceEvent, statusPageMaintenanceEvent as RequestHandler<any>);
	return router.fetch(new Request(new URL(path, "https://uptime.test")));
}

/** Fetches and parses a page's feed. */
async function feed(db: Database, slug: string) {
	let response = await get(db, routes.statusPageCalendar.href({ slug }));
	let parsed = parse(await response.text());
	if (isFailure(parsed)) throw parsed.error;
	return { response, calendar: parsed.data.calendar };
}

describe("GET /status/:slug/maintenance.ics", () => {
	test("responds 404 for an unknown or private page", async () => {
		let { db } = await createFixture({ isPublic: false });

		expect((await get(db, routes.statusPageCalendar.href({ slug: "acme-status" }))).status).toBe(
			404,
		);
		expect((await get(db, routes.statusPageCalendar.href({ slug: "nope" }))).status).toBe(404);
	});

	test("serves a subscribable calendar named after the page", async () => {
		let { db } = await createFixture();

		let { response, calendar } = await feed(db, "acme-status");

		expect(response.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
		expect(response.headers.get("Content-Disposition")).toBeNull();
		expect(calendar.name).toBe("Acme Status maintenance");
		expect(calendar.refreshInterval).toEqual({ hours: 1 });
		expect(calendar.url).toBe("https://uptime.test/status/acme-status");
	});

	test("publishes a window with its range, summary and affected services", async () => {
		let { db, team } = await createFixture();
		let window = await createWindow(db, team.id);

		let { calendar } = await feed(db, "acme-status");

		expect(calendar.events).toHaveLength(1);
		let [event] = calendar.events;
		expect(event?.uid).toBe(`${window.id}@uptime`);
		expect(event?.summary).toBe("Database upgrade");
		expect(event?.description).toBe("Affects: API");
	});

	test("leaves out windows the team hid from status pages", async () => {
		let { db, team } = await createFixture();
		await createWindow(db, team.id, { show_on_status_page: false });

		expect((await feed(db, "acme-status")).calendar.events).toEqual([]);
	});

	test("leaves out windows scoped to services the page does not show", async () => {
		let { db, team } = await createFixture();
		await createWindow(db, team.id, { monitor_type: "http", monitor_id: "another-monitor" });

		expect((await feed(db, "acme-status")).calendar.events).toEqual([]);
	});

	test("publishes monthly:31 as the month's last day and an overnight window by its length", async () => {
		let { db, team } = await createFixture();
		let window = await createWindow(db, team.id, {
			is_recurring: true,
			recurring_pattern: "monthly:31:23:00-01:00",
		});

		let { calendar } = await feed(db, "acme-status");
		let recurring = calendar.events.find((event) => event.uid === `${window.id}-recurring@uptime`);

		expect(recurring?.recurrence && stringifyRecurrence(recurring.recurrence)).toBe(
			"FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1",
		);
		expect(recurring?.duration).toEqual({ hours: 2 });
	});
});

describe("GET /status/:slug/maintenance/:windowId.ics", () => {
	test("downloads one published window under the feed's UID", async () => {
		let { db, team } = await createFixture();
		let window = await createWindow(db, team.id);
		await createWindow(db, team.id, { name: "Other" });

		let response = await get(
			db,
			routes.statusPageMaintenanceEvent.href({ slug: "acme-status", windowId: window.id }),
		);
		let parsed = parse(await response.text());

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Disposition")).toContain("attachment");
		expect(isFailure(parsed) ? [] : parsed.data.calendar.events.map((event) => event.uid)).toEqual([
			`${window.id}@uptime`,
		]);
	});

	test("responds 404 for a hidden window and for another team's", async () => {
		let { db, team } = await createFixture();
		let hidden = await createWindow(db, team.id, { show_on_status_page: false });
		let theirs = await createWindow(db, "team-2");

		for (let windowId of [hidden.id, theirs.id]) {
			let response = await get(
				db,
				routes.statusPageMaintenanceEvent.href({ slug: "acme-status", windowId }),
			);
			expect(response.status).toBe(404);
		}
	});
});
