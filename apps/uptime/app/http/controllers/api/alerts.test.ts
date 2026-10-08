/**
 * Tests the `/api/v1/alerts` collection endpoints: `GET` lists only the calling
 * team's alerts with channel config stripped, and `POST` creates one for any
 * channel strategy, enforcing the per-team alert cap. Every
 * action is guarded by `requireApiKey`, so each test authenticates with a real
 * bearer key minted through `ApiKey.create`, exercising that same middleware.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEnv } from "@sdxc/cloudflare-mocks";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { describe, expect, test, vi } from "vitest";

import type { ApiKeyScope } from "~/database/schema";

import { MAX_ALERTS_PER_TEAM } from "~/app/data/alert";
import ApiKey from "~/app/data/api-key";
import { database } from "~/app/http/middleware/database";
import { createTestDatabase } from "~/app/lib/test/db";
import { markInFlight } from "~/app/lib/test/idempotency";
import { useMailServerDns } from "~/app/lib/test/mail-servers";
import { checkConformance } from "~/app/lib/test/openapi";
import { parseLink } from "~/app/lib/test/paging";
import { expectProblem } from "~/app/lib/test/problem";
import { encodeId } from "~/app/services/typed-id";
import { alerts, dnsMonitors, monitors, teams } from "~/database/schema";
import { alertsRoutes } from "~/routes/api-groups";

/** Checks every exchange against the API document; see `checkConformance`. */
const CONFORMANCE = checkConformance(alertsRoutes);

/**
 * `~/app/data/monitor`, imported transitively for `monitorId` validation,
 * reads `env` from `cloudflare:workers` at module load, so this mock must
 * also resolve here, alongside the repo-root `bunfig.toml` preload.
 */
vi.doMock("cloudflare:workers", () => ({ env: createEnv<Env>({}) }));

let { default: alertsController } = await import("./alerts");

/** Answers every mail-server lookup the email checks make; each domain receives mail by default. */
let dns = useMailServerDns();

type Db = ReturnType<typeof createTestDatabase>["db"];

async function createTeamRow(db: Db) {
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

async function createApiKey(db: Db, teamId: string, scopes: ApiKeyScope[]) {
	let { key } = await ApiKey.create(db, teamId, { name: "test key", scopes, expires_at: null });
	return key;
}

async function dispatch(db: Db, request: Request) {
	let router = createRouter({ middleware: [CONFORMANCE, asyncContext(), database(() => db)] });
	router.map(alertsRoutes, alertsController);

	return router.fetch(request);
}

function get(key: string | null, href: string = alertsRoutes.alertsIndex.href()) {
	return new Request(`https://uptime.test${href}`, {
		method: "GET",
		headers: key ? { Authorization: `Bearer ${key}` } : {},
	});
}

async function createAlertRow(db: Db, teamId: string, name: string) {
	return await db.create(
		alerts,
		{
			id: crypto.randomUUID(),
			team_id: teamId,
			monitor_id: null,
			name,
			notify_on_recovery: true,
			cooldown_minutes: 0,
			config: { strategy: "email", config: { to: "a@example.com", subjectPrefix: "" } },
		},
		{ touch: true, returnRow: true },
	);
}

function post(key: string | null, body: unknown) {
	return new Request(`https://uptime.test${alertsRoutes.alertsCreate.href()}`, {
		method: "POST",
		headers: {
			...(key ? { Authorization: `Bearer ${key}` } : {}),
			"content-type": "application/json",
		},
		body: JSON.stringify(body),
	});
}

function emailAlertBody(overrides: Record<string, unknown> = {}) {
	return { strategy: "email", name: "Site down", email: "ops@example.com", ...overrides };
}

describe("GET /api/v1/alerts", () => {
	test("lists only the calling team's alerts", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:read"]);

		await createAlertRow(db, team.id, "Mine");
		await createAlertRow(db, otherTeam.id, "Not mine");

		let response = await dispatch(db, get(key));
		expect(response.status).toBe(200);

		let body = (await response.json()) as { data: { alerts: Array<{ name: string }> } };
		expect(body.data.alerts).toHaveLength(1);
		expect(body.data.alerts[0]?.name).toBe("Mine");
	});

	test("reports a pagerduty alert by its strategy alone, keeping its integration key out", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:read"]);
		await db.create(
			alerts,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				monitor_id: null,
				name: "On-call",
				notify_on_recovery: true,
				cooldown_minutes: 0,
				config: { strategy: "pagerduty", config: { routingKey: "0123456789abcdef" } },
			},
			{ touch: true, returnRow: true },
		);

		let response = await dispatch(db, get(key));
		expect(response.status).toBe(200);

		let body = (await response.json()) as { data: { alerts: Array<{ config: unknown }> } };
		expect(body.data.alerts.map((alert) => alert.config)).toEqual([{ strategy: "pagerduty" }]);
	});

	test("serves one page and a cursor that walks to the next", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:read"]);

		await createAlertRow(db, team.id, "First");
		await createAlertRow(db, team.id, "Second");

		let response = await dispatch(db, get(key, `${alertsRoutes.alertsIndex.href()}?perPage=1`));
		expect(response.status).toBe(200);

		let body = (await response.json()) as { data: { alerts: Array<{ name: string }> } };
		expect(body.data.alerts).toHaveLength(1);

		// Navigation rides in the headers now, so following the feed means following `Link`.
		let next = parseLink(response.headers.get("Link"));
		expect(next).not.toBeNull();

		let second = await dispatch(db, get(key, next as string));
		expect(second.status).toBe(200);

		let secondBody = (await second.json()) as { data: { alerts: Array<{ name: string }> } };
		expect(secondBody.data.alerts).toHaveLength(1);
		// The second page is a different row, which is the whole point of seeking.
		expect(secondBody.data.alerts[0]?.name).not.toBe(body.data.alerts[0]?.name);
	});

	test("rejects a malformed cursor as a bad request", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:read"]);

		let response = await dispatch(
			db,
			get(key, `${alertsRoutes.alertsIndex.href()}?cursor=not-a-cursor`),
		);
		expect(response.status).toBe(400);

		await expectProblem(response, "badRequest");
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, get(null));
		expect(response.status).toBe(401);
	});

	test("returns 401 for a garbage Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(
			db,
			new Request(`https://uptime.test${alertsRoutes.alertsIndex.href()}`, {
				method: "GET",
				headers: { Authorization: "Bearer not-a-real-key" },
			}),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key missing the alerts:read scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);

		let response = await dispatch(db, get(key));
		expect(response.status).toBe(403);
	});
});

describe("GET /api/v1/alerts total", () => {
	test("counts every alert on the team, not just the page", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:read"]);
		await createAlertRow(db, team.id, "First");
		await createAlertRow(db, team.id, "Second");
		await createAlertRow(db, team.id, "Third");
		// An alert the key cannot see must not reach the total either.
		await createAlertRow(db, otherTeam.id, "Theirs");

		let response = await dispatch(db, get(key, `${alertsRoutes.alertsIndex.href()}?perPage=1`));

		expect(response.status).toBe(200);
		let body = (await response.json()) as {
			data: { alerts: unknown[] };
			meta: { pagination: { total: number } };
		};
		expect(body.data.alerts).toHaveLength(1);
		expect(body.meta.pagination.total).toBe(3);
	});
});

describe("POST /api/v1/alerts", () => {
	test("creates an email-strategy alert and returns 201", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);

		let response = await dispatch(db, post(key, emailAlertBody()));
		expect(response.status).toBe(201);

		let body = (await response.json()) as { data: { alert: { id: string; name: string } } };
		expect(body.data.alert.name).toBe("Site down");

		let created = await db.findOne(alerts, { where: { team_id: team.id } });
		expect(created?.config).toEqual({
			strategy: "email",
			config: { to: "ops@example.com", subjectPrefix: "" },
		});
	});

	test("creates a pagerduty alert, storing the trimmed key and answering without it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);

		let response = await dispatch(
			db,
			post(key, {
				name: "On-call",
				strategy: "pagerduty",
				routingKey: " 0123456789abcdef0123456789abcdef ",
			}),
		);
		expect(response.status).toBe(201);
		expect(await response.text()).not.toContain("0123456789abcdef0123456789abcdef");

		let created = await db.findOne(alerts, { where: { team_id: team.id } });
		expect(created?.config).toEqual({
			strategy: "pagerduty",
			config: { routingKey: "0123456789abcdef0123456789abcdef" },
		});
	});

	test("refuses a blank pagerduty integration key", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);

		let response = await dispatch(
			db,
			post(key, { name: "On-call", strategy: "pagerduty", routingKey: "   " }),
		);

		expect(response.status).toBe(400);
		let problem = await expectProblem(response, "validationError");
		expect(problem.extensions.errors.map((issue) => issue.pointer)).toEqual(["/routingKey"]);
		expect(await db.count(alerts, { where: { team_id: team.id } })).toBe(0);
	});

	test("creates a slack alert from a hooks.slack.com URL", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);

		let response = await dispatch(
			db,
			post(key, {
				name: "Slack",
				strategy: "slack",
				webhookUrl: "https://hooks.slack.com/services/T000/B000/XXXX",
			}),
		);

		expect(response.status).toBe(201);
		let created = await db.findOne(alerts, { where: { team_id: team.id } });
		expect(created?.config).toEqual({
			strategy: "slack",
			config: { webhookUrl: "https://hooks.slack.com/services/T000/B000/XXXX" },
		});
	});

	test("refuses a slack webhook URL on another host", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);

		let response = await dispatch(
			db,
			post(key, {
				name: "Slack",
				strategy: "slack",
				webhookUrl: "https://hooks.slack.example/services/T000/B000/XXXX",
			}),
		);

		expect(response.status).toBe(400);
		let problem = await expectProblem(response, "validationError");
		expect(problem.extensions.errors.map((issue) => issue.pointer)).toEqual(["/webhookUrl"]);
		expect(await db.count(alerts, { where: { team_id: team.id } })).toBe(0);
	});

	test("returns 400 naming the recipient when its domain receives no mail", async () => {
		dns.answer("nomail.example", "no-mail-server");
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);

		let response = await dispatch(db, post(key, emailAlertBody({ email: "ops@nomail.example" })));

		expect(response.status).toBe(400);
		let problem = await expectProblem(response, "validationError");
		expect(problem.extensions.errors).toEqual([
			{ pointer: "/email", code: "invalid", message: "nomail.example does not accept email" },
		]);
		expect(await db.count(alerts, { where: { team_id: team.id } })).toBe(0);
	});

	test("looks up no mail server for an alert that sends to a webhook", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);

		let response = await dispatch(
			db,
			post(key, { name: "Hook", strategy: "webhook", url: "https://hooks.example/uptime" }),
		);

		expect(response.status).toBe(201);
		expect(dns.asked).toEqual([]);
	});

	test("returns 400 when the payload fails validation", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);

		let response = await dispatch(db, post(key, emailAlertBody({ name: "" })));
		expect(response.status).toBe(400);

		await expectProblem(response, "validationError");
		expect(await db.count(alerts, { where: { team_id: team.id } })).toBe(0);
	});

	test("returns 404 when monitorId doesn't belong to the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);

		let response = await dispatch(
			db,
			post(key, emailAlertBody({ monitorId: encodeId("mon", crypto.randomUUID()) })),
		);
		expect(response.status).toBe(404);
		expect(await db.count(alerts, { where: { team_id: team.id } })).toBe(0);
	});

	/**
	 * `monitorId` shipped alone, when an id could only mean an HTTP monitor. A client still
	 * sending one must keep getting exactly that, or its alert would silently change scope.
	 */
	test("reads a monitorId with no monitorType as an HTTP monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let monitor = await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				author_id: crypto.randomUUID(),
				name: "Homepage",
				url: "https://example.com",
			},
			{ touch: true, returnRow: true },
		);

		let response = await dispatch(
			db,
			post(key, emailAlertBody({ monitorId: encodeId("mon", monitor.id) })),
		);
		expect(response.status).toBe(201);

		let created = await db.findOne(alerts, { where: { team_id: team.id } });
		expect(created?.monitor_type).toBe("http");
		expect(created?.monitor_id).toBe(monitor.id);
	});

	test("creates a type-scoped alert from monitorType alone", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);

		let response = await dispatch(db, post(key, emailAlertBody({ monitorType: "dns" })));
		expect(response.status).toBe(201);

		let body = (await response.json()) as { data: { alert: { monitorType: string | null } } };
		expect(body.data.alert.monitorType).toBe("dns");

		let created = await db.findOne(alerts, { where: { team_id: team.id } });
		expect(created?.monitor_type).toBe("dns");
		expect(created?.monitor_id).toBeNull();
	});

	test("creates an alert scoped to one DNS monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let monitor = await db.create(
			dnsMonitors,
			{ id: crypto.randomUUID(), team_id: team.id, name: "Domain", domain: "example.com" },
			{ touch: true, returnRow: true },
		);

		let response = await dispatch(
			db,
			post(key, emailAlertBody({ monitorType: "dns", monitorId: encodeId("dns", monitor.id) })),
		);
		expect(response.status).toBe(201);

		let created = await db.findOne(alerts, { where: { team_id: team.id } });
		expect(created?.monitor_type).toBe("dns");
		expect(created?.monitor_id).toBe(monitor.id);
	});

	test("returns 404 when the monitorId belongs to a different monitor type", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let monitor = await db.create(
			monitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				author_id: crypto.randomUUID(),
				name: "Homepage",
				url: "https://example.com",
			},
			{ touch: true, returnRow: true },
		);

		let response = await dispatch(
			db,
			post(key, emailAlertBody({ monitorType: "dns", monitorId: encodeId("mon", monitor.id) })),
		);
		expect(response.status).toBe(404);
		expect(await db.count(alerts, { where: { team_id: team.id } })).toBe(0);
	});

	test("returns 400 for a monitorType outside the supported set", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);

		let response = await dispatch(db, post(key, emailAlertBody({ monitorType: "pigeon" })));
		expect(response.status).toBe(400);
		expect(await db.count(alerts, { where: { team_id: team.id } })).toBe(0);
	});

	test("returns 400 once the team is at the per-team alert cap", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);

		for (let i = 0; i < MAX_ALERTS_PER_TEAM; i++) {
			await db.create(
				alerts,
				{
					id: crypto.randomUUID(),
					team_id: team.id,
					monitor_id: null,
					name: `Alert ${i}`,
					notify_on_recovery: true,
					cooldown_minutes: 0,
					config: { strategy: "email", config: { to: "a@example.com", subjectPrefix: "" } },
				},
				{ touch: true, returnRow: true },
			);
		}

		let response = await dispatch(db, post(key, emailAlertBody()));
		expect(response.status).toBe(400);

		await expectProblem(response, "limitExceeded");
		expect(await db.count(alerts, { where: { team_id: team.id } })).toBe(MAX_ALERTS_PER_TEAM);
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let response = await dispatch(db, post(null, emailAlertBody()));
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key missing the alerts:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:read"]);

		let response = await dispatch(db, post(key, emailAlertBody()));
		expect(response.status).toBe(403);
	});
});

describe("POST /api/v1/alerts with an Idempotency-Key", () => {
	/** A create carrying `idempotencyKey`, so a test can send the same one twice. */
	function idempotentCreate(key: string, idempotencyKey: string, body: unknown) {
		let request = post(key, body);
		request.headers.set("Idempotency-Key", idempotencyKey);
		return request;
	}

	test("a retry while the first request runs answers idempotency-key-in-use", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);

		await dispatch(db, idempotentCreate(key, '"in-flight"', emailAlertBody()));
		await markInFlight(db);
		let response = await dispatch(db, idempotentCreate(key, '"in-flight"', emailAlertBody()));

		expect(response.status).toBe(409);
		await expectProblem(response, "idempotencyKeyInUse");
		expect(await db.count(alerts, { where: { team_id: team.id } })).toBe(1);
	});

	test("reusing a key for a different body answers idempotency-key-reused", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);

		await dispatch(db, idempotentCreate(key, '"reuse"', emailAlertBody({ name: "A" })));
		let response = await dispatch(
			db,
			idempotentCreate(key, '"reuse"', emailAlertBody({ name: "B" })),
		);

		expect(response.status).toBe(422);
		await expectProblem(response, "idempotencyKeyReused");
		expect(await db.count(alerts, { where: { team_id: team.id } })).toBe(1);
	});

	test("an unquoted key answers idempotency-key-invalid and creates nothing", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);

		let response = await dispatch(db, idempotentCreate(key, "unquoted", emailAlertBody()));

		expect(response.status).toBe(400);
		await expectProblem(response, "idempotencyKeyInvalid");
		expect(await db.count(alerts, { where: { team_id: team.id } })).toBe(0);
	});
});
