/**
 * Tests the `/api/v1/dns-monitors/:dnsMonitorId` item endpoints: get/update/delete a
 * single DNS monitor and its check-result history, all gated by a real
 * `requireApiKey` bearer-token check baked into the controller. Covers the happy
 * paths, validation failure, missing/garbage auth, missing scope, and that a monitor
 * belonging to another team draws a uniform 404, keeping the row and its existence hidden.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { ApiKeyScope, SelectDnsMonitor, SelectTeam } from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import DnsMonitor from "~/app/data/dns-monitor";
import { database } from "~/app/http/middleware/database";
import models from "~/app/http/middleware/models";
import { createTestDatabase } from "~/app/lib/test/db";
import { checkConformance } from "~/app/lib/test/openapi";
import { parseLink } from "~/app/lib/test/paging";
import { expectProblem } from "~/app/lib/test/problem";
import { encodeId } from "~/app/services/typed-id";
import { dnsMonitors, teams } from "~/database/schema";
import { dnsMonitorRoutes } from "~/routes/api-groups";
import routes from "~/routes/web";

/** Checks every exchange against the API document; see `checkConformance`. */
const CONFORMANCE = checkConformance(dnsMonitorRoutes);

let { default: dnsMonitorController } = await import("./dns-monitor");

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
	let router = createRouter({
		middleware: [CONFORMANCE, asyncContext(), database(() => db), models()],
	});
	router.map(dnsMonitorRoutes, dnsMonitorController);

	return router.fetch(request);
}

function showRequest(dnsMonitorId: string, headers: Record<string, string> = {}) {
	return new Request(
		`https://uptime.test${routes.api.v1.dnsMonitors.show.href({ dnsMonitorId: encodeId("dns", dnsMonitorId) })}`,
		{ headers },
	);
}

function updateRequest(dnsMonitorId: string, body: unknown, headers: Record<string, string> = {}) {
	return new Request(
		`https://uptime.test${routes.api.v1.dnsMonitors.update.href({ dnsMonitorId: encodeId("dns", dnsMonitorId) })}`,
		{
			method: "PUT",
			headers: { "content-type": "application/json", ...headers },
			body: JSON.stringify(body),
		},
	);
}

function destroyRequest(dnsMonitorId: string, headers: Record<string, string> = {}) {
	return new Request(
		`https://uptime.test${routes.api.v1.dnsMonitors.destroy.href({ dnsMonitorId: encodeId("dns", dnsMonitorId) })}`,
		{ method: "DELETE", headers },
	);
}

function resultsRequest(dnsMonitorId: string, headers: Record<string, string> = {}, query = "") {
	return new Request(
		`https://uptime.test${routes.api.v1.dnsMonitors.results.href({ dnsMonitorId: encodeId("dns", dnsMonitorId) })}${query}`,
		{ headers },
	);
}

/** Follows a `Link` relation, which comes back as the path and query to request next. */
function linkRequest(path: string, headers: Record<string, string> = {}) {
	return new Request(`https://uptime.test${path}`, { headers });
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
		expect(body.data.dnsMonitor.id).toBe(encodeId("dns", monitor.id));
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

describe("registration in the DNS monitor representation", () => {
	test("returns the registration the last lookup stored", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:read"]);
		let monitor = await createDnsMonitorRow(db, team.id, {
			registration_status: "expiring",
			registration_expires_at: Date.UTC(2026, 10, 1),
			registrar: "Example Registrar, LLC",
			registration_epp_statuses: ["clientTransferProhibited"],
			registration_checked_at: Date.UTC(2026, 9, 8),
		});

		let response = await dispatch(db, showRequest(monitor.id, { Authorization: `Bearer ${key}` }));

		let body = (await response.json()) as { data: { dnsMonitor: Record<string, unknown> } };
		expect(body.data.dnsMonitor).toMatchObject({
			registrationStatus: "expiring",
			registrationExpiresAt: Date.UTC(2026, 10, 1),
			registrar: "Example Registrar, LLC",
			registrationEppStatuses: ["clientTransferProhibited"],
			registrationWarningDays: 30,
			registrationCheckedAt: Date.UTC(2026, 9, 8),
			registrationError: null,
		});
	});

	test("a monitor never looked up reads unknown with no statuses", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:read"]);
		let monitor = await createDnsMonitorRow(db, team.id);

		let response = await dispatch(db, showRequest(monitor.id, { Authorization: `Bearer ${key}` }));

		let body = (await response.json()) as { data: { dnsMonitor: Record<string, unknown> } };
		expect(body.data.dnsMonitor).toMatchObject({
			registrationStatus: "unknown",
			registrationExpiresAt: null,
			registrationEppStatuses: [],
		});
	});

	test("PUT saves a new warning window and makes the registration due on the next sweep", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let monitor = await createDnsMonitorRow(db, team.id, {
			registration_next_check_at: Date.now() + 1000,
		});

		let response = await dispatch(
			db,
			updateRequest(
				monitor.id,
				{ registrationWarningDays: 60 },
				{ Authorization: `Bearer ${key}` },
			),
		);

		expect(response.status).toBe(200);
		let updated = await DnsMonitor.findByIdForTeam(db, team.id, monitor.id);
		expect(updated?.registration_warning_days).toBe(60);
		expect(updated?.registration_next_check_at).toBeNull();
	});

	test("PUT re-sending the current window leaves the lookup schedule alone", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let nextCheck = Date.now() + 1000;
		let monitor = await createDnsMonitorRow(db, team.id, { registration_next_check_at: nextCheck });

		await dispatch(
			db,
			updateRequest(
				monitor.id,
				{ registrationWarningDays: 30 },
				{ Authorization: `Bearer ${key}` },
			),
		);

		let updated = await DnsMonitor.findByIdForTeam(db, team.id, monitor.id);
		expect(updated?.registration_next_check_at).toBe(nextCheck);
	});

	test("PUT rejects a warning window outside 1 to 365 days", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let monitor = await createDnsMonitorRow(db, team.id);

		let response = await dispatch(
			db,
			updateRequest(monitor.id, { registrationWarningDays: 0 }, { Authorization: `Bearer ${key}` }),
		);

		expect(response.status).toBe(400);
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
		await expectProblem(response, "validationError");

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

	test("serves one page and a cursor that walks to the next", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:read"]);
		let monitor = await createDnsMonitorRow(db, team.id);

		await DnsMonitor.recordCheckResult(db, monitor.id, { status: "ok", responseTimeMs: 42 });
		await DnsMonitor.recordCheckResult(db, monitor.id, { status: "error", responseTimeMs: 99 });

		let response = await dispatch(
			db,
			resultsRequest(monitor.id, { Authorization: `Bearer ${key}` }, "?perPage=1"),
		);

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { results: { id: string }[] } };
		expect(body.data.results).toHaveLength(1);

		// Navigation rides in the headers now, so following the feed means following `Link`.
		let next = parseLink(response.headers.get("Link"));
		expect(next).not.toBeNull();

		let second = await dispatch(
			db,
			linkRequest(next as string, { Authorization: `Bearer ${key}` }),
		);
		expect(second.status).toBe(200);
		let secondBody = (await second.json()) as { data: { results: { id: string }[] } };
		expect(secondBody.data.results).toHaveLength(1);
		// The second page is a different row, which is the whole point of seeking.
		expect(secondBody.data.results[0]?.id).not.toBe(body.data.results[0]?.id);
	});

	test("rejects a malformed cursor as a bad request", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:read"]);
		let monitor = await createDnsMonitorRow(db, team.id);

		let response = await dispatch(
			db,
			resultsRequest(monitor.id, { Authorization: `Bearer ${key}` }, "?cursor=not-a-cursor"),
		);

		expect(response.status).toBe(400);
		await expectProblem(response, "badRequest");
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

describe("malformed DNS monitor ids", () => {
	test.each([
		["GET", "show", "dns-monitors:read"],
		["DELETE", "destroy", "dns-monitors:write"],
		["GET", "results", "dns-monitors:read"],
	] as const)("%s %s answers validation-error for a raw UUID", async (method, leaf, scope) => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, [scope]);
		let monitor = await createDnsMonitorRow(db, team.id);

		let response = await dispatch(
			db,
			new Request(
				`https://uptime.test${routes.api.v1.dnsMonitors[leaf].href({ dnsMonitorId: monitor.id })}`,
				{ method, headers: { Authorization: `Bearer ${key}` } },
			),
		);

		expect(response.status).toBe(400);
		await expectProblem(response, "validationError");
	});
});

describe("PATCH /api/v1/dns-monitors/:dnsMonitorId", () => {
	/** A merge patch request, sent as `application/merge-patch+json` unless told otherwise. */
	function mergePatch(
		dnsMonitorId: string,
		body: unknown,
		options: { key?: string; contentType?: string } = {},
	) {
		let headers: Record<string, string> = {
			"content-type": options.contentType ?? "application/merge-patch+json",
		};
		if (options.key) headers.Authorization = `Bearer ${options.key}`;
		return new Request(
			`https://uptime.test${routes.api.v1.dnsMonitors.patch.href({ dnsMonitorId: encodeId("dns", dnsMonitorId) })}`,
			{ method: "PATCH", headers, body: JSON.stringify(body) },
		);
	}

	test("changes only the members the patch names", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let monitor = await createDnsMonitorRow(db, team.id, { interval_seconds: 3600 });

		let response = await dispatch(db, mergePatch(monitor.id, { name: "Patched" }, { key }));

		expect(response.status).toBe(200);
		let updated = await DnsMonitor.findByIdForTeam(db, team.id, monitor.id);
		expect(updated?.name).toBe("Patched");
		expect(updated?.domain).toBe("example.com");
		expect(updated?.interval_seconds).toBe(3600);
	});

	test("a new warning window makes the registration due, and null resets it to 30 days", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let monitor = await createDnsMonitorRow(db, team.id, {
			registration_warning_days: 45,
			registration_next_check_at: Date.now() + 1000,
		});

		await dispatch(db, mergePatch(monitor.id, { registrationWarningDays: 90 }, { key }));
		let widened = await DnsMonitor.findByIdForTeam(db, team.id, monitor.id);
		expect(widened?.registration_warning_days).toBe(90);
		expect(widened?.registration_next_check_at).toBeNull();

		await dispatch(db, mergePatch(monitor.id, { registrationWarningDays: null }, { key }));
		let reset = await DnsMonitor.findByIdForTeam(db, team.id, monitor.id);
		expect(reset?.registration_warning_days).toBe(30);
	});

	test("null resets a member to its default", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let monitor = await createDnsMonitorRow(db, team.id, {
			interval_seconds: 3600,
			is_enabled: false,
		});

		let response = await dispatch(
			db,
			mergePatch(monitor.id, { intervalSeconds: null, isEnabled: null }, { key }),
		);

		expect(response.status).toBe(200);
		let updated = await DnsMonitor.findByIdForTeam(db, team.id, monitor.id);
		expect(updated?.interval_seconds).toBe(86_400);
		expect(updated?.is_enabled).toBe(true);
	});

	test("null on a required member answers validation-error at its pointer", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let monitor = await createDnsMonitorRow(db, team.id);

		let response = await dispatch(db, mergePatch(monitor.id, { domain: null }, { key }));

		expect(response.status).toBe(400);
		let problem = await expectProblem(response, "validationError");
		expect(problem.extensions.errors.map((issue) => issue.pointer)).toEqual(["/domain"]);
	});

	test("accepts application/json as a merge patch", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let monitor = await createDnsMonitorRow(db, team.id);

		let response = await dispatch(
			db,
			mergePatch(monitor.id, { isEnabled: false }, { key, contentType: "application/json" }),
		);

		expect(response.status).toBe(200);
		expect((await DnsMonitor.findByIdForTeam(db, team.id, monitor.id))?.is_enabled).toBe(false);
	});

	test("answers unsupported-media-type with Accept-Patch for any other body", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let monitor = await createDnsMonitorRow(db, team.id);

		let response = await dispatch(
			db,
			mergePatch(monitor.id, { name: "x" }, { key, contentType: "text/plain" }),
		);

		expect(response.status).toBe(415);
		expect(response.headers.get("Accept-Patch")).toBe("application/merge-patch+json");
		await expectProblem(response, "unsupportedMediaType");
	});

	test("PUT keeps reading form bodies, refusing null, and rescheduling on a re-sent isEnabled", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let monitor = await createDnsMonitorRow(db, team.id);
		await db.update(dnsMonitors, monitor.id, { next_due_at: 1000 });
		let href = `https://uptime.test${routes.api.v1.dnsMonitors.update.href({ dnsMonitorId: encodeId("dns", monitor.id) })}`;
		let put = (contentType: string, body: string) =>
			new Request(href, {
				method: "PUT",
				headers: { Authorization: `Bearer ${key}`, "content-type": contentType },
				body,
			});

		let form = await dispatch(db, put("application/x-www-form-urlencoded", "name=Form"));
		let refused = await dispatch(db, put("application/json", JSON.stringify({ isEnabled: null })));
		let resent = await dispatch(db, put("application/json", JSON.stringify({ isEnabled: true })));

		expect([form.status, refused.status, resent.status]).toEqual([200, 400, 200]);
		let updated = await db.findOne(dnsMonitors, { where: { id: monitor.id } });
		expect(updated?.name).toBe("Form");
		expect(updated?.next_due_at).not.toBe(1000);
	});

	test("404s for another team's monitor, 401 without a key, 403 without dns-monitors:write", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let writer = await createApiKey(db, team.id, ["dns-monitors:write"]);
		let reader = await createApiKey(db, team.id, ["dns-monitors:read"]);
		let foreign = await createDnsMonitorRow(db, otherTeam.id);
		let own = await createDnsMonitorRow(db, team.id);

		let notFound = await dispatch(db, mergePatch(foreign.id, { name: "x" }, { key: writer }));
		let unauthorized = await dispatch(db, mergePatch(own.id, { name: "x" }));
		let forbidden = await dispatch(db, mergePatch(own.id, { name: "x" }, { key: reader }));

		expect([notFound.status, unauthorized.status, forbidden.status]).toEqual([404, 401, 403]);
	});
});
