/**
 * Tests the `/api/v1/dns-monitors/:dnsMonitorId/records` sub-resource: listing a monitor's
 * tracked records and toggling one record's `isEnabled`. Covers the happy paths, the
 * refusal of any attempt to rewrite a record's identity, missing/wrong-scope keys, and that
 * both a monitor owned by another team and a record belonging to another monitor answer 404
 * rather than 403 or a leaked row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type {
	ApiKeyScope,
	SelectDnsMonitor,
	SelectDnsMonitorRecord,
	SelectTeam,
} from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import DnsMonitor from "~/app/data/dns-monitor";
import { createTestDatabase } from "~/app/lib/test/db";
import { dnsMonitorRecords, teams } from "~/database/schema";
import routes from "~/routes/web";

let { default: dnsMonitorRecordsController, dnsMonitorRecordsRoutes } =
	await import("./dns-monitor-records");

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

async function createDnsMonitorRow(db: Db, teamId: string): Promise<SelectDnsMonitor> {
	return await DnsMonitor.create(db, teamId, {
		name: "example.com",
		domain: "example.com",
		interval_seconds: 86_400,
		is_enabled: true,
	});
}

async function createRecordRow(
	db: Db,
	monitorId: string,
	overrides: Record<string, unknown> = {},
): Promise<SelectDnsMonitorRecord> {
	return await db.create(
		dnsMonitorRecords,
		{
			id: crypto.randomUUID(),
			dns_monitor_id: monitorId,
			name: "example.com",
			record_type: "A",
			value: "192.0.2.1",
			source: "resolver",
			is_enabled: true,
			status: "ok",
			first_seen_at: Date.now(),
			last_seen_at: Date.now(),
			last_checked_at: null,
			...overrides,
		},
		{ touch: true, returnRow: true },
	);
}

async function dispatch(db: Db, request: Request): Promise<Response> {
	let router = createRouter({ middleware: [asyncContext()] });
	router.map(dnsMonitorRecordsRoutes, dnsMonitorRecordsController);

	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	return container.scope(() => router.fetch(request));
}

function listRequest(dnsMonitorId: string, key?: string): Request {
	let headers: Record<string, string> = {};
	if (key) headers.Authorization = `Bearer ${key}`;

	return new Request(
		`https://uptime.test${routes.api.v1.dnsMonitors.records.index.href({ dnsMonitorId })}`,
		{ headers },
	);
}

function updateRequest(
	dnsMonitorId: string,
	recordId: string,
	body: unknown,
	key?: string,
): Request {
	let headers: Record<string, string> = { "content-type": "application/json" };
	if (key) headers.Authorization = `Bearer ${key}`;

	return new Request(
		`https://uptime.test${routes.api.v1.dnsMonitors.records.update.href({ dnsMonitorId, recordId })}`,
		{ method: "PATCH", headers, body: JSON.stringify(body) },
	);
}

async function errorBody(response: Response) {
	return (await response.json()) as { error: { code: string; message: string } };
}

describe("GET /api/v1/dns-monitors/:dnsMonitorId/records", () => {
	test("lists the monitor's tracked records, declined ones included", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:read"]);
		let monitor = await createDnsMonitorRow(db, team.id);
		await createRecordRow(db, monitor.id, { name: "example.com", record_type: "A" });
		await createRecordRow(db, monitor.id, {
			name: "mail.example.com",
			record_type: "MX",
			value: "10 mx.example.com",
			source: "zone_file",
			is_enabled: false,
			status: "new",
			last_seen_at: null,
		});

		let response = await dispatch(db, listRequest(monitor.id, key));

		expect(response.status).toBe(200);
		let body = (await response.json()) as {
			data: {
				records: {
					id: string;
					name: string;
					recordType: string;
					value: string;
					source: string;
					isEnabled: boolean;
					status: string;
					lastSeenAt: number | null;
				}[];
			};
		};

		expect(body.data.records).toHaveLength(2);
		expect(body.data.records[0]).toMatchObject({
			name: "example.com",
			recordType: "A",
			value: "192.0.2.1",
			source: "resolver",
			isEnabled: true,
			status: "ok",
		});
		expect(body.data.records[1]).toMatchObject({
			name: "mail.example.com",
			recordType: "MX",
			source: "zone_file",
			isEnabled: false,
			status: "new",
			lastSeenAt: null,
		});
	});

	test("returns an empty list for a monitor with no records", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:read"]);
		let monitor = await createDnsMonitorRow(db, team.id);

		let response = await dispatch(db, listRequest(monitor.id, key));

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { records: unknown[] } };
		expect(body.data.records).toEqual([]);
	});

	test("never lists another monitor's records", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:read"]);
		let monitor = await createDnsMonitorRow(db, team.id);
		let otherMonitor = await createDnsMonitorRow(db, team.id);
		await createRecordRow(db, otherMonitor.id, { value: "198.51.100.7" });

		let response = await dispatch(db, listRequest(monitor.id, key));

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { records: unknown[] } };
		expect(body.data.records).toEqual([]);
	});

	test("404s when the monitor belongs to another team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:read"]);
		let monitor = await createDnsMonitorRow(db, otherTeam.id);
		await createRecordRow(db, monitor.id);

		let response = await dispatch(db, listRequest(monitor.id, key));

		expect(response.status).toBe(404);
		expect((await errorBody(response)).error.code).toBe("NOT_FOUND");
	});

	test("returns 401 with a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, listRequest(crypto.randomUUID()));
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key lacking dns-monitors:read", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);
		let monitor = await createDnsMonitorRow(db, team.id);

		let response = await dispatch(db, listRequest(monitor.id, key));
		expect(response.status).toBe(403);
	});
});

describe("PATCH /api/v1/dns-monitors/:dnsMonitorId/records/:recordId", () => {
	test("declines a record without touching its status", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let monitor = await createDnsMonitorRow(db, team.id);
		let record = await createRecordRow(db, monitor.id, { status: "missing" });

		let response = await dispatch(
			db,
			updateRequest(monitor.id, record.id, { isEnabled: false }, key),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as {
			data: { record: { isEnabled: boolean; status: string } };
		};
		expect(body.data.record.isEnabled).toBe(false);
		expect(body.data.record.status).toBe("missing");

		let stored = await db.findOne(dnsMonitorRecords, { where: { id: record.id } });
		expect(stored?.is_enabled).toBeFalsy();
	});

	test("enabling a newly discovered record settles it to ok", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let monitor = await createDnsMonitorRow(db, team.id);
		let record = await createRecordRow(db, monitor.id, { is_enabled: false, status: "new" });

		let response = await dispatch(
			db,
			updateRequest(monitor.id, record.id, { isEnabled: true }, key),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as {
			data: { record: { isEnabled: boolean; status: string } };
		};
		expect(body.data.record.isEnabled).toBe(true);
		expect(body.data.record.status).toBe("ok");
	});

	test.each(["name", "recordType", "value"])(
		"400s rather than silently ignoring an attempt to rewrite %s",
		async (field) => {
			let { db } = createTestDatabase();
			let team = await createTeamRow(db);
			let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
			let monitor = await createDnsMonitorRow(db, team.id);
			let record = await createRecordRow(db, monitor.id);

			let response = await dispatch(
				db,
				updateRequest(monitor.id, record.id, { isEnabled: true, [field]: "hijacked" }, key),
			);

			expect(response.status).toBe(400);
			let body = await errorBody(response);
			expect(body.error.code).toBe("VALIDATION_ERROR");
			expect(body.error.message).toBe(`${field}: Unknown key`);

			let stored = await db.findOne(dnsMonitorRecords, { where: { id: record.id } });
			expect(stored?.name).toBe("example.com");
			expect(stored?.record_type).toBe("A");
			expect(stored?.value).toBe("192.0.2.1");
			expect(stored?.is_enabled).toBeTruthy();
		},
	);

	test("400s when isEnabled is missing", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let monitor = await createDnsMonitorRow(db, team.id);
		let record = await createRecordRow(db, monitor.id);

		let response = await dispatch(db, updateRequest(monitor.id, record.id, {}, key));

		expect(response.status).toBe(400);
		let body = await errorBody(response);
		expect(body.error.code).toBe("VALIDATION_ERROR");
		expect(body.error.message).toContain("isEnabled");
	});

	test("400s when isEnabled is not a boolean", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let monitor = await createDnsMonitorRow(db, team.id);
		let record = await createRecordRow(db, monitor.id);

		let response = await dispatch(
			db,
			updateRequest(monitor.id, record.id, { isEnabled: "false" }, key),
		);

		expect(response.status).toBe(400);
		let body = await errorBody(response);
		expect(body.error.code).toBe("VALIDATION_ERROR");
		expect(body.error.message).toContain("isEnabled");

		let stored = await db.findOne(dnsMonitorRecords, { where: { id: record.id } });
		expect(stored?.is_enabled).toBeTruthy();
	});

	test("404s when the monitor belongs to another team, without changing the record", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let monitor = await createDnsMonitorRow(db, otherTeam.id);
		let record = await createRecordRow(db, monitor.id);

		let response = await dispatch(
			db,
			updateRequest(monitor.id, record.id, { isEnabled: false }, key),
		);

		expect(response.status).toBe(404);
		expect((await errorBody(response)).error.code).toBe("NOT_FOUND");

		let stored = await db.findOne(dnsMonitorRecords, { where: { id: record.id } });
		expect(stored?.is_enabled).toBeTruthy();
	});

	test("404s when the record belongs to another monitor of the same team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let monitor = await createDnsMonitorRow(db, team.id);
		let otherMonitor = await createDnsMonitorRow(db, team.id);
		let record = await createRecordRow(db, otherMonitor.id);

		let response = await dispatch(
			db,
			updateRequest(monitor.id, record.id, { isEnabled: false }, key),
		);

		expect(response.status).toBe(404);
		let stored = await db.findOne(dnsMonitorRecords, { where: { id: record.id } });
		expect(stored?.is_enabled).toBeTruthy();
	});

	test("404s for a record id that names nothing", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let monitor = await createDnsMonitorRow(db, team.id);

		let response = await dispatch(
			db,
			updateRequest(monitor.id, crypto.randomUUID(), { isEnabled: false }, key),
		);

		expect(response.status).toBe(404);
	});

	test("returns 401 with a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(
			db,
			updateRequest(crypto.randomUUID(), crypto.randomUUID(), { isEnabled: false }),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a read-only key", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:read"]);
		let monitor = await createDnsMonitorRow(db, team.id);
		let record = await createRecordRow(db, monitor.id);

		let response = await dispatch(
			db,
			updateRequest(monitor.id, record.id, { isEnabled: false }, key),
		);

		expect(response.status).toBe(403);

		let stored = await db.findOne(dnsMonitorRecords, { where: { id: record.id } });
		expect(stored?.is_enabled).toBeTruthy();
	});
});
