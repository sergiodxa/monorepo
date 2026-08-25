/**
 * Tests the DNS monitor actions: create, update, delete, manual check,
 * review submission, record toggle, and zone-file re-import. The DoH
 * endpoint each path resolves through is stubbed with MSW, so a test can
 * count exactly how many queries a request sent. Alerts route through a
 * recording mail transport, so nothing leaves the process. `waitUntil` and
 * the in-memory `PING_RESULTS` dataset are doubled so a test can await the
 * billing and analytics work a response defers.
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnalyticsEngineMock } from "@pkg/cloudflare-mocks";
import type { IngestEvent } from "@pkg/polar";

import { createAnalyticsEngine, createEnv } from "@pkg/cloudflare-mocks";
import { MemoryTransport } from "@pkg/mail/memory";
import mail from "@pkg/mail/middleware";
import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { createRouter, type Middleware } from "remix/router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import type { DnsRecordType } from "~/app/data/dns-monitor-record";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { MAIL_FROM } from "~/app/emails/sender";
import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import {
	dnsMonitorRecords,
	dnsMonitorResults,
	dnsMonitors,
	memberships,
	subscriptions,
	teams,
} from "~/database/schema";
import routes from "~/routes/web";

/**
 * Work the check action defers to `waitUntil`, held here so a test can
 * await the meter event once the response has returned.
 */
let deferred: Promise<unknown>[] = [];

/**
 * The dataset `writePingResult` reports to, held at module scope because
 * the actions capture `env` on import. Enforces the platform's cardinality
 * and size limits on every point written; `beforeEach` resets it between tests.
 */
let pingResults: AnalyticsEngineMock = createAnalyticsEngine();

/** `waitUntil` collects deferred work so a test can await it once the response returns. */
vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({ PING_RESULTS: pingResults }),
	waitUntil: (promise: Promise<unknown>) => {
		deferred.push(promise);
	},
}));

let {
	createDnsMonitor,
	updateDnsMonitor,
	deleteDnsMonitor,
	checkDnsMonitor,
	reviewDnsMonitor,
	toggleDnsMonitorRecord,
	importDnsMonitorZoneFile,
} = await import("./dns-monitors");
let { MAX_DNS_MONITORS_PER_TEAM } = await import("~/app/data/dns-monitor");

const DOH_URL = "https://cloudflare-dns.com/dns-query";

let server = setupServer();

/** How many DoH queries the request under test sent — zero is the assertion that matters. */
let queries = 0;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The DoH JSON envelope, in the shape a handler needs to answer one query. */
interface DohBody {
	Status?: number;
	Answer?: { name: string; type: number; TTL: number; data: string }[];
}

/**
 * Answers the sweep: one `A` record at every name, nothing of any other type. Every answer
 * is counted, so a test can prove a refused request resolved nothing at all.
 */
function stubResolver(bodies: Record<string, DohBody> = {}) {
	let answers: Record<string, DohBody> = {
		A: { Status: 0, Answer: [{ name: "example.com", type: 1, TTL: 60, data: "1.2.3.4" }] },
		...bodies,
	};

	server.use(
		http.get(DOH_URL, ({ request }) => {
			queries++;
			let type = new URL(request.url).searchParams.get("type") ?? "";
			return HttpResponse.json(answers[type] ?? { Status: 0 });
		}),
	);
}

/**
 * The billing client the container hands the action, with the one call `ingestPings` makes
 * spied on. The client is real — only the request is intercepted — so the events asserted
 * below are the ones the action actually built.
 */
let polar = new PolarClient({ accessToken: "polar_at_test" });
let ingestEventsSafeMock = vi.spyOn(polar, "ingestEventsSafe");

beforeEach(() => {
	ingestEventsSafeMock.mockClear();
	ingestEventsSafeMock.mockImplementation(async () => true);
	pingResults.reset();
	deferred = [];
	queries = 0;
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
	body: Record<string, string> | URLSearchParams,
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
	 * Casts `router.map` itself so this helper can map several
	 * differently-shaped routes while keeping type-checking everywhere else.
	 */
	(router.map as (target: unknown, handler: unknown) => void)(route, {
		/** `i18n` because the toasts and the cap message are locale keys. */
		middleware: [teamContextMiddleware(team, membership), i18n],
		handler: action,
	});

	/** `del(...)` routes (e.g. `delete-dns-monitor`) only match a real HTTP `DELETE` request. */
	let request = new Request(`https://uptime.test${route.href({ team: team.slug })}`, {
		method: route.method,
		body: body instanceof URLSearchParams ? body : new URLSearchParams(body),
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

/** Seeds a monitor owned by `teamId`, which is what every record-level action needs to exist. */
async function createMonitorRow(
	db: ReturnType<typeof createTestDatabase>["db"],
	teamId: string,
	overrides: Record<string, unknown> = {},
) {
	return await db.create(
		dnsMonitors,
		{
			id: crypto.randomUUID(),
			team_id: teamId,
			name: "Example domain",
			domain: "example.com",
			zone_file_imported_at: null,
			interval_seconds: 86_400,
			is_enabled: true,
			last_checked_at: null,
			last_status: null,
			...overrides,
		},
		{ touch: true, returnRow: true },
	);
}

/** Seeds one tracked record, which is the baseline a check diffs its answers against. */
async function createRecordRow(
	db: ReturnType<typeof createTestDatabase>["db"],
	monitorId: string,
	overrides: {
		name?: string;
		record_type?: DnsRecordType;
		value?: string;
		is_enabled?: boolean;
	} = {},
) {
	return await db.create(
		dnsMonitorRecords,
		{
			id: crypto.randomUUID(),
			dns_monitor_id: monitorId,
			name: overrides.name ?? "example.com",
			record_type: overrides.record_type ?? "A",
			value: overrides.value ?? "1.2.3.4",
			source: "resolver",
			is_enabled: overrides.is_enabled ?? true,
			status: "ok",
			first_seen_at: Date.now(),
			last_seen_at: Date.now(),
			last_checked_at: null,
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

/** Minimal well-formed DNS monitor form body. */
function dnsMonitorBody(overrides: Record<string, string> = {}): Record<string, string> {
	return {
		name: "Example domain",
		domain: "example.com",
		interval_seconds: "86400",
		is_enabled: "true",
		...overrides,
	};
}

describe("POST /actions/:team/create-dns-monitor", () => {
	test("creates a DNS monitor, discovers its apex records, and redirects to the review screen", async () => {
		stubResolver();
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
		expect(created?.name).toBe("Example domain");
		expect(created?.domain).toBe("example.com");
		expect(created?.zone_file_imported_at).toBeNull();

		let records = await db.findMany(dnsMonitorRecords, {
			where: { dns_monitor_id: created!.id },
		});
		expect(records).toHaveLength(1);
		expect(records[0]?.value).toBe("1.2.3.4");
		expect(records[0]?.source).toBe("resolver");

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.dnsMonitors.review.href({ team: team.slug, monitorId: created!.id }),
		);
	});

	test("imports the names a pasted zone file declares, and keeps a declared-but-unresolved record unwatched", async () => {
		stubResolver();
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);

		let response = await postDnsMonitorAction(
			createDnsMonitor,
			routes.actions.monitor.dns.create,
			team,
			membership,
			db,
			dnsMonitorBody({ zone_file: "www\t1\tIN\tA\t5.6.7.8 ; secret-comment" }),
		);

		expect(response.status).toBe(303);
		let created = await db.findOne(dnsMonitors, { where: { team_id: team.id } });
		expect(created?.zone_file_imported_at).not.toBeNull();

		let records = await db.findMany(dnsMonitorRecords, {
			where: { dns_monitor_id: created!.id },
		});
		let declared = records.find((record) => record.value === "5.6.7.8");
		expect(declared?.name).toBe("www.example.com");
		expect(declared?.source).toBe("zone_file");
		expect(declared?.is_enabled).toBeFalsy();
		expect(declared?.status).toBe("missing");

		let resolved = records.find(
			(record) => record.name === "www.example.com" && record.source === "resolver",
		);
		expect(resolved?.is_enabled).toBeTruthy();
	});

	/**
	 * The paste is a map of somebody's infrastructure. It is parsed and dropped,
	 * so every stored byte belongs to a record we now monitor — a comment is
	 * the clearest probe for that, since nothing legitimate would store one.
	 */
	test("stores no trace of the pasted zone file itself", async () => {
		stubResolver();
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);

		await postDnsMonitorAction(
			createDnsMonitor,
			routes.actions.monitor.dns.create,
			team,
			membership,
			db,
			dnsMonitorBody({ zone_file: "www\t1\tIN\tA\t5.6.7.8 ; secret-comment" }),
		);

		let created = await db.findOne(dnsMonitors, { where: { team_id: team.id } });
		let records = await db.findMany(dnsMonitorRecords, {
			where: { dns_monitor_id: created!.id },
		});

		expect(JSON.stringify({ created, records })).not.toContain("secret-comment");
	});

	/** The sweep is the expensive half of a create, run only once validation accepts the form. */
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
		expect(queries).toBe(0);
	});

	test("returns 422 once the team is at the per-team DNS-monitor cap, without creating a row", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);

		for (let i = 0; i < MAX_DNS_MONITORS_PER_TEAM; i++) {
			await createMonitorRow(db, team.id, { name: `Monitor ${i}`, domain: `example${i}.com` });
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
		expect(queries).toBe(0);
	});
});

describe("POST /actions/:team/update-dns-monitor", () => {
	test("updates an existing DNS monitor and redirects to it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await createMonitorRow(db, team.id, { name: "Old name" });

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
		let monitor = await createMonitorRow(db, otherTeam.id, { name: "Someone else's" });

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
		let monitor = await createMonitorRow(db, team.id, { name: "Original" });

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
		let monitor = await createMonitorRow(db, team.id, { name: "To delete" });

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
		let monitor = await createMonitorRow(db, otherTeam.id, { name: "Not yours" });

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
		let monitor = await createMonitorRow(db, team.id, { name: "Still here" });

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
	/** One name, every supported record type: six DoH queries per domain. */
	test("sweeps every tracked name, records the result, and redirects to the monitor", async () => {
		stubResolver();
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await createMonitorRow(db, team.id);
		await createRecordRow(db, monitor.id);

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

		let [stored] = await db.findMany(dnsMonitorResults, { where: { dns_monitor_id: monitor.id } });
		expect(stored?.records_checked).toBe(1);
		expect(stored?.queries_failed).toBe(0);
		expect(queries).toBe(6);
	});

	/**
	 * A record appearing beside the ones already tracked is a finding, imported
	 * unwatched so accepting it takes the user's own action, taken after review.
	 */
	test("reports a record nobody configured as new, and stores it unwatched", async () => {
		stubResolver({
			A: {
				Status: 0,
				Answer: [
					{ name: "example.com", type: 1, TTL: 60, data: "1.2.3.4" },
					{ name: "example.com", type: 1, TTL: 60, data: "6.6.6.6" },
				],
			},
		});
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await createMonitorRow(db, team.id);
		await createRecordRow(db, monitor.id);

		await postDnsMonitorAction(
			checkDnsMonitor,
			routes.actions.monitor.dns.check,
			team,
			membership,
			db,
			{ monitor_id: monitor.id },
		);

		let checked = await db.findOne(dnsMonitors, { where: { id: monitor.id } });
		expect(checked?.last_status).toBe("changed");

		let [stored] = await db.findMany(dnsMonitorResults, { where: { dns_monitor_id: monitor.id } });
		expect(stored?.records_new).toBe(1);

		let discovered = await db.findOne(dnsMonitorRecords, {
			where: { dns_monitor_id: monitor.id, value: "6.6.6.6" },
		});
		expect(discovered?.is_enabled).toBeFalsy();
		expect(discovered?.status).toBe("new");
	});

	/**
	 * A resolver's bad minute reports as `error`, and the record it could not
	 * query keeps the status it already had.
	 */
	test("records a failed query as an error without marking anything missing", async () => {
		server.use(
			http.get(DOH_URL, () => {
				queries++;
				return new HttpResponse(null, { status: 500 });
			}),
		);
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await createMonitorRow(db, team.id);
		let record = await createRecordRow(db, monitor.id);

		await postDnsMonitorAction(
			checkDnsMonitor,
			routes.actions.monitor.dns.check,
			team,
			membership,
			db,
			{ monitor_id: monitor.id },
		);

		let checked = await db.findOne(dnsMonitors, { where: { id: monitor.id } });
		expect(checked?.last_status).toBe("error");

		let [stored] = await db.findMany(dnsMonitorResults, { where: { dns_monitor_id: monitor.id } });
		expect(stored?.queries_failed).toBe(6);
		expect(stored?.records_missing).toBe(0);

		let untouched = await db.findOne(dnsMonitorRecords, { where: { id: record.id } });
		expect(untouched?.status).toBe("ok");
	});

	test("404s when the monitor doesn't belong to the team, without resolving anything", async () => {
		stubResolver();
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let otherTeam = await createTeamRow(db);
		let monitor = await createMonitorRow(db, otherTeam.id, { name: "Not yours" });

		let response = await postDnsMonitorAction(
			checkDnsMonitor,
			routes.actions.monitor.dns.check,
			team,
			membership,
			db,
			{ monitor_id: monitor.id },
		);

		expect(response.status).toBe(404);
		expect(queries).toBe(0);
		let unchanged = await db.findOne(dnsMonitors, { where: { id: monitor.id } });
		expect(unchanged?.last_checked_at).toBeNull();
	});

	test("rejects a missing monitor_id and redirects without resolving anything", async () => {
		stubResolver();
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
		expect(queries).toBe(0);
	});
});

describe("POST /actions/:team/check-dns-monitor billing", () => {
	test("bills exactly one ping for the whole sweep, keyed on the result row", async () => {
		stubResolver();
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await createMonitorRow(db, team.id);
		await createRecordRow(db, monitor.id);

		await postDnsMonitorAction(
			checkDnsMonitor,
			routes.actions.monitor.dns.check,
			team,
			membership,
			db,
			{ monitor_id: monitor.id },
		);

		let [stored] = await db.findMany(dnsMonitorResults, { where: { dns_monitor_id: monitor.id } });

		/**
		 * Six queries, one ping: a domain monitor sells one monitored domain, so
		 * the sweep bills as a flat unit regardless of query count. The history
		 * row's id keys the event, keeping it distinct from the scheduled sweep's.
		 */
		expect(queries).toBe(6);
		expect(await ingestedEvents()).toEqual([
			{
				name: "ping",
				externalCustomerId: team.owner_id,
				externalId: `ping:${stored?.id}`,
				metadata: { teamId: team.id, type: "dns", monitorId: monitor.id },
			},
		]);
	});

	test("bills nothing when the owner has no active subscription, and resolves nothing", async () => {
		stubResolver();
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
		expect(queries).toBe(0);
		expect(await ingestedEvents()).toEqual([]);
	});

	test("bills nothing for a monitor the team doesn't own", async () => {
		stubResolver();
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
	});

	test("bills nothing when the submitted form is rejected", async () => {
		stubResolver();
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
	});
});

/**
 * A manual check matches a scheduled one in the dataset: same dimensions,
 * same vocabulary, one point per check, so a refused request leaves the
 * chart exactly as it was.
 */
describe("POST /actions/:team/check-dns-monitor analytics", () => {
	test("writes exactly one data point carrying DNS's own status and the team index", async () => {
		stubResolver();
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await createMonitorRow(db, team.id);
		await createRecordRow(db, monitor.id);

		await postDnsMonitorAction(
			checkDnsMonitor,
			routes.actions.monitor.dns.check,
			team,
			membership,
			db,
			{ monitor_id: monitor.id },
		);

		let [point] = pingResults.dataPoints;
		expect(pingResults.dataPoints).toHaveLength(1);
		expect(point?.blobs).toEqual([monitor.id, "dns", "ok"]);
		expect(point?.indexes).toEqual([team.id]);
		/**
		 * The sweep's latency is measured live, so only its shape is pinned. The
		 * three that follow are fixed: one row means one check, and DNS's own
		 * status vocabulary carries no HTTP code.
		 */
		let doubles = point?.doubles ?? [];
		expect(doubles).toHaveLength(4);
		expect(doubles[0]).toBeGreaterThanOrEqual(0);
		expect(doubles.slice(1)).toEqual([1, 0, 0]);
	});

	test("records `changed` as-is rather than remapping it onto HTTP's vocabulary", async () => {
		stubResolver();
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await createMonitorRow(db, team.id);
		await createRecordRow(db, monitor.id, { value: "9.9.9.9" });

		await postDnsMonitorAction(
			checkDnsMonitor,
			routes.actions.monitor.dns.check,
			team,
			membership,
			db,
			{ monitor_id: monitor.id },
		);

		expect(pingResults.dataPoints).toHaveLength(1);
		expect(pingResults.dataPoints[0]?.blobs).toEqual([monitor.id, "dns", "changed"]);
	});

	test("writes no data point when the owner has no active subscription", async () => {
		stubResolver();
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await createMonitorRow(db, team.id);
		await createLapsedSubscription(db, team.owner_id);

		await postDnsMonitorAction(
			checkDnsMonitor,
			routes.actions.monitor.dns.check,
			team,
			membership,
			db,
			{ monitor_id: monitor.id },
		);

		expect(pingResults.dataPoints).toHaveLength(0);
	});
});

describe("POST /actions/:team/review-dns-monitor", () => {
	test("watches the checked records and stores the rest disabled rather than deleting them", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await createMonitorRow(db, team.id);
		let kept = await createRecordRow(db, monitor.id, { value: "1.2.3.4" });
		let declined = await createRecordRow(db, monitor.id, { value: "5.6.7.8" });

		let body = new URLSearchParams({ monitor_id: monitor.id });
		body.append("record_ids", kept.id);

		let response = await postDnsMonitorAction(
			reviewDnsMonitor,
			routes.actions.monitor.dns.review,
			team,
			membership,
			db,
			body,
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.dnsMonitors.show.href({ team: team.slug, monitorId: monitor.id }),
		);

		expect(
			(await db.findOne(dnsMonitorRecords, { where: { id: kept.id } }))?.is_enabled,
		).toBeTruthy();
		/**
		 * Still there, and that is the invariant the whole diff rests on: a dropped record
		 * would be rediscovered as new on the very next check and alert forever.
		 */
		let stored = await db.findOne(dnsMonitorRecords, { where: { id: declined.id } });
		expect(stored).not.toBeNull();
		expect(stored?.is_enabled).toBeFalsy();
	});

	test("404s when the monitor doesn't belong to the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let otherTeam = await createTeamRow(db);
		let monitor = await createMonitorRow(db, otherTeam.id);
		let record = await createRecordRow(db, monitor.id, { is_enabled: false });

		let body = new URLSearchParams({ monitor_id: monitor.id });
		body.append("record_ids", record.id);

		let response = await postDnsMonitorAction(
			reviewDnsMonitor,
			routes.actions.monitor.dns.review,
			team,
			membership,
			db,
			body,
		);

		expect(response.status).toBe(404);
		expect(
			(await db.findOne(dnsMonitorRecords, { where: { id: record.id } }))?.is_enabled,
		).toBeFalsy();
	});
});

describe("POST /actions/:team/toggle-dns-monitor-record", () => {
	test("stops watching a record when the flag is absent", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await createMonitorRow(db, team.id);
		let record = await createRecordRow(db, monitor.id);

		let response = await postDnsMonitorAction(
			toggleDnsMonitorRecord,
			routes.actions.monitor.dns.toggleRecord,
			team,
			membership,
			db,
			{ monitor_id: monitor.id, record_id: record.id },
		);

		expect(response.status).toBe(303);
		expect(
			(await db.findOne(dnsMonitorRecords, { where: { id: record.id } }))?.is_enabled,
		).toBeFalsy();
	});

	test("starts watching a record, settling a newly discovered one", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await createMonitorRow(db, team.id);
		let record = await createRecordRow(db, monitor.id, { is_enabled: false });

		await postDnsMonitorAction(
			toggleDnsMonitorRecord,
			routes.actions.monitor.dns.toggleRecord,
			team,
			membership,
			db,
			{ monitor_id: monitor.id, record_id: record.id, is_enabled: "true" },
		);

		expect(
			(await db.findOne(dnsMonitorRecords, { where: { id: record.id } }))?.is_enabled,
		).toBeTruthy();
	});

	test("404s for a record that belongs to another monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await createMonitorRow(db, team.id);
		let otherMonitor = await createMonitorRow(db, team.id, { name: "Other" });
		let record = await createRecordRow(db, otherMonitor.id);

		let response = await postDnsMonitorAction(
			toggleDnsMonitorRecord,
			routes.actions.monitor.dns.toggleRecord,
			team,
			membership,
			db,
			{ monitor_id: monitor.id, record_id: record.id },
		);

		expect(response.status).toBe(404);
		expect(
			(await db.findOne(dnsMonitorRecords, { where: { id: record.id } }))?.is_enabled,
		).toBeTruthy();
	});
});

describe("POST /actions/:team/import-dns-monitor-zone-file", () => {
	test("adds the names a fresh paste declares and records that an import happened", async () => {
		stubResolver();
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await createMonitorRow(db, team.id);

		let response = await postDnsMonitorAction(
			importDnsMonitorZoneFile,
			routes.actions.monitor.dns.importZoneFile,
			team,
			membership,
			db,
			{ monitor_id: monitor.id, zone_file: "www\t1\tIN\tA\t5.6.7.8" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.dnsMonitors.review.href({ team: team.slug, monitorId: monitor.id }),
		);

		let updated = await db.findOne(dnsMonitors, { where: { id: monitor.id } });
		expect(updated?.zone_file_imported_at).not.toBeNull();

		let names = await db.findMany(dnsMonitorRecords, { where: { dns_monitor_id: monitor.id } });
		expect(names.map((record) => record.name)).toContain("www.example.com");
	});

	/**
	 * A re-import preserves a visitor's earlier decision, so a declined record
	 * stays declined across every subsequent paste.
	 */
	test("leaves an already-declined record declined", async () => {
		stubResolver();
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await createMonitorRow(db, team.id);
		let declined = await createRecordRow(db, monitor.id, { is_enabled: false });

		await postDnsMonitorAction(
			importDnsMonitorZoneFile,
			routes.actions.monitor.dns.importZoneFile,
			team,
			membership,
			db,
			{ monitor_id: monitor.id, zone_file: "@\t1\tIN\tA\t1.2.3.4" },
		);

		expect(
			(await db.findOne(dnsMonitorRecords, { where: { id: declined.id } }))?.is_enabled,
		).toBeFalsy();
	});

	test("404s when the monitor doesn't belong to the team, without resolving anything", async () => {
		stubResolver();
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let otherTeam = await createTeamRow(db);
		let monitor = await createMonitorRow(db, otherTeam.id);

		let response = await postDnsMonitorAction(
			importDnsMonitorZoneFile,
			routes.actions.monitor.dns.importZoneFile,
			team,
			membership,
			db,
			{ monitor_id: monitor.id, zone_file: "www\t1\tIN\tA\t5.6.7.8" },
		);

		expect(response.status).toBe(404);
		expect(queries).toBe(0);
		expect(await db.count(dnsMonitorRecords, { where: { dns_monitor_id: monitor.id } })).toBe(0);
	});

	test("rejects an empty paste without importing anything", async () => {
		stubResolver();
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let membership = await createMembershipRow(db, team.id);
		let monitor = await createMonitorRow(db, team.id);

		let response = await postDnsMonitorAction(
			importDnsMonitorZoneFile,
			routes.actions.monitor.dns.importZoneFile,
			team,
			membership,
			db,
			{ monitor_id: monitor.id, zone_file: "" },
		);

		expect(response.status).toBe(303);
		expect(queries).toBe(0);
		expect(await db.count(dnsMonitorRecords, { where: { dns_monitor_id: monitor.id } })).toBe(0);
	});
});
