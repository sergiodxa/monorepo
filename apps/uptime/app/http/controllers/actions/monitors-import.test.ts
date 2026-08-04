/**
 * Tests for the bulk monitor import action. Runs it behind the real session/i18n/form-data
 * chain — its whole output is a redirect plus what it flashed, so the flash is read back on a
 * second request the way the import page reads it. `cloudflare:workers` is mocked because
 * `~/app/data/monitor` reaches the queue binding at import time, and `ctx.team`/`ctx.membership`
 * plus the viewer are seeded by a fake middleware standing in for `requireUser`/`requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import type { Middleware } from "remix/fetch-router";

import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Auth } from "remix/auth-middleware";
import { createCookie } from "remix/cookie";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";
import { Session } from "remix/session";
import { session } from "remix/session-middleware";
import { createMemorySessionStorage } from "remix/session-storage/memory";

import type { Viewer } from "~/app/http/middleware/auth";
import type { MonitorImportReport } from "~/app/http/validators/monitor-import";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import i18n from "~/app/http/middleware/i18n";
import { MAX_IMPORT_LINES } from "~/app/http/validators/monitor-import";
import { createTestDatabase } from "~/app/lib/test/db";
import { memberships, monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

let queueSend = mock(async () => {});

mock.module("cloudflare:workers", () => ({
	env: { QUEUE: { send: queueSend } },
	waitUntil: (promise: Promise<unknown>) => promise,
}));

let { MONITOR_IMPORT_REPORT, importMonitors } = await import("./monitors-import");

let sessionCookie = createCookie("uptime-test-session", { secrets: ["test-secret"] });
let sessionStorage = createMemorySessionStorage();

/** What the import page reads back after a submission. */
interface FlashedState {
	report: MonitorImportReport | null;
	toast: { intent: string; message: string } | null;
}

/** Creates an in-memory database seeded with one team and a member's membership. */
async function createFixture() {
	let { db } = createTestDatabase();

	let team = await db.create(
		teams,
		{ id: crypto.randomUUID(), owner_id: "owner-1", name: "Acme", slug: "acme", logo: null },
		{ touch: true, returnRow: true },
	);
	let membership = await db.create(
		memberships,
		{ id: crypto.randomUUID(), subject_id: "member-1", team_id: team.id, role: "member" },
		{ touch: true, returnRow: true },
	);

	return { db, team, membership };
}

/** Middleware that seeds `ctx.team`/`ctx.membership`/auth state, standing in for the real chain. */
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
		ctx.set(Auth, { ok: true, identity: viewer, method: "test" });
		return next();
	};
}

/** The `Cookie` header a browser would send back, from a response's `Set-Cookie`s. */
function cookieHeader(response: Response): string {
	return response.headers
		.getSetCookie()
		.map((value) => value.split(";")[0])
		.join("; ");
}

/**
 * Submits the paste box and reads back what the action flashed.
 *
 * The flash is read through a second request on purpose: a flashed value is only readable on
 * the request after the one that wrote it, which is exactly how the import page sees it.
 */
async function submit(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	body: Record<string, string>,
): Promise<{ response: Response; flashed: FlashedState }> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [
			asyncContext(),
			session(sessionCookie, sessionStorage),
			seedTeam(team, membership),
			i18n,
			formData() as Middleware,
		],
	});

	router.map(routes.actions.monitor.http.import, importMonitors);
	router.get("/flashed", (ctx) => {
		let current = ctx.get(Session);
		return Response.json({
			report: current?.get(MONITOR_IMPORT_REPORT) ?? null,
			toast: current?.get("toast") ?? null,
		});
	});

	let request = new Request(
		new URL(routes.actions.monitor.http.import.href({ team: team.slug }), "https://uptime.test"),
		{
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams(body).toString(),
		},
	);

	let response = await container.scope(() => router.fetch(request));
	let read = await container.scope(() =>
		router.fetch(
			new Request("https://uptime.test/flashed", {
				headers: { Cookie: cookieHeader(response) },
			}),
		),
	);

	return { response, flashed: (await read.json()) as FlashedState };
}

describe("importMonitors", () => {
	test("creates one monitor per line and sends the viewer to the monitor list", async () => {
		let { db, team, membership } = await createFixture();

		let { response, flashed } = await submit(db, team, membership, {
			urls: "example.com\nhttps://www.other.example/health\n",
			interval_seconds: "300",
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.monitors.index.href({ team: team.slug }),
		);

		let created = await db.findMany(monitors, { where: { team_id: team.id } });
		expect(created).toHaveLength(2);
		expect(created.map((monitor) => monitor.url).sort()).toEqual([
			"https://example.com/",
			"https://www.other.example/health",
		]);
		expect(created.map((monitor) => monitor.name).sort()).toEqual(["example.com", "other.example"]);
		expect(created.every((monitor) => monitor.interval_seconds === 300)).toBe(true);

		expect(flashed.report).toBeNull();
		expect(flashed.toast?.intent).toBe("success");
	});

	test("creates a monitor indistinguishable from one the single create form makes", async () => {
		let { db, team, membership } = await createFixture();

		await submit(db, team, membership, { urls: "https://example.com/health" });

		let monitor = await db.findOne(monitors, { where: { team_id: team.id } });
		expect(monitor).not.toBeNull();
		// The same author, team, enabled stamp and immediate first-check schedule a
		// hand-made monitor gets, and the table defaults for every field neither form collects.
		expect(monitor?.author_id).toBe(membership.subject_id);
		expect(monitor?.enabled_at).not.toBeNull();
		expect(monitor?.next_due_at).not.toBeNull();
		expect(monitor?.method).toBe("HEAD");
		expect(monitor?.expected_status).toBe(200);
		expect(monitor?.location_hint).toBe("wnam");
		expect(monitor?.timeout_seconds).toBe(10);
		expect(monitor?.degraded_after_ms).toBe(5000);
		expect(monitor?.interval_seconds).toBe(600);
	});

	test("creates the good lines and reports the bad ones back on the form", async () => {
		let { db, team, membership } = await createFixture();

		let { response, flashed } = await submit(db, team, membership, {
			urls: [
				"example.com",
				"",
				"   ",
				"https://example.com/",
				"not a url",
				"other.example/status",
			].join("\n"),
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.monitorsImport.href({ team: team.slug }),
		);

		let created = await db.findMany(monitors, { where: { team_id: team.id } });
		expect(created.map((monitor) => monitor.url).sort()).toEqual([
			"https://example.com/",
			"https://other.example/status",
		]);

		expect(flashed.report).toEqual({
			created: 2,
			overflow: 0,
			rejected: [
				{ line: 4, input: "https://example.com/", reason: "duplicate" },
				{ line: 5, input: "not a url", reason: "invalidUrl" },
			],
		});
		// Some of it landed, so this is not an error however many lines were rejected.
		expect(flashed.toast?.intent).toBe("success");
	});

	test("reports the unexamined remainder when the paste is longer than the cap", async () => {
		let { db, team, membership } = await createFixture();
		let lines = Array.from({ length: MAX_IMPORT_LINES + 2 }, (_, index) => `site-${index}.example`);

		let { flashed } = await submit(db, team, membership, { urls: lines.join("\n") });

		expect(await db.count(monitors, { where: { team_id: team.id } })).toBe(MAX_IMPORT_LINES);
		expect(flashed.report?.created).toBe(MAX_IMPORT_LINES);
		expect(flashed.report?.overflow).toBe(2);
	});

	test("creates nothing and reports an error when no line was usable", async () => {
		let { db, team, membership } = await createFixture();

		let { response, flashed } = await submit(db, team, membership, {
			urls: "not a url\nHomepage\n",
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.monitorsImport.href({ team: team.slug }),
		);
		expect(await db.count(monitors, { where: { team_id: team.id } })).toBe(0);
		expect(flashed.report?.created).toBe(0);
		expect(flashed.report?.rejected).toHaveLength(2);
		expect(flashed.toast?.intent).toBe("error");
	});

	test("sends an empty submission back to the form without creating anything", async () => {
		let { db, team, membership } = await createFixture();

		let { response, flashed } = await submit(db, team, membership, { urls: "" });

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.monitorsImport.href({ team: team.slug }),
		);
		expect(await db.count(monitors, { where: { team_id: team.id } })).toBe(0);
		expect(flashed.report).toBeNull();
		expect(flashed.toast?.intent).toBe("error");
	});

	test("queues no on-demand check, leaving the first one to the scheduler", async () => {
		let { db, team, membership } = await createFixture();
		queueSend.mockClear();

		await submit(db, team, membership, { urls: "example.com\nother.example" });

		expect(queueSend).not.toHaveBeenCalled();
	});
});
