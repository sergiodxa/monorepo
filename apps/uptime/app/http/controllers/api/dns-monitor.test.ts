/**
 * Tests the `/api/v1/dns-monitors/:dnsMonitorId` item endpoints: get/update/delete a
 * single DNS monitor and its check-result history, all gated by a real
 * `requireApiKey` bearer-token check baked into the controller. Covers the happy
 * paths, validation failure, missing/garbage auth, missing scope, and that a monitor
 * belonging to another team always 404s rather than 403ing or leaking the row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { ApiKeyScope, SelectDnsMonitor, SelectTeam } from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import DnsMonitor from "~/app/data/dns-monitor";
import { createTestDatabase } from "~/app/lib/test/db";
import { teams } from "~/database/schema";
import routes from "~/routes/web";

let { default: dnsMonitorController, dnsMonitorRoutes } = await import("./dns-monitor");

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

async function createDnsMonitorRow(
	db: Db,
	teamId: string,
	overrides: Record<string, unknown> = {},
): Promise<SelectDnsMonitor> {
	return await DnsMonitor.create(db, teamId, {
		name: "Apex A record",
		domain: "example.com",
		interval_seconds: 3600,
		is_enabled: true,
		...overrides,
	});
}

async function dispatch(db: Db, request: Request) {
	let router = createRouter({ middleware: [asyncContext()] });
	router.map(dnsMonitorRoutes, dnsMonitorController);

	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	return container.scope(() => router.fetch(request));
}

function showRequest(dnsMonitorId: string, headers: Record<string, string> = {}) {
	return new Request(
		`https://uptime.test${routes.api.v1.dnsMonitors.show.href({ dnsMonitorId })}`,
		{ headers },
	);
}

function updateRequest(dnsMonitorId: string, body: unknown, headers: Record<string, string> = {}) {
	return new Request(
		`https://uptime.test${routes.api.v1.dnsMonitors.update.href({ dnsMonitorId })}`,
		{
			method: "PUT",
			headers: { "content-type": "application/json", ...headers },
			body: JSON.stringify(body),
		},
	);
}

function destroyRequest(dnsMonitorId: string, headers: Record<string, string> = {}) {
	return new Request(
		`https://uptime.test${routes.api.v1.dnsMonitors.destroy.href({ dnsMonitorId })}`,
		{ method: "DELETE", headers },
	);
}

function resultsRequest(dnsMonitorId: string, headers: Record<string, string> = {}) {
	return new Request(
		`https://uptime.test${routes.api.v1.dnsMonitors.results.href({ dnsMonitorId })}`,
		{ headers },
	);
}

describe("GET /api/v1/dns-monitors/:dnsMonitorId", () => {
	test("returns the DNS monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:read"]);
		let monitor = await createDnsMonitorRow(db, team.id);

		let response = await dispatch(db, showRequest(monitor.id, { Authorization: `Bearer ${key}` }));

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { dnsMonitor: { id: string; domain: string } } };
		expect(body.data.dnsMonitor.id).toBe(monitor.id);
		expect(body.data.dnsMonitor.domain).toBe("example.com");
	});

	test("returns 401 when the Authorization header is missing", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let monitor = await createDnsMonitorRow(db, team.id);

		let response = await dispatch(db, showRequest(monitor.id));
		expect(response.status).toBe(401);
	});

	test("returns 401 when the Authorization header is garbage", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let monitor = await createDnsMonitorRow(db, team.id);

		let response = await dispatch(
			db,
			showRequest(monitor.id, { Authorization: "Bearer not-a-real-key" }),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 when the key lacks the dns-monitors:read scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let monitor = await createDnsMonitorRow(db, team.id);

		let response = await dispatch(db, showRequest(monitor.id, { Authorization: `Bearer ${key}` }));
		expect(response.status).toBe(403);
	});

	test("404s when the monitor doesn't belong to the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:read"]);
		let monitor = await createDnsMonitorRow(db, otherTeam.id, { name: "Someone else's" });

		let response = await dispatch(db, showRequest(monitor.id, { Authorization: `Bearer ${key}` }));
		expect(response.status).toBe(404);
	});
});

describe("PUT /api/v1/dns-monitors/:dnsMonitorId", () => {
	test("updates the DNS monitor's editable fields", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let monitor = await createDnsMonitorRow(db, team.id);

		let response = await dispatch(
			db,
			updateRequest(
				monitor.id,
				{ name: "New name", expectedValue: "9.9.9.9" },
				{ Authorization: `Bearer ${key}` },
			),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as {
			data: { dnsMonitor: { name: string } };
		};
		expect(body.data.dnsMonitor.name).toBe("New name");

		let updated = await DnsMonitor.findByIdForTeam(db, team.id, monitor.id);
		expect(updated?.name).toBe("New name");
	});

	test("returns 400 for a validation failure (out-of-range interval)", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let monitor = await createDnsMonitorRow(db, team.id);

		let response = await dispatch(
			db,
			updateRequest(monitor.id, { intervalSeconds: 5 }, { Authorization: `Bearer ${key}` }),
		);

		expect(response.status).toBe(400);
		let body = (await response.json()) as { error: { code: string } };
		expect(body.error.code).toBe("VALIDATION_ERROR");

		let unchanged = await DnsMonitor.findByIdForTeam(db, team.id, monitor.id);
		expect(unchanged?.interval_seconds).toBe(3600);
	});

	/**
	 * The floor moved to 900 for both channels at once. 60 was legal through this endpoint
	 * until now — a six-type sweep at that interval is a quarter of a million queries a month
	 * from one monitor — so a body that used to be accepted must now be refused.
	 */
	test("rejects the 60-second interval the old API allowed, and accepts the 900-second floor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let monitor = await createDnsMonitorRow(db, team.id);

		let refused = await dispatch(
			db,
			updateRequest(monitor.id, { intervalSeconds: 60 }, { Authorization: `Bearer ${key}` }),
		);
		expect(refused.status).toBe(400);

		let accepted = await dispatch(
			db,
			updateRequest(monitor.id, { intervalSeconds: 900 }, { Authorization: `Bearer ${key}` }),
		);
		expect(accepted.status).toBe(200);
		expect((await DnsMonitor.findByIdForTeam(db, team.id, monitor.id))?.interval_seconds).toBe(900);
	});

	test("returns 401 when the Authorization header is missing", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let monitor = await createDnsMonitorRow(db, team.id);

		let response = await dispatch(db, updateRequest(monitor.id, { name: "New name" }));
		expect(response.status).toBe(401);
	});

	test("returns 403 when the key lacks the dns-monitors:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:read"]);
		let monitor = await createDnsMonitorRow(db, team.id);

		let response = await dispatch(
			db,
			updateRequest(monitor.id, { name: "New name" }, { Authorization: `Bearer ${key}` }),
		);
		expect(response.status).toBe(403);
	});

	test("404s when the monitor doesn't belong to the team, without mutating it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let monitor = await createDnsMonitorRow(db, otherTeam.id, { name: "Someone else's" });

		let response = await dispatch(
			db,
			updateRequest(monitor.id, { name: "Hijacked" }, { Authorization: `Bearer ${key}` }),
		);

		expect(response.status).toBe(404);
		let unchanged = await DnsMonitor.findByIdForTeam(db, otherTeam.id, monitor.id);
		expect(unchanged?.name).toBe("Someone else's");
	});
});

describe("DELETE /api/v1/dns-monitors/:dnsMonitorId", () => {
	test("deletes the DNS monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let monitor = await createDnsMonitorRow(db, team.id);

		let response = await dispatch(
			db,
			destroyRequest(monitor.id, { Authorization: `Bearer ${key}` }),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { deleted: boolean } };
		expect(body.data.deleted).toBe(true);

		expect(await DnsMonitor.findByIdForTeam(db, team.id, monitor.id)).toBeNull();
	});

	test("returns 401 when the Authorization header is missing", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let monitor = await createDnsMonitorRow(db, team.id);

		let response = await dispatch(db, destroyRequest(monitor.id));
		expect(response.status).toBe(401);
	});

	test("returns 403 when the key lacks the dns-monitors:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:read"]);
		let monitor = await createDnsMonitorRow(db, team.id);

		let response = await dispatch(
			db,
			destroyRequest(monitor.id, { Authorization: `Bearer ${key}` }),
		);
		expect(response.status).toBe(403);
	});

	test("404s when the monitor doesn't belong to the team, without deleting it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let monitor = await createDnsMonitorRow(db, otherTeam.id);

		let response = await dispatch(
			db,
			destroyRequest(monitor.id, { Authorization: `Bearer ${key}` }),
		);

		expect(response.status).toBe(404);
		expect(await DnsMonitor.findByIdForTeam(db, otherTeam.id, monitor.id)).not.toBeNull();
	});
});

describe("GET /api/v1/dns-monitors/:dnsMonitorId/results", () => {
	test("returns the monitor's check-result history", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:read"]);
		let monitor = await createDnsMonitorRow(db, team.id);

		await DnsMonitor.recordCheckResult(db, monitor.id, {
			status: "ok",
			responseTimeMs: 42,
		});

		let response = await dispatch(
			db,
			resultsRequest(monitor.id, { Authorization: `Bearer ${key}` }),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as {
			data: { results: { status: string; responseTimeMs: number; queriesFailed: number }[] };
		};
		expect(body.data.results).toHaveLength(1);
		expect(body.data.results[0]?.status).toBe("ok");
		expect(body.data.results[0]?.responseTimeMs).toBe(42);
		expect(body.data.results[0]?.queriesFailed).toBe(0);
	});

	test("returns 401 when the Authorization header is missing", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let monitor = await createDnsMonitorRow(db, team.id);

		let response = await dispatch(db, resultsRequest(monitor.id));
		expect(response.status).toBe(401);
	});

	test("returns 403 when the key lacks the dns-monitors:read scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let monitor = await createDnsMonitorRow(db, team.id);

		let response = await dispatch(
			db,
			resultsRequest(monitor.id, { Authorization: `Bearer ${key}` }),
		);
		expect(response.status).toBe(403);
	});

	test("404s when the monitor doesn't belong to the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:read"]);
		let monitor = await createDnsMonitorRow(db, otherTeam.id);

		let response = await dispatch(
			db,
			resultsRequest(monitor.id, { Authorization: `Bearer ${key}` }),
		);
		expect(response.status).toBe(404);
	});
});
