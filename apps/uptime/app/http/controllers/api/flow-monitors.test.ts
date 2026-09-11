/**
 * Tests `/api/v1/flow-monitors`: list/create/get/update/delete and check history, gated by a
 * real `requireApiKey` bearer-token check.
 *
 * The two rules worth a test each are the ones a script could otherwise walk around: an
 * interval off the priced list is refused rather than rounded, and a source reaching a host no
 * verified domain covers is refused before storage. `source` is asserted absent from every
 * response, since a spec signs in with real credentials.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TypeID } from "@sdxc/typeid";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { ApiKeyScope, InsertFlowMonitorResult, SelectTeam } from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import FlowMonitor from "~/app/data/flow-monitor";
import { database } from "~/app/http/middleware/database";
import { createTestDatabase } from "~/app/lib/test/db";
import { parseLink } from "~/app/lib/test/paging";
import { encodeId } from "~/app/services/typed-id";
import { flowMonitorResults, flowMonitors, teamDomains, teams } from "~/database/schema";
import routes from "~/routes/web";

const DOMAIN = "example.test";
const ORIGIN = `https://app.${DOMAIN}`;

/** The password a login flow writes into its spec, and the reason `source` never comes back. */
const SPEC_PASSWORD = "hunter2-in-the-spec";

let { default: flowMonitorsController, flowMonitorsRoutes } = await import("./flow-monitors");

type Db = ReturnType<typeof createTestDatabase>["db"];

/** A flow whose only host a verified domain covers, carrying a credential in its body. */
function validSource(): string {
	return [
		"use http",
		'test "a member can sign in" {',
		"\twhen {",
		`\t\tlet response = http.post "${ORIGIN}/login" { password: "${SPEC_PASSWORD}" }`,
		"\t}",
		"}",
	].join("\n");
}

/** A flow reaching somewhere this team has not proved it owns. */
function unverifiedSource(): string {
	return [
		"use http",
		'test "reaches elsewhere" {',
		"\twhen {",
		'\t\tlet response = http.get "https://victim.invalid.test/login"',
		"\t}",
		"}",
	].join("\n");
}

async function createTeamRow(db: Db, options: { verified?: boolean } = {}): Promise<SelectTeam> {
	let team = await db.create(
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

	if (options.verified !== false) {
		await db.create(
			teamDomains,
			{ id: crypto.randomUUID(), team_id: team.id, hostname: DOMAIN, verified_at: Date.now() },
			{ touch: true, returnRow: true },
		);
	}

	return team;
}

async function createApiKey(db: Db, teamId: string, scopes: ApiKeyScope[]): Promise<string> {
	let { key } = await ApiKey.create(db, teamId, { name: "test", scopes, expires_at: null });
	return key;
}

/**
 * Writes a check-result row with the caller's own `checked_at`, so a test that asserts an
 * order gets one: the recorded path stamps the current millisecond, and two checks written
 * back to back can share it.
 */
async function createResultRow(
	db: Db,
	monitorId: string,
	values: Partial<InsertFlowMonitorResult> & { checked_at: number },
) {
	return await db.create(
		flowMonitorResults,
		{
			id: crypto.randomUUID(),
			flow_monitor_id: monitorId,
			status: "up",
			tests_total: 1,
			tests_passed: 1,
			tests_failed: 0,
			requests_made: 1,
			failed_test: null,
			failed_at_line: null,
			failure_detail: null,
			duration_ms: 100,
			error_message: null,
			...values,
		},
		{ touch: true, returnRow: true },
	);
}

async function dispatch(
	db: Db,
	request: { method: string; path: string; key?: string; body?: Record<string, unknown> },
) {
	let router = createRouter({ middleware: [asyncContext(), database(() => db)] });
	router.map(flowMonitorsRoutes, flowMonitorsController);

	let headers: Record<string, string> = { "content-type": "application/json" };
	if (request.key !== undefined) headers.Authorization = `Bearer ${request.key}`;

	let httpRequest = new Request(`https://uptime.test${request.path}`, {
		method: request.method,
		headers,
		body: request.body === undefined ? undefined : JSON.stringify(request.body),
	});

	return router.fetch(httpRequest);
}

describe("GET /api/v1/flow-monitors", () => {
	test("lists only the calling team's flow monitors", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:read"]);

		await FlowMonitor.create(db, team.id, { name: "Mine", source: validSource() });
		await FlowMonitor.create(db, otherTeam.id, { name: "Theirs", source: validSource() });

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.flowMonitors.index.href(),
			key,
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { flowMonitors: { name: string }[] } };
		expect(body.data.flowMonitors).toHaveLength(1);
		expect(body.data.flowMonitors[0]?.name).toBe("Mine");
	});

	test("serves one page and a cursor that walks to the next", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:read"]);

		await FlowMonitor.create(db, team.id, { name: "First", source: validSource() });
		await FlowMonitor.create(db, team.id, { name: "Second", source: validSource() });

		let path = routes.api.v1.flowMonitors.index.href();
		let response = await dispatch(db, { method: "GET", path: `${path}?perPage=1`, key });

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { flowMonitors: { name: string }[] } };
		expect(body.data.flowMonitors).toHaveLength(1);

		// Navigation rides in the headers now, so following the feed means following `Link`.
		let next = parseLink(response.headers.get("Link"));
		expect(next).not.toBeNull();

		let second = await dispatch(db, { method: "GET", path: next as string, key });
		expect(second.status).toBe(200);
		let secondBody = (await second.json()) as { data: { flowMonitors: { name: string }[] } };
		expect(secondBody.data.flowMonitors).toHaveLength(1);
		// The second page is a different row, which is the whole point of seeking.
		expect(secondBody.data.flowMonitors[0]?.name).not.toBe(body.data.flowMonitors[0]?.name);
	});

	test("rejects a malformed cursor as a bad request", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:read"]);

		let path = routes.api.v1.flowMonitors.index.href();
		let response = await dispatch(db, { method: "GET", path: `${path}?cursor=not-a-cursor`, key });

		expect(response.status).toBe(400);
		let body = (await response.json()) as { error: { code: string } };
		expect(body.error.code).toBe("BAD_REQUEST");
	});

	test("omits the spec source, which carries the flow's credentials", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:read"]);

		await FlowMonitor.create(db, team.id, { name: "Sign in", source: validSource() });

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.flowMonitors.index.href(),
			key,
		});

		let text = await response.text();
		expect(text).not.toContain(SPEC_PASSWORD);
		expect(text).not.toContain("source");
	});

	test("returns 401 when the Authorization header is missing", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.flowMonitors.index.href(),
		});
		expect(response.status).toBe(401);
	});

	test("returns 401 when the Authorization header is garbage", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.flowMonitors.index.href(),
			key: "not-a-real-key",
		});
		expect(response.status).toBe(401);
	});

	test("returns 403 when the key lacks the read scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:write"]);

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.flowMonitors.index.href(),
			key,
		});
		expect(response.status).toBe(403);
	});
});

describe("POST /api/v1/flow-monitors", () => {
	test("creates a flow monitor and returns 201 with the stored row", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:write"]);

		let response = await dispatch(db, {
			method: "POST",
			path: routes.api.v1.flowMonitors.create.href(),
			key,
			body: { name: "Sign in", source: validSource(), intervalSeconds: 900 },
		});

		expect(response.status).toBe(201);
		let body = (await response.json()) as {
			data: { flowMonitor: { id: string; name: string; intervalSeconds: number } };
		};
		expect(body.data.flowMonitor.name).toBe("Sign in");
		expect(body.data.flowMonitor.intervalSeconds).toBe(900);

		let stored = await db.findOne(flowMonitors, {
			where: { id: TypeID.fromString(body.data.flowMonitor.id, "flow").toUUID() },
		});
		expect(stored?.source).toContain(SPEC_PASSWORD);
	});

	test("never echoes the source it was just handed", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:write"]);

		let response = await dispatch(db, {
			method: "POST",
			path: routes.api.v1.flowMonitors.create.href(),
			key,
			body: { name: "Sign in", source: validSource() },
		});

		expect(await response.text()).not.toContain(SPEC_PASSWORD);
	});

	test("defaults an omitted interval to an hour, enabled", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:write"]);

		let response = await dispatch(db, {
			method: "POST",
			path: routes.api.v1.flowMonitors.create.href(),
			key,
			body: { name: "Sign in", source: validSource() },
		});

		let body = (await response.json()) as {
			data: { flowMonitor: { intervalSeconds: number; isEnabled: boolean } };
		};
		expect(body.data.flowMonitor.intervalSeconds).toBe(3600);
		expect(body.data.flowMonitor.isEnabled).toBeTruthy();
	});

	/**
	 * Every value off the priced list is refused rather than rounded to the nearest one, since
	 * an interval is a commercial term: 60 is what a caller used to a per-minute HTTP monitor
	 * would reach for first, and silently getting 900 would be discovered in a latency chart.
	 */
	test("refuses an interval that is not on the priced list", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:write"]);

		let response = await dispatch(db, {
			method: "POST",
			path: routes.api.v1.flowMonitors.create.href(),
			key,
			body: { name: "Too often", source: validSource(), intervalSeconds: 60 },
		});

		expect(response.status).toBe(400);
		let body = (await response.json()) as { error: { code: string; message: string } };
		expect(body.error.code).toBe("VALIDATION_ERROR");
		expect(body.error.message).toBe("Expected one of: 900, 1800, 3600, 10800, 21600, 43200, 86400");
		expect(await db.findOne(flowMonitors, { where: { team_id: team.id } })).toBeNull();
	});

	test("accepts every interval on the priced list", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:write"]);

		for (let seconds of [900, 1800, 3600, 10_800, 21_600, 43_200, 86_400]) {
			let response = await dispatch(db, {
				method: "POST",
				path: routes.api.v1.flowMonitors.create.href(),
				key,
				body: { name: `Every ${seconds}s`, source: validSource(), intervalSeconds: seconds },
			});
			expect(response.status).toBe(201);
		}
	});

	/**
	 * The gate the dashboard form applies, applied identically here: both call
	 * `inspectFlowSource`, so a key cannot create the monitor a person was refused.
	 */
	test("refuses a source reaching a host no verified domain covers, and stores nothing", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:write"]);

		let response = await dispatch(db, {
			method: "POST",
			path: routes.api.v1.flowMonitors.create.href(),
			key,
			body: { name: "Somebody else's site", source: unverifiedSource() },
		});

		expect(response.status).toBe(400);
		let body = (await response.json()) as { error: { code: string; message: string } };
		expect(body.error.code).toBe("VALIDATION_ERROR");
		expect(body.error.message).toBe(
			"This flow reaches victim.invalid.test, which no verified domain on this team covers. A flow monitor can only drive a domain the team has verified.",
		);
		expect(await db.findOne(flowMonitors, { where: { team_id: team.id } })).toBeNull();
	});

	test("refuses a source naming no host at all", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:write"]);

		let response = await dispatch(db, {
			method: "POST",
			path: routes.api.v1.flowMonitors.create.href(),
			key,
			body: {
				name: "Asserts on nothing",
				source: ['test "asserts on nothing" {', "\tthen {", "\t\texpect true", "\t}", "}"].join(
					"\n",
				),
			},
		});

		expect(response.status).toBe(400);
		expect(await db.findOne(flowMonitors, { where: { team_id: team.id } })).toBeNull();
	});

	/** A team with nothing verified reaches nowhere, which is the same refusal as a wrong host. */
	test("refuses every source when the team has verified no domain", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db, { verified: false });
		let key = await createApiKey(db, team.id, ["flow-monitors:write"]);

		let response = await dispatch(db, {
			method: "POST",
			path: routes.api.v1.flowMonitors.create.href(),
			key,
			body: { name: "Sign in", source: validSource() },
		});

		expect(response.status).toBe(400);
		expect(await db.findOne(flowMonitors, { where: { team_id: team.id } })).toBeNull();
	});

	test("refuses a source that will not parse", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:write"]);

		let response = await dispatch(db, {
			method: "POST",
			path: routes.api.v1.flowMonitors.create.href(),
			key,
			body: { name: "Broken", source: 'test "unclosed" {' },
		});

		expect(response.status).toBe(400);
		expect(await db.findOne(flowMonitors, { where: { team_id: team.id } })).toBeNull();
	});

	test("refuses a source over the length cap", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:write"]);

		let response = await dispatch(db, {
			method: "POST",
			path: routes.api.v1.flowMonitors.create.href(),
			key,
			body: { name: "Enormous", source: "x".repeat(20_001) },
		});

		expect(response.status).toBe(400);
		expect(await db.findOne(flowMonitors, { where: { team_id: team.id } })).toBeNull();
	});

	test("returns 400 for a blank name", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:write"]);

		let response = await dispatch(db, {
			method: "POST",
			path: routes.api.v1.flowMonitors.create.href(),
			key,
			body: { name: "", source: validSource() },
		});

		expect(response.status).toBe(400);
	});

	test("returns 401 when the Authorization header is missing", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, {
			method: "POST",
			path: routes.api.v1.flowMonitors.create.href(),
			body: { name: "Sign in", source: validSource() },
		});
		expect(response.status).toBe(401);
	});

	test("returns 403 when the key lacks the write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:read"]);

		let response = await dispatch(db, {
			method: "POST",
			path: routes.api.v1.flowMonitors.create.href(),
			key,
			body: { name: "Sign in", source: validSource() },
		});
		expect(response.status).toBe(403);
	});
});

describe("GET /api/v1/flow-monitors/:flowMonitorId", () => {
	test("returns a single flow monitor without its source", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:read"]);
		let monitor = await FlowMonitor.create(db, team.id, { name: "Sign in", source: validSource() });

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.flowMonitors.show.href({ flowMonitorId: encodeId("flow", monitor.id) }),
			key,
		});

		expect(response.status).toBe(200);
		let text = await response.text();
		expect(text).not.toContain(SPEC_PASSWORD);
		let body = JSON.parse(text) as { data: { flowMonitor: { name: string; lastStatus: null } } };
		expect(body.data.flowMonitor.name).toBe("Sign in");
		expect(body.data.flowMonitor.lastStatus).toBeNull();
	});

	test("returns 404 for a monitor belonging to another team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:read"]);
		let monitor = await FlowMonitor.create(db, otherTeam.id, {
			name: "Theirs",
			source: validSource(),
		});

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.flowMonitors.show.href({ flowMonitorId: encodeId("flow", monitor.id) }),
			key,
		});

		expect(response.status).toBe(404);
		let body = (await response.json()) as { error: { code: string } };
		expect(body.error.code).toBe("NOT_FOUND");
	});
});

describe("PUT /api/v1/flow-monitors/:flowMonitorId", () => {
	test("updates only the fields it was sent", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:write"]);
		let monitor = await FlowMonitor.create(db, team.id, { name: "Sign in", source: validSource() });

		let response = await dispatch(db, {
			method: "PUT",
			path: routes.api.v1.flowMonitors.update.href({ flowMonitorId: encodeId("flow", monitor.id) }),
			key,
			body: { name: "Sign in and read profile", intervalSeconds: 21_600 },
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as {
			data: { flowMonitor: { name: string; intervalSeconds: number } };
		};
		expect(body.data.flowMonitor.name).toBe("Sign in and read profile");
		expect(body.data.flowMonitor.intervalSeconds).toBe(21_600);

		let stored = await db.findOne(flowMonitors, { where: { id: monitor.id } });
		expect(stored?.source).toBe(validSource());
	});

	/** Same rule, same message, on the edit path: a monitor cannot be walked onto a new host. */
	test("refuses a replacement source reaching an unverified host, leaving the old one stored", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:write"]);
		let monitor = await FlowMonitor.create(db, team.id, { name: "Sign in", source: validSource() });

		let response = await dispatch(db, {
			method: "PUT",
			path: routes.api.v1.flowMonitors.update.href({ flowMonitorId: encodeId("flow", monitor.id) }),
			key,
			body: { source: unverifiedSource() },
		});

		expect(response.status).toBe(400);
		let stored = await db.findOne(flowMonitors, { where: { id: monitor.id } });
		expect(stored?.source).toBe(validSource());
	});

	test("refuses an interval that is not on the priced list", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:write"]);
		let monitor = await FlowMonitor.create(db, team.id, { name: "Sign in", source: validSource() });

		let response = await dispatch(db, {
			method: "PUT",
			path: routes.api.v1.flowMonitors.update.href({ flowMonitorId: encodeId("flow", monitor.id) }),
			key,
			body: { intervalSeconds: 120 },
		});

		expect(response.status).toBe(400);
		let stored = await db.findOne(flowMonitors, { where: { id: monitor.id } });
		expect(stored?.interval_seconds).toBe(3600);
	});

	test("returns 404 for a monitor belonging to another team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:write"]);
		let monitor = await FlowMonitor.create(db, otherTeam.id, {
			name: "Theirs",
			source: validSource(),
		});

		let response = await dispatch(db, {
			method: "PUT",
			path: routes.api.v1.flowMonitors.update.href({ flowMonitorId: encodeId("flow", monitor.id) }),
			key,
			body: { name: "Mine now" },
		});

		expect(response.status).toBe(404);
	});
});

describe("DELETE /api/v1/flow-monitors/:flowMonitorId", () => {
	test("deletes the monitor and its check history", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:write"]);
		let monitor = await FlowMonitor.create(db, team.id, { name: "Sign in", source: validSource() });
		await FlowMonitor.recordCheckResult(db, monitor.id, {
			status: "up",
			testsTotal: 1,
			testsPassed: 1,
			testsFailed: 0,
			requestsMade: 1,
			failedTest: null,
			failedAtLine: null,
			failureDetail: null,
			durationMs: 120,
			errorMessage: null,
		});

		let response = await dispatch(db, {
			method: "DELETE",
			path: routes.api.v1.flowMonitors.destroy.href({
				flowMonitorId: encodeId("flow", monitor.id),
			}),
			key,
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { deleted: boolean } };
		expect(body.data.deleted).toBeTruthy();

		expect(await db.findOne(flowMonitors, { where: { id: monitor.id } })).toBeNull();
		expect(
			await db.findMany(flowMonitorResults, { where: { flow_monitor_id: monitor.id } }),
		).toHaveLength(0);
	});

	test("returns 404 for a monitor belonging to another team, leaving it alone", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:write"]);
		let monitor = await FlowMonitor.create(db, otherTeam.id, {
			name: "Theirs",
			source: validSource(),
		});

		let response = await dispatch(db, {
			method: "DELETE",
			path: routes.api.v1.flowMonitors.destroy.href({
				flowMonitorId: encodeId("flow", monitor.id),
			}),
			key,
		});

		expect(response.status).toBe(404);
		expect(await db.findOne(flowMonitors, { where: { id: monitor.id } })).not.toBeNull();
	});
});

describe("GET /api/v1/flow-monitors/:flowMonitorId/results", () => {
	test("returns the counters and the assertion that broke, newest first", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:read"]);
		let monitor = await FlowMonitor.create(db, team.id, { name: "Sign in", source: validSource() });

		await createResultRow(db, monitor.id, {
			status: "up",
			tests_total: 2,
			tests_passed: 2,
			tests_failed: 0,
			requests_made: 3,
			duration_ms: 640,
			checked_at: 1_000,
		});
		await createResultRow(db, monitor.id, {
			status: "down",
			tests_total: 2,
			tests_passed: 1,
			tests_failed: 1,
			requests_made: 2,
			failed_test: "a member can sign in",
			failed_at_line: 4,
			failure_detail: "expected 200, got 500",
			duration_ms: 812,
			checked_at: 2_000,
		});

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.flowMonitors.results.href({
				flowMonitorId: encodeId("flow", monitor.id),
			}),
			key,
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as {
			data: {
				results: {
					status: string;
					testsPassed: number;
					testsTotal: number;
					requestsMade: number;
					failedTest: string | null;
					failedAtLine: number | null;
					failureDetail: string | null;
					durationMs: number | null;
				}[];
			};
		};

		expect(body.data.results).toHaveLength(2);
		expect(body.data.results[0]).toMatchObject({
			status: "down",
			testsPassed: 1,
			testsTotal: 2,
			requestsMade: 2,
			failedTest: "a member can sign in",
			failedAtLine: 4,
			failureDetail: "expected 200, got 500",
			durationMs: 812,
		});
	});

	test("serves one page and a cursor that walks to the next", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:read"]);
		let monitor = await FlowMonitor.create(db, team.id, { name: "Sign in", source: validSource() });

		await createResultRow(db, monitor.id, { status: "up", checked_at: 1_000 });
		await createResultRow(db, monitor.id, { status: "down", checked_at: 2_000 });

		let path = routes.api.v1.flowMonitors.results.href({
			flowMonitorId: encodeId("flow", monitor.id),
		});
		let response = await dispatch(db, { method: "GET", path: `${path}?perPage=1`, key });

		expect(response.status).toBe(200);
		let body = (await response.json()) as { data: { results: { status: string }[] } };
		expect(body.data.results).toHaveLength(1);

		// Navigation rides in the headers now, so following the feed means following `Link`.
		let next = parseLink(response.headers.get("Link"));
		expect(next).not.toBeNull();

		let second = await dispatch(db, { method: "GET", path: next as string, key });
		expect(second.status).toBe(200);
		let secondBody = (await second.json()) as { data: { results: { status: string }[] } };
		expect(secondBody.data.results).toHaveLength(1);
		// The second page is a different row, which is the whole point of seeking.
		expect(secondBody.data.results[0]?.status).not.toBe(body.data.results[0]?.status);
	});

	test("rejects a malformed cursor as a bad request", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:read"]);
		let monitor = await FlowMonitor.create(db, team.id, { name: "Sign in", source: validSource() });

		let path = routes.api.v1.flowMonitors.results.href({
			flowMonitorId: encodeId("flow", monitor.id),
		});
		let response = await dispatch(db, { method: "GET", path: `${path}?cursor=not-a-cursor`, key });

		expect(response.status).toBe(400);
		let body = (await response.json()) as { error: { code: string } };
		expect(body.error.code).toBe("BAD_REQUEST");
	});

	test("returns 404 for a monitor belonging to another team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:read"]);
		let monitor = await FlowMonitor.create(db, otherTeam.id, {
			name: "Theirs",
			source: validSource(),
		});

		let response = await dispatch(db, {
			method: "GET",
			path: routes.api.v1.flowMonitors.results.href({
				flowMonitorId: encodeId("flow", monitor.id),
			}),
			key,
		});

		expect(response.status).toBe(404);
	});
});

describe("GET /api/v1/flow-monitors total", () => {
	test("counts every flow monitor on the team, not just the page", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:read"]);

		await FlowMonitor.create(db, team.id, { name: "One", source: validSource() });
		await FlowMonitor.create(db, team.id, { name: "Two", source: validSource() });
		await FlowMonitor.create(db, team.id, { name: "Three", source: validSource() });
		// A monitor the key cannot see must not reach the total either.
		await FlowMonitor.create(db, otherTeam.id, { name: "Theirs", source: validSource() });

		let response = await dispatch(db, {
			method: "GET",
			path: `${routes.api.v1.flowMonitors.index.href()}?perPage=1`,
			key,
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as {
			data: { flowMonitors: unknown[] };
			meta: { pagination: { total: number } };
		};
		expect(body.data.flowMonitors).toHaveLength(1);
		expect(body.meta.pagination.total).toBe(3);
	});

	test("leaves the result history without a total, since counting it is unbounded", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["flow-monitors:read"]);
		let monitor = await FlowMonitor.create(db, team.id, { name: "Sign in", source: validSource() });

		await createResultRow(db, monitor.id, { checked_at: 1_000 });
		await createResultRow(db, monitor.id, { checked_at: 2_000 });

		let response = await dispatch(db, {
			method: "GET",
			path: `${routes.api.v1.flowMonitors.results.href({
				flowMonitorId: encodeId("flow", monitor.id),
			})}?perPage=1`,
			key,
		});

		expect(response.status).toBe(200);
		let body = (await response.json()) as { meta: { pagination: Record<string, unknown> } };
		expect(body.meta.pagination).not.toHaveProperty("total");
	});
});
