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
 * `cloudflare:workers` is stubbed because the meter event an on-demand check produces is
 * handed to `waitUntil`: the double collects that work instead of dropping it, so a test
 * can await what the response deliberately doesn't. What is pinned there is which requests
 * are billable — a check that resolved DNS is exactly one `ping` event keyed on the history
 * row it wrote, and every request that returned without resolving anything (rejected form,
 * another team's monitor, an owner without an active subscription) is none.
 *
 * The same stub carries a `PING_RESULTS` double, which pins the other half of that: a check
 * that ran writes exactly one Analytics Engine point with the same dimensions the scheduled
 * sweep writes, and a refused one writes none — so billed work and reported work stay in
 * step.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

import type { IngestEvent } from "@pkg/polar";

import { MemoryTransport } from "@pkg/mail/memory";
import mail from "@pkg/mail/middleware";
import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createRouter, type Middleware } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";

import type { SelectMembership, SelectTeam } from "~/database/schema";

import { MAIL_FROM } from "~/app/emails/sender";
import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import {
	dnsMonitorResults,
	dnsMonitors,
	memberships,
	subscriptions,
	teams,
} from "~/database/schema";
import routes from "~/routes/web";

/**
 * Work the check action deferred past its response. Held rather than dropped so a test can
 * await the meter event the visitor is deliberately not made to wait for.
 */
let deferred: Promise<unknown>[] = [];

/** One Analytics Engine data point, as the `PING_RESULTS` binding receives it. */
interface DataPoint {
	blobs: string[];
	doubles: number[];
	indexes: string[];
}

/** Records the data points `writePingResult` sends to Analytics Engine. */
let writeDataPointMock = mock((_point: DataPoint) => {});

/**
 * `waitUntil` collects deferred work, and `PING_RESULTS` records the analytics point the
 * check writes — the only binding these paths touch.
 */
mock.module("cloudflare:workers", () => ({
	env: { PING_RESULTS: { writeDataPoint: writeDataPointMock } },
	waitUntil: (promise: Promise<unknown>) => {
		deferred.push(promise);
	},
}));

let { createDnsMonitor, updateDnsMonitor, deleteDnsMonitor, checkDnsMonitor } =
	await import("./dns-monitors");
let { MAX_DNS_MONITORS_PER_TEAM } = await import("~/app/data/dns-monitor");

/**
 * The billing client the container hands the action, with the one call `ingestPings` makes
 * spied on. The client is real — only the request is intercepted — so the events asserted
 * below are the ones the action actually built.
 */
let polar = new PolarClient({ accessToken: "polar_at_test" });
let ingestEventsSafeMock = spyOn(polar, "ingestEventsSafe");

beforeEach(() => {
	ingestEventsSafeMock.mockClear();
	ingestEventsSafeMock.mockImplementation(async () => true);
	writeDataPointMock.mockClear();
	deferred = [];
});

/** Every event the action handed Polar, once the work it deferred has settled. */
async function ingestedEvents(): Promise<IngestEvent[]> {
	await Promise.all(deferred.splice(0));
	return ingestEventsSafeMock.mock.calls.flatMap(([events]) => events);
}

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
	container.singleton(PolarClient, () => polar);

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
		/** `i18n` because the toasts and the cap message are locale keys, not literals. */
		middleware: [teamContextMiddleware(team, membership), i18n],
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
					interval_seconds: 3600,
					is_enabled: true,
					last_checked_at: null,
					last_status: null,
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
				interval_seconds: 3600,
				is_enabled: true,
				last_checked_at: null,
				last_status: null,
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
				interval_seconds: 3600,
				is_enabled: true,
				last_checked_at: null,
				last_status: null,
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
				interval_seconds: 3600,
				is_enabled: true,
				last_checked_at: null,
				last_status: null,
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
				interval_seconds: 3600,
				is_enabled: true,
				last_checked_at: null,
				last_status: null,
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
				interval_seconds: 3600,
				is_enabled: true,
				last_checked_at: null,
				last_status: null,
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
				interval_seconds: 3600,
				is_enabled: true,
				last_checked_at: null,
				last_status: null,
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

// ADR-026 phase 2.1/2.3 restore these: the "Check now" action now refuses rather than
// resolving one record type, so nothing below describes behaviour that still exists. When the
// domain sweep lands, the action must also meter one ping keyed on the result row it writes —
// which it never did under the old shape, and which these blocks are where that gets proven.
describe.skip("POST /actions/:team/check-dns-monitor", () => {
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
					interval_seconds: 3600,
					is_enabled: true,
					last_checked_at: null,
					last_status: null,
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
					interval_seconds: 3600,
					is_enabled: true,
					last_checked_at: null,
					last_status: null,
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

// ADR-026 phase 2.1/2.3 restore these: the "Check now" action now refuses rather than
// resolving one record type, so nothing below describes behaviour that still exists. When the
// domain sweep lands, the action must also meter one ping keyed on the result row it writes —
// which it never did under the old shape, and which these blocks are where that gets proven.
describe.skip("POST /actions/:team/check-dns-monitor billing", () => {
	/** Resolves every lookup to one A record, so a check that runs always completes. */
	function stubResolver() {
		let original = globalThis.fetch;
		globalThis.fetch = mock(async () =>
			Response.json({
				Status: 0,
				Answer: [{ name: "example.com", type: 1, TTL: 60, data: "1.2.3.4" }],
			}),
		) as unknown as typeof fetch;
		return () => {
			globalThis.fetch = original;
		};
	}

	/** Seeds a monitor owned by `teamId`, which is what an on-demand check needs to exist. */
	async function createMonitorRow(db: ReturnType<typeof createTestDatabase>["db"], teamId: string) {
		return await db.create(
			dnsMonitors,
			{
				id: crypto.randomUUID(),
				team_id: teamId,
				name: "Example A record",
				domain: "example.com",
				interval_seconds: 3600,
				is_enabled: true,
				last_checked_at: null,
				last_status: null,
			},
			{ touch: true, returnRow: true },
		);
	}

	/** Records an owner as having lapsed, which is what the entitlement gate refuses on. */
	async function createLapsedSubscription(
		db: ReturnType<typeof createTestDatabase>["db"],
		ownerId: string,
	) {
		await db.create(
			subscriptions,
			{
				id: crypto.randomUUID(),
				external_customer_id: ownerId,
				polar_subscription_id: crypto.randomUUID(),
				polar_product_id: "product-1",
				status: "canceled",
				current_period_end: null,
				revoked_at: Date.now(),
				polar_modified_at: Date.now(),
			},
			{ touch: true, returnRow: true },
		);
	}

	test("bills exactly one ping, keyed on the result row and attributed to team and monitor", async () => {
		let restore = stubResolver();
		try {
			let { db } = createTestDatabase();
			let team = await createTeamRow(db);
			let membership = await createMembershipRow(db, team.id);
			let monitor = await createMonitorRow(db, team.id);

			await postDnsMonitorAction(
				checkDnsMonitor,
				routes.actions.monitor.dns.check,
				team,
				membership,
				db,
				{ monitor_id: monitor.id },
			);

			let [stored] = await db.findMany(dnsMonitorResults, {
				where: { dns_monitor_id: monitor.id },
			});

			/**
			 * The key is the history row's id, which is what makes this event impossible to
			 * collide with the scheduled sweep's: the sweep bills its own checks under the rows
			 * *it* wrote, and no two checks ever share a row.
			 */
			expect(await ingestedEvents()).toEqual([
				{
					name: "ping",
					externalCustomerId: team.owner_id,
					externalId: `ping:${stored?.id}`,
					metadata: { teamId: team.id, type: "dns", monitorId: monitor.id },
				},
			]);
		} finally {
			restore();
		}
	});

	test("bills nothing when the owner has no active subscription, and resolves nothing", async () => {
		let originalFetch = globalThis.fetch;
		let fetchSpy = mock(async () => Response.json({ Status: 0 }));
		try {
			globalThis.fetch = fetchSpy as unknown as typeof fetch;

			let { db } = createTestDatabase();
			let team = await createTeamRow(db);
			let membership = await createMembershipRow(db, team.id);
			let monitor = await createMonitorRow(db, team.id);
			await createLapsedSubscription(db, team.owner_id);

			let response = await postDnsMonitorAction(
				checkDnsMonitor,
				routes.actions.monitor.dns.check,
				team,
				membership,
				db,
				{ monitor_id: monitor.id },
			);

			expect(response.status).toBe(303);
			// Refused before the lookup, so there is no work to charge for.
			expect(fetchSpy).not.toHaveBeenCalled();
			expect(await ingestedEvents()).toEqual([]);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test("bills nothing for a monitor the team doesn't own", async () => {
		let restore = stubResolver();
		try {
			let { db } = createTestDatabase();
			let team = await createTeamRow(db);
			let membership = await createMembershipRow(db, team.id);
			let otherTeam = await createTeamRow(db);
			let monitor = await createMonitorRow(db, otherTeam.id);

			await postDnsMonitorAction(
				checkDnsMonitor,
				routes.actions.monitor.dns.check,
				team,
				membership,
				db,
				{ monitor_id: monitor.id },
			);

			expect(await ingestedEvents()).toEqual([]);
		} finally {
			restore();
		}
	});

	test("bills nothing when the submitted form is rejected", async () => {
		let restore = stubResolver();
		try {
			let { db } = createTestDatabase();
			let team = await createTeamRow(db);
			let membership = await createMembershipRow(db, team.id);

			await postDnsMonitorAction(
				checkDnsMonitor,
				routes.actions.monitor.dns.check,
				team,
				membership,
				db,
				{ unrelated: "value" },
			);

			expect(await ingestedEvents()).toEqual([]);
		} finally {
			restore();
		}
	});
});

/**
 * A manual check must be indistinguishable from a scheduled one in the dataset: same
 * dimensions, same vocabulary, one point per check. A check the action never ran writes
 * nothing, so a refused request leaves no trace to inflate a chart with.
 */
// ADR-026 phase 2.1/2.3 restore these: the "Check now" action now refuses rather than
// resolving one record type, so nothing below describes behaviour that still exists. When the
// domain sweep lands, the action must also meter one ping keyed on the result row it writes —
// which it never did under the old shape, and which these blocks are where that gets proven.
describe.skip("POST /actions/:team/check-dns-monitor analytics", () => {
	/** Resolves every lookup to one A record, so a check that runs always completes. */
	function stubResolver() {
		let original = globalThis.fetch;
		globalThis.fetch = mock(async () =>
			Response.json({
				Status: 0,
				Answer: [{ name: "example.com", type: 1, TTL: 60, data: "1.2.3.4" }],
			}),
		) as unknown as typeof fetch;
		return () => {
			globalThis.fetch = original;
		};
	}

	/** Seeds a monitor owned by `teamId`, which is what an on-demand check needs to exist. */
	async function createMonitorRow(
		db: ReturnType<typeof createTestDatabase>["db"],
		teamId: string,
		overrides: { expected_value?: string | null; last_value?: string | null } = {},
	) {
		return await db.create(
			dnsMonitors,
			{
				id: crypto.randomUUID(),
				team_id: teamId,
				name: "Example A record",
				domain: "example.com",
				interval_seconds: 3600,
				is_enabled: true,
				last_checked_at: null,
				last_status: null,
				...overrides,
			},
			{ touch: true, returnRow: true },
		);
	}

	test("writes exactly one data point carrying DNS's own status and the team index", async () => {
		let restore = stubResolver();
		try {
			let { db } = createTestDatabase();
			let team = await createTeamRow(db);
			let membership = await createMembershipRow(db, team.id);
			let monitor = await createMonitorRow(db, team.id);

			await postDnsMonitorAction(
				checkDnsMonitor,
				routes.actions.monitor.dns.check,
				team,
				membership,
				db,
				{ monitor_id: monitor.id },
			);

			expect(writeDataPointMock).toHaveBeenCalledTimes(1);

			let [point] = writeDataPointMock.mock.calls[0]!;
			expect(point.blobs).toEqual([monitor.id, "dns", "ok"]);
			expect(point.indexes).toEqual([team.id]);
			/**
			 * The lookup's latency is measured, not stubbed, so only its shape is pinned. The
			 * three that follow are fixed: one row means one check, and DNS has no notion of an
			 * HTTP status to report or to expect.
			 */
			expect(point.doubles).toHaveLength(4);
			expect(point.doubles[0]).toBeGreaterThanOrEqual(0);
			expect(point.doubles.slice(1)).toEqual([1, 0, 0]);
		} finally {
			restore();
		}
	});

	test("records `changed` as-is rather than remapping it onto HTTP's vocabulary", async () => {
		let restore = stubResolver();
		try {
			let { db } = createTestDatabase();
			let team = await createTeamRow(db);
			let membership = await createMembershipRow(db, team.id);
			// An expectation the stubbed resolver's answer doesn't satisfy, so the check classifies
			// as `changed` — a status HTTP has no equivalent for.
			let monitor = await createMonitorRow(db, team.id, { expected_value: "9.9.9.9" });

			await postDnsMonitorAction(
				checkDnsMonitor,
				routes.actions.monitor.dns.check,
				team,
				membership,
				db,
				{ monitor_id: monitor.id },
			);

			expect(writeDataPointMock).toHaveBeenCalledTimes(1);
			expect(writeDataPointMock.mock.calls[0]![0].blobs).toEqual([monitor.id, "dns", "changed"]);
		} finally {
			restore();
		}
	});

	test("writes no data point when the owner has no active subscription", async () => {
		let originalFetch = globalThis.fetch;
		try {
			globalThis.fetch = mock(async () => Response.json({ Status: 0 })) as unknown as typeof fetch;

			let { db } = createTestDatabase();
			let team = await createTeamRow(db);
			let membership = await createMembershipRow(db, team.id);
			let monitor = await createMonitorRow(db, team.id);
			await db.create(
				subscriptions,
				{
					id: crypto.randomUUID(),
					external_customer_id: team.owner_id,
					polar_subscription_id: crypto.randomUUID(),
					polar_product_id: "product-1",
					status: "canceled",
					current_period_end: null,
					revoked_at: Date.now(),
					polar_modified_at: Date.now(),
				},
				{ touch: true, returnRow: true },
			);

			await postDnsMonitorAction(
				checkDnsMonitor,
				routes.actions.monitor.dns.check,
				team,
				membership,
				db,
				{ monitor_id: monitor.id },
			);

			// No lookup ran, so there is no result to report.
			expect(writeDataPointMock).not.toHaveBeenCalled();
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
