/**
 * Tests the `/api/v1/alerts/:alertId` item endpoints: get/update/delete a single
 * alert scoped to the calling team, returning 404 for any other team's alert, and
 * its delivery-event history. Every action is guarded by `requireApiKey`, so each
 * test authenticates with a real bearer key minted through `ApiKey.create`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEnv } from "@sdxc/cloudflare-mocks";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { describe, expect, test, vi } from "vitest";

import type { ApiKeyScope } from "~/database/schema";

import ApiKey from "~/app/data/api-key";
import { database } from "~/app/http/middleware/database";
import { DEFAULT_COOLDOWN_MINUTES } from "~/app/lib/alert-policy";
import { createTestDatabase } from "~/app/lib/test/db";
import { useMailServerDns } from "~/app/lib/test/mail-servers";
import { checkConformance } from "~/app/lib/test/openapi";
import { parseLink } from "~/app/lib/test/paging";
import { expectProblem } from "~/app/lib/test/problem";
import { encodeId } from "~/app/services/typed-id";
import { alertEvents, alerts, teams } from "~/database/schema";
import { alertRoutes } from "~/routes/api-groups";

/** Checks every exchange against the API document; see `checkConformance`. */
const CONFORMANCE = checkConformance(alertRoutes);

/**
 * `~/app/data/monitor`, imported transitively for `monitorId` validation, reads `env`
 * from `cloudflare:workers` at module load, so this mock must resolve here too. The
 * endpoints touch no binding — the empty strict env would throw by name if they did.
 */
vi.doMock("cloudflare:workers", () => ({ env: createEnv<Env>({}) }));

let { default: models } = await import("~/app/http/middleware/models");
let { default: alertController } = await import("./alert");

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

async function createAlertRow(db: Db, teamId: string, overrides: Record<string, unknown> = {}) {
	return await db.create(
		alerts,
		{
			id: crypto.randomUUID(),
			team_id: teamId,
			monitor_id: null,
			name: "Site down",
			notify_on_recovery: true,
			cooldown_minutes: 0,
			config: { strategy: "email", config: { to: "ops@example.com", subjectPrefix: "" } },
			...overrides,
		},
		{ touch: true, returnRow: true },
	);
}

async function createAlertEventRow(db: Db, alertId: string, overrides: Record<string, unknown>) {
	return await db.create(
		alertEvents,
		{
			id: crypto.randomUUID(),
			alert_id: alertId,
			monitor_id: crypto.randomUUID(),
			event_type: "up",
			status: "sent",
			error_message: null,
			monitor_type: "http",
			monitor_name: "Example",
			snapshot: null,
			...overrides,
		},
		{ touch: true, returnRow: true },
	);
}

async function dispatch(db: Db, request: Request) {
	let router = createRouter({
		middleware: [CONFORMANCE, asyncContext(), database(() => db), models()],
	});
	router.map(alertRoutes, alertController);

	return router.fetch(request);
}

function req(method: string, href: string, key: string | null, body?: unknown): Request {
	return new Request(`https://uptime.test${href}`, {
		method,
		headers: {
			...(key ? { Authorization: `Bearer ${key}` } : {}),
			...(body !== undefined ? { "content-type": "application/json" } : {}),
		},
		body: body !== undefined ? JSON.stringify(body) : undefined,
	});
}

describe("GET /api/v1/alerts/:alertId", () => {
	test("returns the alert with sensitive config stripped", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:read"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("GET", alertRoutes.alertShow.href({ alertId: encodeId("alt", alert.id) }), key),
		);
		expect(response.status).toBe(200);

		let body = (await response.json()) as { data: { alert: { id: string; name: string } } };
		expect(body.data.alert.id).toBe(encodeId("alt", alert.id));
		expect(body.data.alert.name).toBe("Site down");
	});

	test("404s when the alert doesn't belong to the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:read"]);
		let alert = await createAlertRow(db, otherTeam.id);

		let response = await dispatch(
			db,
			req("GET", alertRoutes.alertShow.href({ alertId: encodeId("alt", alert.id) }), key),
		);
		expect(response.status).toBe(404);
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("GET", alertRoutes.alertShow.href({ alertId: encodeId("alt", alert.id) }), null),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key missing the alerts:read scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("GET", alertRoutes.alertShow.href({ alertId: encodeId("alt", alert.id) }), key),
		);
		expect(response.status).toBe(403);
	});
});

describe("PUT /api/v1/alerts/:alertId", () => {
	test("updates the alert's non-channel fields", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("PUT", alertRoutes.alertUpdate.href({ alertId: encodeId("alt", alert.id) }), key, {
				name: "Renamed",
				cooldownMinutes: 15,
			}),
		);
		expect(response.status).toBe(200);

		let updated = await db.findOne(alerts, { where: { id: alert.id } });
		expect(updated?.name).toBe("Renamed");
		expect(updated?.cooldown_minutes).toBe(15);
		expect(updated?.config).toEqual({
			strategy: "email",
			config: { to: "ops@example.com", subjectPrefix: "" },
		});
	});

	test("returns 400 when the payload fails validation", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("PUT", alertRoutes.alertUpdate.href({ alertId: encodeId("alt", alert.id) }), key, {
				name: "",
			}),
		);
		expect(response.status).toBe(400);

		await expectProblem(response, "validationError");

		let unchanged = await db.findOne(alerts, { where: { id: alert.id } });
		expect(unchanged?.name).toBe("Site down");
	});

	test("returns 404 when monitorId doesn't belong to the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("PUT", alertRoutes.alertUpdate.href({ alertId: encodeId("alt", alert.id) }), key, {
				monitorId: crypto.randomUUID(),
			}),
		);
		expect(response.status).toBe(404);
	});

	test("narrows an alert to a whole monitor type", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("PUT", alertRoutes.alertUpdate.href({ alertId: encodeId("alt", alert.id) }), key, {
				monitorType: "dns",
			}),
		);
		expect(response.status).toBe(200);

		let updated = await db.findOne(alerts, { where: { id: alert.id } });
		expect(updated?.monitor_type).toBe("dns");
		expect(updated?.monitor_id).toBeNull();
	});

	/** The pair moves together, so narrowing to a type alone resets the monitor id to keep the scope consistent. */
	test("clears a monitor id when the update names only a type", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id, {
			monitor_type: "http",
			monitor_id: crypto.randomUUID(),
		});

		await dispatch(
			db,
			req("PUT", alertRoutes.alertUpdate.href({ alertId: encodeId("alt", alert.id) }), key, {
				monitorType: "cron",
			}),
		);

		let updated = await db.findOne(alerts, { where: { id: alert.id } });
		expect(updated?.monitor_type).toBe("cron");
		expect(updated?.monitor_id).toBeNull();
	});

	/** `monitorId: null` was, and stays, how a client widens an alert back to team-wide. */
	test("a null monitorId clears the scope entirely", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id, {
			monitor_type: "dns",
			monitor_id: crypto.randomUUID(),
		});

		await dispatch(
			db,
			req("PUT", alertRoutes.alertUpdate.href({ alertId: encodeId("alt", alert.id) }), key, {
				monitorId: null,
			}),
		);

		let updated = await db.findOne(alerts, { where: { id: alert.id } });
		expect(updated?.monitor_type).toBeNull();
		expect(updated?.monitor_id).toBeNull();
	});

	test("leaves the scope untouched when the update mentions neither field", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let monitorId = crypto.randomUUID();
		let alert = await createAlertRow(db, team.id, { monitor_type: "dns", monitor_id: monitorId });

		await dispatch(
			db,
			req("PUT", alertRoutes.alertUpdate.href({ alertId: encodeId("alt", alert.id) }), key, {
				name: "Renamed",
			}),
		);

		let updated = await db.findOne(alerts, { where: { id: alert.id } });
		expect(updated?.monitor_type).toBe("dns");
		expect(updated?.monitor_id).toBe(monitorId);
	});

	test("404s when the alert doesn't belong to the team, without mutating it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, otherTeam.id);

		let response = await dispatch(
			db,
			req("PUT", alertRoutes.alertUpdate.href({ alertId: encodeId("alt", alert.id) }), key, {
				name: "Hijacked",
			}),
		);
		expect(response.status).toBe(404);

		let unchanged = await db.findOne(alerts, { where: { id: alert.id } });
		expect(unchanged?.name).toBe("Site down");
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("PUT", alertRoutes.alertUpdate.href({ alertId: encodeId("alt", alert.id) }), null, {
				name: "X",
			}),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key missing the alerts:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:read"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("PUT", alertRoutes.alertUpdate.href({ alertId: encodeId("alt", alert.id) }), key, {
				name: "X",
			}),
		);
		expect(response.status).toBe(403);
	});
});

describe("DELETE /api/v1/alerts/:alertId", () => {
	test("deletes the alert", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("DELETE", alertRoutes.alertDestroy.href({ alertId: encodeId("alt", alert.id) }), key),
		);
		expect(response.status).toBe(200);

		let body = (await response.json()) as { data: { deleted: boolean } };
		expect(body.data.deleted).toBe(true);
		expect(await db.findOne(alerts, { where: { id: alert.id } })).toBeNull();
	});

	test("404s when the alert doesn't belong to the team, without deleting it", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, otherTeam.id);

		let response = await dispatch(
			db,
			req("DELETE", alertRoutes.alertDestroy.href({ alertId: encodeId("alt", alert.id) }), key),
		);
		expect(response.status).toBe(404);
		expect(await db.findOne(alerts, { where: { id: alert.id } })).not.toBeNull();
	});

	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("DELETE", alertRoutes.alertDestroy.href({ alertId: encodeId("alt", alert.id) }), null),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key missing the alerts:write scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:read"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("DELETE", alertRoutes.alertDestroy.href({ alertId: encodeId("alt", alert.id) }), key),
		);
		expect(response.status).toBe(403);
	});
});

describe("GET /api/v1/alerts/:alertId/events", () => {
	test("lists the alert's delivery events, newest first", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:read"]);
		let alert = await createAlertRow(db, team.id);

		await createAlertEventRow(db, alert.id, { sent_at: Date.now() - 1000, event_type: "down" });
		let newer = await createAlertEventRow(db, alert.id, { sent_at: Date.now() });

		let response = await dispatch(
			db,
			req("GET", alertRoutes.alertEvents.href({ alertId: encodeId("alt", alert.id) }), key),
		);
		expect(response.status).toBe(200);

		let body = (await response.json()) as { data: { events: Array<{ id: string }> } };
		expect(body.data.events).toHaveLength(2);
		expect(body.data.events[0]?.id).toBe(encodeId("evt", newer.id));
	});

	test("serves one page and a cursor that walks to the next", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:read"]);
		let alert = await createAlertRow(db, team.id);

		await createAlertEventRow(db, alert.id, { sent_at: Date.now() - 1000, event_type: "down" });
		await createAlertEventRow(db, alert.id, { sent_at: Date.now() });

		let path = alertRoutes.alertEvents.href({ alertId: encodeId("alt", alert.id) });
		let response = await dispatch(db, req("GET", `${path}?perPage=1`, key));
		expect(response.status).toBe(200);

		let body = (await response.json()) as { data: { events: Array<{ id: string }> } };
		expect(body.data.events).toHaveLength(1);

		// Navigation rides in the headers now, so following the feed means following `Link`.
		let next = parseLink(response.headers.get("Link"));
		expect(next).not.toBeNull();

		let second = await dispatch(db, req("GET", next as string, key));
		expect(second.status).toBe(200);

		let secondBody = (await second.json()) as { data: { events: Array<{ id: string }> } };
		expect(secondBody.data.events).toHaveLength(1);
		// The second page is a different row, which is the whole point of seeking.
		expect(secondBody.data.events[0]?.id).not.toBe(body.data.events[0]?.id);
	});

	test("rejects a malformed cursor as a bad request", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:read"]);
		let alert = await createAlertRow(db, team.id);

		let path = alertRoutes.alertEvents.href({ alertId: encodeId("alt", alert.id) });
		let response = await dispatch(db, req("GET", `${path}?cursor=not-a-cursor`, key));
		expect(response.status).toBe(400);

		await expectProblem(response, "badRequest");
	});

	test("404s when the alert doesn't belong to the team", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:read"]);
		let alert = await createAlertRow(db, otherTeam.id);

		let response = await dispatch(
			db,
			req("GET", alertRoutes.alertEvents.href({ alertId: encodeId("alt", alert.id) }), key),
		);
		expect(response.status).toBe(404);
	});
});

describe("GET /api/v1/alerts/:alertId/events authentication", () => {
	test("returns 401 for a missing Authorization header", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("GET", alertRoutes.alertEvents.href({ alertId: encodeId("alt", alert.id) }), null),
		);
		expect(response.status).toBe(401);
	});

	test("returns 403 for a key missing the alerts:read scope", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["monitors:read"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req("GET", alertRoutes.alertEvents.href({ alertId: encodeId("alt", alert.id) }), key),
		);
		expect(response.status).toBe(403);
	});
});

describe("malformed alert ids", () => {
	test.each([
		["GET", "alertShow", "alerts:read"],
		["PUT", "alertUpdate", "alerts:write"],
		["DELETE", "alertDestroy", "alerts:write"],
		["GET", "alertEvents", "alerts:read"],
	] as const)("%s %s answers validation-error for a raw UUID", async (method, name, scope) => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, [scope]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			req(
				method,
				alertRoutes[name].href({ alertId: alert.id }),
				key,
				method === "PUT" ? {} : undefined,
			),
		);

		expect(response.status).toBe(400);
		await expectProblem(response, "validationError");
	});
});

describe("PATCH /api/v1/alerts/:alertId", () => {
	/** A merge patch request, sent as `application/merge-patch+json` unless told otherwise. */
	function mergePatch(
		alertId: string,
		body: unknown,
		options: { key?: string; contentType?: string } = {},
	) {
		let headers: Record<string, string> = {
			"content-type": options.contentType ?? "application/merge-patch+json",
		};
		if (options.key) headers.Authorization = `Bearer ${options.key}`;
		return new Request(
			`https://uptime.test${alertRoutes.alertPatch.href({ alertId: encodeId("alt", alertId) })}`,
			{ method: "PATCH", headers, body: JSON.stringify(body) },
		);
	}

	test("changes only the members the patch names", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let monitorId = crypto.randomUUID();
		let alert = await createAlertRow(db, team.id, {
			cooldown_minutes: 30,
			monitor_type: "dns",
			monitor_id: monitorId,
		});

		let response = await dispatch(db, mergePatch(alert.id, { name: "Patched" }, { key }));

		expect(response.status).toBe(200);
		let updated = await db.findOne(alerts, { where: { id: alert.id } });
		expect(updated?.name).toBe("Patched");
		expect(updated?.cooldown_minutes).toBe(30);
		expect(updated?.monitor_type).toBe("dns");
		expect(updated?.monitor_id).toBe(monitorId);
		expect(updated?.config).toEqual(alert.config);
	});

	test("null resets defaulted members", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id, {
			notify_on_recovery: false,
			cooldown_minutes: 30,
		});

		let response = await dispatch(
			db,
			mergePatch(alert.id, { notifyOnRecovery: null, cooldownMinutes: null }, { key }),
		);

		expect(response.status).toBe(200);
		let updated = await db.findOne(alerts, { where: { id: alert.id } });
		expect(updated?.notify_on_recovery).toBe(true);
		expect(updated?.cooldown_minutes).toBe(DEFAULT_COOLDOWN_MINUTES);
	});

	test("patches one channel setting and keeps the others", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id, {
			config: { strategy: "email", config: { to: "ops@example.com", subjectPrefix: "[prod]" } },
		});

		let response = await dispatch(
			db,
			mergePatch(alert.id, { email: "oncall@example.com" }, { key }),
		);

		expect(response.status).toBe(200);
		let updated = await db.findOne(alerts, { where: { id: alert.id } });
		expect(updated?.config).toEqual({
			strategy: "email",
			config: { to: "oncall@example.com", subjectPrefix: "[prod]" },
		});
	});

	test("refuses a patched recipient whose domain receives no mail, keeping the alert", async () => {
		dns.answer("nomail.example", "no-mail-server");
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id, {
			config: { strategy: "email", config: { to: "ops@example.com", subjectPrefix: "" } },
		});

		let response = await dispatch(
			db,
			mergePatch(alert.id, { email: "oncall@nomail.example" }, { key }),
		);

		expect(response.status).toBe(400);
		await expectProblem(response, "validationError");
		let unchanged = await db.findOne(alerts, { where: { id: alert.id } });
		expect(unchanged?.config).toEqual({
			strategy: "email",
			config: { to: "ops@example.com", subjectPrefix: "" },
		});
	});

	test("looks up no mail server for a patch that leaves the recipient alone", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id, {
			config: { strategy: "email", config: { to: "ops@example.com", subjectPrefix: "" } },
		});

		let response = await dispatch(db, mergePatch(alert.id, { name: "Renamed" }, { key }));

		expect(response.status).toBe(200);
		expect(dns.asked).toEqual([]);
	});

	test("null clears an optional channel setting", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id, {
			config: { strategy: "webhook", config: { url: "https://example.com/hook", secret: "shh" } },
		});

		let response = await dispatch(db, mergePatch(alert.id, { secret: null }, { key }));

		expect(response.status).toBe(200);
		let updated = await db.findOne(alerts, { where: { id: alert.id } });
		expect(updated?.config).toEqual({
			strategy: "webhook",
			config: { url: "https://example.com/hook", secret: "" },
		});
	});

	test("saving a slack row that still carries a channel stores only its webhook URL", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		/** A row saved with the former channel override keeps it in its stored JSON. */
		let legacy = {
			strategy: "slack" as const,
			config: { webhookUrl: "https://hooks.slack.com/services/T000/B000/XXXX", channel: "#ops" },
		};
		let alert = await createAlertRow(db, team.id, { config: legacy });

		let response = await dispatch(
			db,
			mergePatch(
				alert.id,
				{ webhookUrl: "https://hooks.slack.com/services/T000/B000/YYYY" },
				{ key },
			),
		);

		expect(response.status).toBe(200);
		let updated = await db.findOne(alerts, { where: { id: alert.id } });
		expect(updated?.config).toEqual({
			strategy: "slack",
			config: { webhookUrl: "https://hooks.slack.com/services/T000/B000/YYYY" },
		});
	});

	test("switches to pagerduty with its integration key", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			mergePatch(
				alert.id,
				{ strategy: "pagerduty", routingKey: "0123456789abcdef0123456789abcdef" },
				{ key },
			),
		);

		expect(response.status).toBe(200);
		let body = await response.json();
		expect(JSON.stringify(body)).not.toContain("0123456789abcdef0123456789abcdef");
		let updated = await db.findOne(alerts, { where: { id: alert.id } });
		expect(updated?.config).toEqual({
			strategy: "pagerduty",
			config: { routingKey: "0123456789abcdef0123456789abcdef" },
		});
	});

	test("refuses a discord webhook URL on another host at its pointer", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			mergePatch(
				alert.id,
				{ strategy: "discord", webhookUrl: "https://discord.example/api/webhooks/123/abc" },
				{ key },
			),
		);

		expect(response.status).toBe(400);
		let problem = await expectProblem(response, "validationError");
		expect(problem.extensions.errors.map((issue) => issue.pointer)).toEqual(["/webhookUrl"]);
		let unchanged = await db.findOne(alerts, { where: { id: alert.id } });
		expect(unchanged?.config).toEqual(alert.config);
	});

	test("switches strategy when the patch carries the new strategy's settings", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			mergePatch(
				alert.id,
				{ strategy: "discord", webhookUrl: "https://discord.com/api/webhooks/123/abc" },
				{ key },
			),
		);

		expect(response.status).toBe(200);
		let updated = await db.findOne(alerts, { where: { id: alert.id } });
		expect(updated?.config).toEqual({
			strategy: "discord",
			config: { webhookUrl: "https://discord.com/api/webhooks/123/abc" },
		});
	});

	test("switching strategy without its settings answers validation-error", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(db, mergePatch(alert.id, { strategy: "slack" }, { key }));

		expect(response.status).toBe(400);
		let problem = await expectProblem(response, "validationError");
		expect(problem.extensions.errors.map((issue) => issue.pointer)).toEqual(["/webhookUrl"]);
		let unchanged = await db.findOne(alerts, { where: { id: alert.id } });
		expect(unchanged?.config).toEqual(alert.config);
	});

	test("null on a required member answers validation-error at its pointer", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(db, mergePatch(alert.id, { name: null }, { key }));

		expect(response.status).toBe(400);
		let problem = await expectProblem(response, "validationError");
		expect(problem.extensions.errors.map((issue) => issue.pointer)).toEqual(["/name"]);
	});

	test("null monitorType widens the alert to every monitor", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id, { monitor_type: "dns", monitor_id: null });

		let response = await dispatch(db, mergePatch(alert.id, { monitorType: null }, { key }));

		expect(response.status).toBe(200);
		let updated = await db.findOne(alerts, { where: { id: alert.id } });
		expect(updated?.monitor_type).toBeNull();
		expect(updated?.monitor_id).toBeNull();
	});

	test("accepts application/json as a merge patch", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			mergePatch(alert.id, { name: "Json" }, { key, contentType: "application/json" }),
		);

		expect(response.status).toBe(200);
		let updated = await db.findOne(alerts, { where: { id: alert.id } });
		expect(updated?.name).toBe("Json");
	});

	test("answers unsupported-media-type with Accept-Patch for any other body", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id);

		let response = await dispatch(
			db,
			mergePatch(alert.id, { name: "x" }, { key, contentType: "text/plain" }),
		);

		expect(response.status).toBe(415);
		expect(response.headers.get("Accept-Patch")).toBe("application/merge-patch+json");
		await expectProblem(response, "unsupportedMediaType");
	});

	test("PUT keeps ignoring channel settings and refusing null", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let key = await createApiKey(db, team.id, ["alerts:write"]);
		let alert = await createAlertRow(db, team.id, { cooldown_minutes: 30 });
		let href = alertRoutes.alertUpdate.href({ alertId: encodeId("alt", alert.id) });

		let ignored = await dispatch(
			db,
			req("PUT", href, key, { name: "Put", email: "oncall@example.com" }),
		);
		let refused = await dispatch(db, req("PUT", href, key, { cooldownMinutes: null }));

		expect(ignored.status).toBe(200);
		expect(refused.status).toBe(400);
		await expectProblem(refused, "validationError");
		let updated = await db.findOne(alerts, { where: { id: alert.id } });
		expect(updated?.name).toBe("Put");
		expect(updated?.config).toEqual(alert.config);
		expect(updated?.cooldown_minutes).toBe(30);
	});

	test("404s for another team's alert, 401 without a key, 403 without alerts:write", async () => {
		let { db } = createTestDatabase();
		let team = await createTeamRow(db);
		let otherTeam = await createTeamRow(db);
		let writer = await createApiKey(db, team.id, ["alerts:write"]);
		let reader = await createApiKey(db, team.id, ["alerts:read"]);
		let foreign = await createAlertRow(db, otherTeam.id);
		let own = await createAlertRow(db, team.id);

		let notFound = await dispatch(db, mergePatch(foreign.id, { name: "x" }, { key: writer }));
		let unauthorized = await dispatch(db, mergePatch(own.id, { name: "x" }));
		let forbidden = await dispatch(db, mergePatch(own.id, { name: "x" }, { key: reader }));

		expect([notFound.status, unauthorized.status, forbidden.status]).toEqual([404, 401, 403]);
	});
});
