/**
 * Tests the DNS monitor create/update/delete/check-now actions: successful
 * create/update/delete mutate `dns_monitors` and redirect to the monitor (or list);
 * the manual "check now" action resolves DNS, records the result, and dispatches
 * alerts; validation failure and the team-scoped not-found guard leave the table
 * untouched. *
 * `checkDnsMonitor` resolves DNS over Cloudflare's DNS-over-HTTPS JSON API via the
 * global `fetch` (see `app/services/dns-check.ts`) — there's no binding to mock, so
 * `globalThis.fetch` is swapped out for the duration of those tests instead. It also
 * dispatches alerts through `ctx.email`, so the mail middleware is registered over a
 * recording transport: nothing leaves the process, and no provider SDK is mocked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import { MemoryTransport } from "@pkg/mail/memory";
import mail from "@pkg/mail/middleware";
import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createRouter, type Middleware } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";

import type { SelectMembership, SelectTeam } from "~/database/schema";

import { MAIL_FROM } from "~/app/emails/sender";
import { createTestDatabase } from "~/app/lib/test/db";
import { dnsMonitors, memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

let { createDnsMonitor, updateDnsMonitor, deleteDnsMonitor, checkDnsMonitor } =
	await import("./dns-monitors");
let { MAX_DNS_MONITORS_PER_TEAM } = await import("~/app/data/dns-monitor");

/** Installs `ctx.team`/`ctx.membership` directly, standing in for `requireTeam`/`requireRole`. */
function teamContextMiddleware(team: SelectTeam, membership: SelectMembership): Middleware {
	return (ctx, next) => {
		(ctx as unknown as { team: SelectTeam }).team = team;
		(ctx as unknown as { membership: SelectMembership }).membership = membership;
		return next();
	};
}

/** Posts a form body to one of the DNS monitor actions through the real action, DB, and service container. */
async function postDnsMonitorAction(
	action: unknown,
	route: { method: string; href: (params: { team: string }) => string },
	team: SelectTeam,
	membership: SelectMembership,
	db: ReturnType<typeof createTestDatabase>["db"],
	body: Record<string, string>,
	headers: Record<string, string> = {},
) {
	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	let router = createRouter({
		middleware: [
			asyncContext(),
			formData(),
			mail({ transport: new MemoryTransport(), from: MAIL_FROM }),
		],
	});
	/**
	 * Casts `router.map` itself (rather than its arguments) so this helper can map
	 * several differently-shaped routes without losing type-checking elsewhere.
	 */
	(router.map as (target: unknown, handler: unknown) => void)(route, {
		middleware: [teamContextMiddleware(team, membership)],
		handler: action,
	});

	/** `del(...)` routes (e.g. `delete-dns-monitor`) only match a real HTTP `DELETE` request. */
	let request = new Request(`https://uptime.test${route.href({ team: team.slug })}`, {
		method: route.method,
		body: new URLSearchParams(body),
		headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
	});

	return container.scope(() => router.fetch(request));
}

async function createTeamRow(db: ReturnType<typeof createTestDatabase>["db"]) {
	return await db.create(
		teams,
		{
			id: crypto.randomUUID(),
			owner_id: crypto.randomUUID(),
			name: "Acme",
			slug: `acme-${crypto.randomUUID()}`,
			logo: null,
		},
		{ touch: true, returnRow: true },
	);
}

async function createMembershipRow(
	db: ReturnType<typeof createTestDatabase>["db"],
	teamId: string,
) {
	return await db.create(
		memberships,
		{ id: crypto.randomUUID(), team_id: teamId, subject_id: crypto.randomUUID(), role: "admin" },
		{ touch: true, returnRow: true },
	);
}

/** Minimal well-formed DNS monitor form body. */
function dnsMonitorBody(overrides: Record<string, string> = {}): Record<string, string> {
	return {
		name: "Example A record",
		domain: "example.com",
		record_type: "A",
		expected_value: "",
		interval_seconds: "3600",
		is_enabled: "true",
		...overrides,
	};
}

describe("POST /actions/:team/create-dns-monitor", () => {
	test("creates a DNS monitor and redirects to it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);

		let response = await postDnsMonitorAction(
			createDnsMonitor,
			routes.actions.monitor.dns.create,
			team,
			membership,
			db,
			dnsMonitorBody(),
		);

		let created = await db.findOne(dnsMonitors, { where: { team_id: team.id } });
		expect(created?.name).toBe("Example A record");
		expect(created?.domain).toBe("example.com");

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.dnsMonitors.show.href({ team: team.slug, monitorId: created!.id }),
		);
	});

	test("rejects a blank name and redirects to the new-monitor form without creating a row", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);

		let response = await postDnsMonitorAction(
			createDnsMonitor,
			routes.actions.monitor.dns.create,
			team,
			membership,
			db,
			dnsMonitorBody({ name: "" }),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.dnsMonitors.new.href({ team: team.slug }),
		);
		expect(await db.count(dnsMonitors, { where: { team_id: team.id } })).toBe(0);
	});

	test("returns 422 once the team is at the per-team DNS-monitor cap, without creating a row", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);

		for (let i = 0; i < MAX_DNS_MONITORS_PER_TEAM; i++) {
			await db.create(
				dnsMonitors,
				{
					id: crypto.randomUUID(),
					team_id: team.id,
					name: `Monitor ${i}`,
					domain: `example${i}.com`,
					record_type: "A",
					expected_value: null,
					interval_seconds: 3600,
					is_enabled: true,
					last_checked_at: null,
					last_status: null,
					last_value: null,
				},
				{ touch: true, returnRow: true },
			);
		}

		let response = await postDnsMonitorAction(
			createDnsMonitor,
			routes.actions.monitor.dns.create,
			team,
			membership,
			db,
			dnsMonitorBody({ domain: "onetoomany.com" }),
		);

		expect(response.status).toBe(422);
		expect(await db.count(dnsMonitors, { where: { team_id: team.id } })).toBe(
			MAX_DNS_MONITORS_PER_TEAM,
		);
	});
});

describe("POST /actions/:team/update-dns-monitor", () => {
	test("updates an existing DNS monitor and redirects to it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await db.create(
			dnsMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Old name",
				domain: "example.com",
				record_type: "A",
				expected_value: null,
				interval_seconds: 3600,
				is_enabled: true,
				last_checked_at: null,
				last_status: null,
				last_value: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await postDnsMonitorAction(
			updateDnsMonitor,
			routes.actions.monitor.dns.update,
			team,
			membership,
			db,
			dnsMonitorBody({ monitor_id: monitor.id, name: "New name" }),
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.dnsMonitors.show.href({ team: team.slug, monitorId: monitor.id }),
		);
		let updated = await db.findOne(dnsMonitors, { where: { id: monitor.id } });
		expect(updated?.name).toBe("New name");
	});

	test("404s when the monitor doesn't belong to the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let otherTeam = await createTeamRow(db);
		let monitor = await db.create(
			dnsMonitors,
			{
				id: crypto.randomUUID(),
				team_id: otherTeam.id,
				name: "Someone else's",
				domain: "example.com",
				record_type: "A",
				expected_value: null,
				interval_seconds: 3600,
				is_enabled: true,
				last_checked_at: null,
				last_status: null,
				last_value: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await postDnsMonitorAction(
			updateDnsMonitor,
			routes.actions.monitor.dns.update,
			team,
			membership,
			db,
			dnsMonitorBody({ monitor_id: monitor.id, name: "Hijacked" }),
		);

		expect(response.status).toBe(404);
		let unchanged = await db.findOne(dnsMonitors, { where: { id: monitor.id } });
		expect(unchanged?.name).toBe("Someone else's");
	});

	test("rejects a blank name and redirects to the Referer without mutating the monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await db.create(
			dnsMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Original",
				domain: "example.com",
				record_type: "A",
				expected_value: null,
				interval_seconds: 3600,
				is_enabled: true,
				last_checked_at: null,
				last_status: null,
				last_value: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await postDnsMonitorAction(
			updateDnsMonitor,
			routes.actions.monitor.dns.update,
			team,
			membership,
			db,
			dnsMonitorBody({ monitor_id: monitor.id, name: "" }),
			{ Referer: "https://uptime.test/back" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe("https://uptime.test/back");
		let unchanged = await db.findOne(dnsMonitors, { where: { id: monitor.id } });
		expect(unchanged?.name).toBe("Original");
	});
});

describe("DELETE /actions/:team/delete-dns-monitor", () => {
	test("deletes an existing DNS monitor and redirects to the list", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await db.create(
			dnsMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "To delete",
				domain: "example.com",
				record_type: "A",
				expected_value: null,
				interval_seconds: 3600,
				is_enabled: true,
				last_checked_at: null,
				last_status: null,
				last_value: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await postDnsMonitorAction(
			deleteDnsMonitor,
			routes.actions.monitor.dns.delete,
			team,
			membership,
			db,
			{ monitor_id: monitor.id },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.dnsMonitors.index.href({ team: team.slug }),
		);
		expect(await db.findOne(dnsMonitors, { where: { id: monitor.id } })).toBeNull();
	});

	test("404s when the monitor doesn't belong to the team, without deleting it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let otherTeam = await createTeamRow(db);
		let monitor = await db.create(
			dnsMonitors,
			{
				id: crypto.randomUUID(),
				team_id: otherTeam.id,
				name: "Not yours",
				domain: "example.com",
				record_type: "A",
				expected_value: null,
				interval_seconds: 3600,
				is_enabled: true,
				last_checked_at: null,
				last_status: null,
				last_value: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await postDnsMonitorAction(
			deleteDnsMonitor,
			routes.actions.monitor.dns.delete,
			team,
			membership,
			db,
			{ monitor_id: monitor.id },
		);

		expect(response.status).toBe(404);
		expect(await db.findOne(dnsMonitors, { where: { id: monitor.id } })).not.toBeNull();
	});

	test("rejects a missing monitor_id and redirects without deleting anything", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await db.create(
			dnsMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Still here",
				domain: "example.com",
				record_type: "A",
				expected_value: null,
				interval_seconds: 3600,
				is_enabled: true,
				last_checked_at: null,
				last_status: null,
				last_value: null,
			},
			{ touch: true, returnRow: true },
		);

		let response = await postDnsMonitorAction(
			deleteDnsMonitor,
			routes.actions.monitor.dns.delete,
			team,
			membership,
			db,
			{ unrelated: "value" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.dnsMonitors.index.href({ team: team.slug }),
		);
		expect(await db.findOne(dnsMonitors, { where: { id: monitor.id } })).not.toBeNull();
	});
});

describe("POST /actions/:team/check-dns-monitor", () => {
	test("resolves DNS, records the result, and redirects to the monitor", async () => {
		let originalFetch = globalThis.fetch;
		try {
			globalThis.fetch = mock(async () =>
				Response.json({
					Status: 0,
					Answer: [{ name: "example.com", type: 1, TTL: 60, data: "1.2.3.4" }],
				}),
			) as unknown as typeof fetch;

			let { db } = createTestDatabase();
			let team = await createTeamRow(db);
			let membership = await createMembershipRow(db, team.id);
			let monitor = await db.create(
				dnsMonitors,
				{
					id: crypto.randomUUID(),
					team_id: team.id,
					name: "Example A record",
					domain: "example.com",
					record_type: "A",
					expected_value: "1.2.3.4",
					interval_seconds: 3600,
					is_enabled: true,
					last_checked_at: null,
					last_status: null,
					last_value: null,
				},
				{ touch: true, returnRow: true },
			);

			let response = await postDnsMonitorAction(
				checkDnsMonitor,
				routes.actions.monitor.dns.check,
				team,
				membership,
				db,
				{ monitor_id: monitor.id },
			);

			expect(response.status).toBe(303);
			expect(response.headers.get("Location")).toBe(
				routes.app.team.dnsMonitors.show.href({ team: team.slug, monitorId: monitor.id }),
			);

			let checked = await db.findOne(dnsMonitors, { where: { id: monitor.id } });
			expect(checked?.last_status).toBe("ok");
			expect(checked?.last_value).toBe("1.2.3.4");
			expect(checked?.last_checked_at).not.toBeNull();
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("404s when the monitor doesn't belong to the team, without resolving DNS", async () => {
		let originalFetch = globalThis.fetch;
		let fetchSpy = mock(async () => Response.json({ Status: 0 }));
		try {
			globalThis.fetch = fetchSpy as unknown as typeof fetch;

			let { db } = createTestDatabase();
			let team = await createTeamRow(db);
			let membership = await createMembershipRow(db, team.id);
			let otherTeam = await createTeamRow(db);
			let monitor = await db.create(
				dnsMonitors,
				{
					id: crypto.randomUUID(),
					team_id: otherTeam.id,
					name: "Not yours",
					domain: "example.com",
					record_type: "A",
					expected_value: null,
					interval_seconds: 3600,
					is_enabled: true,
					last_checked_at: null,
					last_status: null,
					last_value: null,
				},
				{ touch: true, returnRow: true },
			);

			let response = await postDnsMonitorAction(
				checkDnsMonitor,
				routes.actions.monitor.dns.check,
				team,
				membership,
				db,
				{ monitor_id: monitor.id },
			);

			expect(response.status).toBe(404);
			expect(fetchSpy).not.toHaveBeenCalled();
			let unchanged = await db.findOne(dnsMonitors, { where: { id: monitor.id } });
			expect(unchanged?.last_checked_at).toBeNull();
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("rejects a missing monitor_id and redirects without resolving DNS", async () => {
		let originalFetch = globalThis.fetch;
		let fetchSpy = mock(async () => Response.json({ Status: 0 }));
		try {
			globalThis.fetch = fetchSpy as unknown as typeof fetch;

			let { db } = createTestDatabase();
			let team = await createTeamRow(db);
			let membership = await createMembershipRow(db, team.id);

			let response = await postDnsMonitorAction(
				checkDnsMonitor,
				routes.actions.monitor.dns.check,
				team,
				membership,
				db,
				{ unrelated: "value" },
			);

			expect(response.status).toBe(303);
			expect(response.headers.get("Location")).toBe(
				routes.app.team.dnsMonitors.index.href({ team: team.slug }),
			);
			expect(fetchSpy).not.toHaveBeenCalled();
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
