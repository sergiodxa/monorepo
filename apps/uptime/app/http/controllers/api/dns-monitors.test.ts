/**
 * Tests `/api/v1/dns-monitors`: listing a team's monitors and creating one, gated by a real
 * `requireApiKey` bearer-token check. Covers happy paths, validation failures, missing/garbage
 * auth, missing scope, and that a list never leaks another team's monitors. Creation runs
 * discovery for real against an MSW-stubbed DoH endpoint.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ServiceContainer } from "@pkg/service-container";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import type { ApiKeyScope, SelectTeam } from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import DnsMonitor, { MAX_DNS_MONITORS_PER_TEAM } from "~/app/data/dns-monitor";
import DnsMonitorRecord from "~/app/data/dns-monitor-record";
import { createTestDatabase } from "~/app/lib/test/db";
import { MAX_TRACKED_NAMES_PER_MONITOR } from "~/app/services/dns-discovery";
import { dnsMonitorRecords, teams } from "~/database/schema";
import routes from "~/routes/web";

const DOH_URL = "https://cloudflare-dns.com/dns-query";

let server = setupServer();

/** How many DoH queries the request under test sent — zero is the assertion that matters. */
let queries = 0;

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => {
	queries = 0;
});

/** The DoH JSON envelope, in the shape a handler needs to answer one query. */
interface DohBody {
	Status?: number;
	Answer?: { name: string; type: number; TTL: number; data: string }[];
}

/** Answers a sweep with one `A` record at every name and nothing of any other type. */
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

let { default: dnsMonitorsController, dnsMonitorsRoutes } = await import("./dns-monitors");

type Db = ReturnType<typeof createTestDatabase>["db"];

async function createTeamRow(db: Db): Promise<SelectTeam> {
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

async function createApiKey(db: Db, teamId: string, scopes: ApiKeyScope[]): Promise<string> {
	let { key } = await ApiKey.create(db, teamId, { name: "test", scopes, expires_at: null });
	return key;
}

async function dispatch(db: Db, request: Request) {
	let router = createRouter({ middleware: [asyncContext()] });
	router.map(dnsMonitorsRoutes, dnsMonitorsController);

	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	return container.scope(() => router.fetch(request));
}

function indexRequest(headers: Record<string, string> = {}) {
	return new Request(`https://uptime.test${routes.api.v1.dnsMonitors.index.href()}`, { headers });
}

function createRequest(body: unknown, headers: Record<string, string> = {}) {
	return new Request(`https://uptime.test${routes.api.v1.dnsMonitors.create.href()}`, {
		method: "POST",
		headers: { "content-type": "application/json", ...headers },
		body: JSON.stringify(body),
	});
}

function validDnsMonitorBody(overrides: Record<string, unknown> = {}) {
	return { name: "Apex A record", domain: "example.com", ...overrides };
}

describe("GET /api/v1/dns-monitors", () => {
	test("lists the team's DNS monitors", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:read"]);

		await DnsMonitor.create(db, team.id, {
			name: "Apex A record",
			domain: "example.com",
			interval_seconds: 3600,
			is_enabled: true,
		});

		let response = await dispatch(db, indexRequest({ Authorization: `Bearer ${key}` }));

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { dnsMonitors: { name: string }[] } };
		expect(body.data.dnsMonitors).toHaveLength(1);
		expect(body.data.dnsMonitors[0]?.name).toBe("Apex A record");
	});

	test("only returns the calling team's DNS monitors, not another team's", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:read"]);

		await DnsMonitor.create(db, team.id, {
			name: "Mine",
			domain: "mine.example.com",
			interval_seconds: 3600,
			is_enabled: true,
		});
		await DnsMonitor.create(db, otherTeam.id, {
			name: "Theirs",
			domain: "theirs.example.com",
			interval_seconds: 3600,
			is_enabled: true,
		});

		let response = await dispatch(db, indexRequest({ Authorization: `Bearer ${key}` }));
		let body = (await response.json()) as { data: { dnsMonitors: { name: string }[] } };
		expect(body.data.dnsMonitors).toHaveLength(1);
		expect(body.data.dnsMonitors[0]?.name).toBe("Mine");
	});

	test("returns 401 when the Authorization header is missing", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, indexRequest());
		expect(response.status).toBe(401);
	});

	test("returns 401 when the Authorization header is garbage", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, indexRequest({ Authorization: "Bearer not-a-real-key" }));
		expect(response.status).toBe(401);
	});

	test("returns 403 when the key lacks the dns-monitors:read scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);

		let response = await dispatch(db, indexRequest({ Authorization: `Bearer ${key}` }));
		expect(response.status).toBe(403);
	});
});

describe("POST /api/v1/dns-monitors", () => {
	test("creates a DNS monitor and returns 201 with the created row", async () => {
		stubResolver();
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);

		let response = await dispatch(
			db,
			createRequest(validDnsMonitorBody(), { Authorization: `Bearer ${key}` }),
		);

		expect(response.status).toBe(201);
		let body = (await response.json()) as {
			data: {
				dnsMonitor: {
					id: string;
					name: string;
					domain: string;
					zoneFileImportedAt: number | null;
				};
			};
		};
		expect(body.data.dnsMonitor.name).toBe("Apex A record");
		expect(body.data.dnsMonitor.domain).toBe("example.com");
		expect(body.data.dnsMonitor.zoneFileImportedAt).toBeNull();

		expect(await DnsMonitor.countByTeam(db, team.id)).toBe(1);
	});

	/**
	 * ADR-026 §13: an API create has no reviewer, so everything discovered is imported already
	 * watched — the six queries below cover every supported record type for the one name. The
	 * review-gated default lives only in the review screen.
	 */
	test("imports every discovered record already watched, since no review step exists", async () => {
		stubResolver();
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);

		let response = await dispatch(
			db,
			createRequest(validDnsMonitorBody(), { Authorization: `Bearer ${key}` }),
		);

		let body = (await response.json()) as {
			data: {
				dnsMonitor: { id: string };
				discovery: { names: number; recordsImported: number; queriesFailed: number };
			};
		};

		expect(body.data.discovery).toMatchObject({ names: 1, recordsImported: 1, queriesFailed: 0 });
		expect(queries).toBe(6);

		let records = await db.findMany(dnsMonitorRecords, {
			where: { dns_monitor_id: body.data.dnsMonitor.id },
		});
		expect(records).toHaveLength(1);
		expect(records[0]?.value).toBe("1.2.3.4");
		expect(records[0]?.is_enabled).toBeTruthy();
		expect(records[0]?.status).toBe("ok");
	});

	test("imports the names a pasted zone file declares and reports the lines it could not use", async () => {
		stubResolver();
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);

		let response = await dispatch(
			db,
			createRequest(
				validDnsMonitorBody({
					zoneFile: ["$ORIGIN example.com.", "www\t1\tIN\tA\t5.6.7.8"].join("\n"),
				}),
				{ Authorization: `Bearer ${key}` },
			),
		);

		expect(response.status).toBe(201);
		let body = (await response.json()) as {
			data: {
				dnsMonitor: { id: string; zoneFileImportedAt: number | null };
				discovery: { names: number; rejectedLines: { line: number; reason: string }[] };
			};
		};

		expect(body.data.dnsMonitor.zoneFileImportedAt).not.toBeNull();
		expect(body.data.discovery.names).toBe(2);
		/**
		 * `$ORIGIN` is the dangerous one to ignore: every relative name after it would resolve
		 * into the wrong zone, so a script is told about the rejected line explicitly.
		 */
		expect(body.data.discovery.rejectedLines).toEqual([{ line: 1, reason: "originDirective" }]);

		expect(await DnsMonitorRecord.countByMonitor(db, body.data.dnsMonitor.id)).toBeGreaterThan(1);
	});

	/**
	 * The paste is a map of somebody's infrastructure: it is parsed and dropped, so the monitor
	 * row and the response carry only the records being watched, never a byte of the original text.
	 */
	test("stores and returns no trace of the pasted zone file itself", async () => {
		stubResolver();
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);

		let response = await dispatch(
			db,
			createRequest(validDnsMonitorBody({ zoneFile: "www\t1\tIN\tA\t5.6.7.8 ; secret-comment" }), {
				Authorization: `Bearer ${key}`,
			}),
		);

		let text = await response.text();
		expect(text).not.toContain("secret-comment");

		let monitor = (await DnsMonitor.listByTeam(db, team.id))[0]!;
		let records = await db.findMany(dnsMonitorRecords, { where: { dns_monitor_id: monitor.id } });
		expect(JSON.stringify({ monitor, records })).not.toContain("secret-comment");
	});

	/**
	 * The name-count check runs before the monitor row is created and before any DNS query is
	 * sent, so a caller learns about an unsupported zone file with no partial monitor left behind.
	 */
	test("returns 400 for a zone file declaring more names than one monitor can sweep", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);

		let lines = Array.from(
			{ length: MAX_TRACKED_NAMES_PER_MONITOR + 1 },
			(_unused, index) => `name${index}\t1\tIN\tA\t1.2.3.4`,
		);

		let response = await dispatch(
			db,
			createRequest(validDnsMonitorBody({ zoneFile: lines.join("\n") }), {
				Authorization: `Bearer ${key}`,
			}),
		);

		expect(response.status).toBe(400);
		expect(queries).toBe(0);
		expect(await DnsMonitor.countByTeam(db, team.id)).toBe(0);
	});

	/**
	 * The floor moved to 900 for both channels at once: 60 was legal here until now, and a
	 * six-type sweep at a minute is a quarter of a million queries a month from one monitor.
	 */
	test("rejects the 60-second interval the old API allowed, and accepts the 900-second floor", async () => {
		stubResolver();
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);

		let refused = await dispatch(
			db,
			createRequest(validDnsMonitorBody({ intervalSeconds: 60 }), {
				Authorization: `Bearer ${key}`,
			}),
		);
		expect(refused.status).toBe(400);

		let accepted = await dispatch(
			db,
			createRequest(validDnsMonitorBody({ intervalSeconds: 900 }), {
				Authorization: `Bearer ${key}`,
			}),
		);
		expect(accepted.status).toBe(201);
	});

	test("defaults an omitted interval to once a day", async () => {
		stubResolver();
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);

		let response = await dispatch(
			db,
			createRequest(validDnsMonitorBody(), { Authorization: `Bearer ${key}` }),
		);

		let body = (await response.json()) as { data: { dnsMonitor: { intervalSeconds: number } } };
		expect(body.data.dnsMonitor.intervalSeconds).toBe(86_400);
	});

	test("returns 400 for a validation failure (blank domain)", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);

		let response = await dispatch(
			db,
			createRequest(validDnsMonitorBody({ domain: "" }), { Authorization: `Bearer ${key}` }),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as { error: { code: string } };
		expect(body.error.code).toBe("VALIDATION_ERROR");
		expect(await DnsMonitor.countByTeam(db, team.id)).toBe(0);
	});

	test("returns 400 for an out-of-range interval", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);

		let response = await dispatch(
			db,
			createRequest(validDnsMonitorBody({ intervalSeconds: 5 }), {
				Authorization: `Bearer ${key}`,
			}),
		);

		expect(response.status).toBe(400);
	});

	/**
	 * The cap the web flow has always applied, now applied here too: a `dns-monitors:write`
	 * key used to create without bound, and one domain monitor sweeps hundreds of queries per
	 * check, so the ceiling is what keeps a team's checks inside the platform's budget.
	 */
	test("creates the monitor that fills the per-team cap", async () => {
		stubResolver();
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);

		for (let index = 0; index < MAX_DNS_MONITORS_PER_TEAM - 1; index++) {
			await DnsMonitor.create(db, team.id, {
				name: `Monitor ${index}`,
				domain: `example-${index}.com`,
				interval_seconds: 86_400,
				is_enabled: true,
			});
		}

		let response = await dispatch(
			db,
			createRequest(validDnsMonitorBody(), { Authorization: `Bearer ${key}` }),
		);

		expect(response.status).toBe(201);
		expect(await DnsMonitor.countByTeam(db, team.id)).toBe(MAX_DNS_MONITORS_PER_TEAM);
	});

	/**
	 * The cap check runs before the monitor row is written and before any DNS query is sent, so
	 * hitting the limit costs nothing beyond the check itself.
	 */
	test("returns 400 once the team is at the per-team DNS monitor cap", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);

		for (let index = 0; index < MAX_DNS_MONITORS_PER_TEAM; index++) {
			await DnsMonitor.create(db, team.id, {
				name: `Monitor ${index}`,
				domain: `example-${index}.com`,
				interval_seconds: 86_400,
				is_enabled: true,
			});
		}

		let response = await dispatch(
			db,
			createRequest(validDnsMonitorBody(), { Authorization: `Bearer ${key}` }),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as { error: { code: string; message: string } };
		expect(body.error.code).toBe("LIMIT_EXCEEDED");
		expect(body.error.message).toBe(
			`Maximum of ${MAX_DNS_MONITORS_PER_TEAM} DNS monitors per team`,
		);

		expect(queries).toBe(0);
		expect(await DnsMonitor.countByTeam(db, team.id)).toBe(MAX_DNS_MONITORS_PER_TEAM);
	});

	test("returns 401 when the Authorization header is missing", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, createRequest(validDnsMonitorBody()));
		expect(response.status).toBe(401);
	});

	test("returns 403 when the key lacks the dns-monitors:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:read"]);

		let response = await dispatch(
			db,
			createRequest(validDnsMonitorBody(), { Authorization: `Bearer ${key}` }),
		);
		expect(response.status).toBe(403);
	});
});
