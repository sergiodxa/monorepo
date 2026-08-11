/**
 * Tests the `/api/v1/dns-monitors` collection endpoints: listing a team's DNS
 * monitors and creating one, both gated by a real `requireApiKey` bearer-token check
 * baked into the controller. Covers the happy paths, validation failure,
 * missing/garbage auth, missing scope, and that a list never leaks another team's
 * monitors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";

import type { ApiKeyScope, SelectTeam } from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import DnsMonitor from "~/app/data/dns-monitor";
import { createTestDatabase } from "~/app/lib/test/db";
import { teams } from "~/database/schema";
import routes from "~/routes/web";

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
		// Nothing has been pasted, so the monitor covers the apex and says so.
		expect(body.data.dnsMonitor.zoneFileImportedAt).toBeNull();

		expect(await DnsMonitor.countByTeam(db, team.id)).toBe(1);
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
