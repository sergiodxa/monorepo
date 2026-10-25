/**
 * Tests for the `update-ssl` action: a typed expiry date is the override and is classified
 * at once, an empty one reads from Certificate Transparency and queues a lookup, disabling
 * monitoring resets the status, an invalid submission changes nothing, and a stranger 404s.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { QueueMock } from "@sdxc/cloudflare-mocks";
import type { Database } from "remix/data-table";
import type { Middleware, RequestHandler } from "remix/router";

import { createEnv, createQueue } from "@sdxc/cloudflare-mocks";
import { database } from "@sdxc/database-middleware";
import { jobEnqueuer } from "@sdxc/jobs/router";
import { unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/test/db";
import { memberships, monitors, teams } from "~/database/schema";
import routes from "~/routes/web";

/** The only message this action enqueues: a log lookup for one monitor. */
interface CheckCertificateMessage {
	job: "checkCertificate";
	body: { monitorId: string };
}

/**
 * The queue lookups land on, at module scope because the action captures `env` on import.
 * Only the queue is supplied, so reading any other binding throws by name.
 */
let queue: QueueMock<CheckCertificateMessage> = createQueue<CheckCertificateMessage>();

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({ QUEUE: queue }),
	waitUntil: (promise: Promise<unknown>) => promise,
}));

beforeEach(() => {
	queue.reset();
});

let { default: models } = await import("~/app/http/middleware/models");
let { jobQueue } = await import("~/app/initializers/queue");
let { updateSsl } = await import("./ssl");
let { bindModels } = await import("~/app/test/models");

/** Creates an in-memory database seeded with one team, a membership, and a monitor. */
async function createFixture() {
	let { db } = createTestDatabase();

	let team = await db.create(
		teams,
		{ id: generateUUID(), owner_id: "owner-1", name: "Acme", slug: "acme", logo: null },
		{ touch: true, returnRow: true },
	);
	let membership = await db.create(
		memberships,
		{ id: generateUUID(), subject_id: "member-1", team_id: team.id, role: "member" },
		{ touch: true, returnRow: true },
	);
	let monitor = unwrap(
		await bindModels(db).monitors.create({
			id: generateUUID(),
			team_id: team.id,
			author_id: "member-1",
			enabled_at: Date.now(),
			name: "Homepage",
			url: "https://example.com",
		}),
	);

	return { db, team, membership, monitor };
}

/** Middleware that seeds `ctx.team`/`ctx.membership` in place of `requireTeam`. */
function seedTeam(team: SelectTeam, membership: SelectMembership): Middleware {
	return (ctx, next) => {
		ctx.team = team;
		ctx.membership = membership;
		return next();
	};
}

/** Sends a form request through a minimal router mapping the `update-ssl` action. */
async function send(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	params: Record<string, string>,
): Promise<Response> {
	let router = createRouter({
		middleware: [
			asyncContext(),
			database(db),
			jobEnqueuer(jobQueue),
			models(),
			formData() as Middleware,
		],
	});
	router.map(routes.actions.monitor.http.updateSsl, {
		middleware: [seedTeam(team, membership)],
		handler: updateSsl as RequestHandler<any>,
	});

	let request = new Request(
		new URL(routes.actions.monitor.http.updateSsl.href({ team: team.slug }), "https://uptime.test"),
		{
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams(params).toString(),
		},
	);

	return router.fetch(request);
}

describe("updateSsl", () => {
	test("saves the expiry, classifies it as valid, and redirects to the monitor's edit page", async () => {
		let { db, team, membership, monitor } = await createFixture();

		let farExpiry = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

		let response = await send(db, team, membership, {
			monitor_id: monitor.id,
			ssl_monitoring_enabled: "true",
			ssl_expiry_warning_days: "30",
			ssl_expires_at: farExpiry,
			ssl_issuer: "Let's Encrypt",
		});

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.monitors.edit.href({ team: team.slug, monitorId: monitor.id }),
		);

		let updated = await db.findOne(monitors, { where: { id: monitor.id } });
		expect(updated?.ssl_monitoring_enabled).toBeTruthy();
		expect(updated?.ssl_status).toBe("valid");
		expect(updated?.ssl_issuer).toBe("Let's Encrypt");
		expect(updated?.ssl_expiry_source).toBe("manual");
		expect(updated?.ssl_last_checked_at).not.toBeNull();
		expect(queue.sent).toEqual([]);
	});

	test("reads the expiry from the logs when no date is typed, and queues a lookup", async () => {
		let { db, team, membership, monitor } = await createFixture();

		let response = await send(db, team, membership, {
			monitor_id: monitor.id,
			ssl_monitoring_enabled: "true",
			ssl_expiry_warning_days: "30",
			ssl_expires_at: "",
		});

		expect(response.status).toBe(303);
		let updated = await db.findOne(monitors, { where: { id: monitor.id } });
		expect(updated?.ssl_expiry_source).toBe("transparency");
		expect(updated?.ssl_expires_at).toBeNull();
		expect(queue.sent.map((message) => message.body)).toEqual([
			{ job: "checkCertificate", body: { monitorId: monitor.id } },
		]);
	});

	test("drops a typed date when the monitor switches to the logs", async () => {
		let { db, team, membership, monitor } = await createFixture();
		await bindModels(db).monitors.update(monitor.id, {
			ssl_expiry_source: "manual",
			ssl_expires_at: Date.now() + 5 * 24 * 60 * 60 * 1000,
			ssl_issuer: "Typed CA",
		});

		await send(db, team, membership, {
			monitor_id: monitor.id,
			ssl_monitoring_enabled: "true",
			ssl_expiry_warning_days: "30",
		});

		let updated = await db.findOne(monitors, { where: { id: monitor.id } });
		expect(updated?.ssl_expiry_source).toBe("transparency");
		expect(updated?.ssl_expires_at).toBeNull();
		expect(updated?.ssl_issuer).toBeNull();
	});

	test("keeps the certificate the logs found when saved again without a date", async () => {
		let { db, team, membership, monitor } = await createFixture();
		let notAfter = Date.now() + 60 * 24 * 60 * 60 * 1000;
		await bindModels(db).monitors.update(monitor.id, {
			ssl_expiry_source: "transparency",
			ssl_expires_at: notAfter,
			ssl_issuer: "Let's Encrypt",
			ssl_transparency_status: "found",
		});

		await send(db, team, membership, {
			monitor_id: monitor.id,
			ssl_monitoring_enabled: "true",
			ssl_expiry_warning_days: "14",
		});

		let updated = await db.findOne(monitors, { where: { id: monitor.id } });
		expect(updated?.ssl_expires_at).toBe(notAfter);
		expect(updated?.ssl_issuer).toBe("Let's Encrypt");
		expect(updated?.ssl_transparency_status).toBe("found");
		expect(updated?.ssl_status).toBe("valid");
	});

	test("resets the status to unknown when monitoring is disabled", async () => {
		let { db, team, membership, monitor } = await createFixture();

		let response = await send(db, team, membership, {
			monitor_id: monitor.id,
			ssl_monitoring_enabled: "false",
		});

		expect(response.status).toBe(303);

		let updated = await db.findOne(monitors, { where: { id: monitor.id } });
		expect(updated?.ssl_monitoring_enabled).toBeFalsy();
		expect(updated?.ssl_status).toBe("unknown");
		expect(updated?.ssl_last_checked_at).toBeNull();
	});

	test("responds 404 for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership, {
			monitor_id: generateUUID(),
			ssl_monitoring_enabled: "true",
		});

		expect(response.status).toBe(404);
	});

	test("redirects back to the dashboard without mutating when monitor_id is missing", async () => {
		let { db, team, membership, monitor } = await createFixture();

		let response = await send(db, team, membership, { ssl_monitoring_enabled: "true" });

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.dashboard.index.href({ team: team.slug }),
		);

		let unchanged = await db.findOne(monitors, { where: { id: monitor.id } });
		expect(unchanged?.ssl_monitoring_enabled).toBeFalsy();
	});
});
