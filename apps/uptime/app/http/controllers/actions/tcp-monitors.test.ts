/**
 * Tests for the TCP monitor create/update/delete/check actions. `cloudflare:sockets`
 * is stubbed (its `connect()` never touches the network) so `checkTcpMonitor`'s
 * on-demand check can run under `bun test`; the other three actions don't reach that
 * code path but still transitively import it, so the stub applies to the whole file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import type { Middleware, RequestHandler } from "remix/fetch-router";
import type { Route } from "remix/fetch-router/routes";

import { MemoryTransport } from "@pkg/mail/memory";
import mail from "@pkg/mail/middleware";
import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";

import type { SelectMembership, SelectTeam } from "~/database/schema";

import { MAIL_FROM } from "~/app/emails/sender";
import { createTestDatabase } from "~/app/lib/test/db";
import { memberships, tcpMonitorResults, tcpMonitors, teams } from "~/database/schema";
import routes from "~/routes/web";

/**
 * The controller (via `app/services/tcp-check.ts`) statically imports `cloudflare:sockets`,
 * which doesn't exist under `bun test`; stub it so every test in this file — not just
 * `checkTcpMonitor` — can load the module graph.
 */
mock.module("cloudflare:sockets", () => ({
	connect: mock(() => ({
		opened: Promise.resolve(),
		close: mock(async () => {}),
	})),
}));

/**
 * `@pkg/validate`'s `validate()` flattens `FormData`/`URLSearchParams` into a plain
 * object before handing it to the schema, but `remix/data-schema/form-data`'s
 * `f.object()` (which every schema in this app is built with) validates the raw
 * `FormData`/`URLSearchParams` directly and rejects a flattened object with "Expected
 * FormData or URLSearchParams". As shipped, that means `validate(ctx.formData, ...)`
 * always fails, regardless of whether the submitted data is actually valid — a real,
 * reproducible bug in the shared `@pkg/validate` package (flagged separately). This
 * mock forwards the form container straight to the schema instead of flattening it,
 * so these tests exercise the actions' real branching instead of always hitting the
 * validation-error path; it can be deleted once the real `@pkg/validate` is fixed.
 */
let { checkTcpMonitor, createTcpMonitor, deleteTcpMonitor, updateTcpMonitor } =
	await import("./tcp-monitors");

/** Creates an in-memory database seeded with one team and a member's membership. */
async function createFixture() {
	let { db } = createTestDatabase();

	let team = await db.create(
		teams,
		{ id: crypto.randomUUID(), owner_id: "owner-1", name: "Acme", slug: "acme", logo: null },
		{ touch: true, returnRow: true },
	);
	let membership = await db.create(
		memberships,
		{ id: crypto.randomUUID(), subject_id: "member-1", team_id: team.id, role: "member" },
		{ touch: true, returnRow: true },
	);

	return { db, team, membership };
}

/** Middleware that seeds `ctx.team`/`ctx.membership` in place of `requireTeam`. */
function seedTeam(team: SelectTeam, membership: SelectMembership): Middleware {
	return (ctx, next) => {
		ctx.team = team;
		ctx.membership = membership;
		return next();
	};
}

/** Sends a form request through a minimal router mapping a single action route. */
async function send(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	route: Route,
	handler: RequestHandler<any>,
	method: string,
	params: Record<string, string>,
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [
			asyncContext(),
			formData() as Middleware,
			mail({ transport: new MemoryTransport(), from: MAIL_FROM }),
		],
	});
	router.map(route, { middleware: [seedTeam(team, membership)], handler });

	let request = new Request(new URL(route.href({ team: team.slug }), "https://uptime.test"), {
		method,
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(params).toString(),
	});

	return container.scope(() => router.fetch(request));
}

describe("createTcpMonitor", () => {
	test("creates a monitor and redirects to its detail page", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.tcp.create,
			createTcpMonitor as RequestHandler<any>,
			"POST",
			{ name: "Redis", host: "redis.internal", port: "6379" },
		);

		expect(response.status).toBe(303);

		let created = await db.findOne(tcpMonitors, { where: { team_id: team.id } });
		expect(created).not.toBeNull();
		expect(created?.name).toBe("Redis");
		expect(response.headers.get("Location")).toBe(
			routes.app.team.tcpMonitors.show.href({ team: team.slug, monitorId: created!.id }),
		);
	});

	test("redirects back to the form without creating a monitor when the port is invalid", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.tcp.create,
			createTcpMonitor as RequestHandler<any>,
			"POST",
			{ name: "Redis", host: "redis.internal", port: "999999" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.tcpMonitors.new.href({ team: team.slug }),
		);

		let matching = await db.findMany(tcpMonitors, { where: { team_id: team.id } });
		expect(matching).toHaveLength(0);
	});
});

describe("updateTcpMonitor", () => {
	test("updates the monitor's fields and redirects to its detail page", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			tcpMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Original",
				host: "old.internal",
				port: 22,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.tcp.update,
			updateTcpMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: monitor.id, name: "Renamed", host: "new.internal", port: "2222" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.tcpMonitors.show.href({ team: team.slug, monitorId: monitor.id }),
		);

		let updated = await db.findOne(tcpMonitors, { where: { id: monitor.id } });
		expect(updated?.name).toBe("Renamed");
		expect(updated?.host).toBe("new.internal");
	});

	test("responds 404 for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.tcp.update,
			updateTcpMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: crypto.randomUUID(), name: "Renamed", host: "new.internal", port: "2222" },
		);

		expect(response.status).toBe(404);
	});
});

describe("deleteTcpMonitor", () => {
	test("deletes the monitor and its result history, then redirects to the list", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			tcpMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "To delete",
				host: "old.internal",
				port: 22,
			},
			{ touch: true, returnRow: true },
		);
		await db.create(tcpMonitorResults, {
			id: crypto.randomUUID(),
			tcp_monitor_id: monitor.id,
			status: "up",
			response_time_ms: 10,
			error_message: null,
			checked_at: Date.now(),
		});

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.tcp.delete,
			deleteTcpMonitor as RequestHandler<any>,
			"DELETE",
			{ monitor_id: monitor.id },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.tcpMonitors.index.href({ team: team.slug }),
		);

		expect(await db.findOne(tcpMonitors, { where: { id: monitor.id } })).toBeNull();
		let results = await db.findMany(tcpMonitorResults, { where: { tcp_monitor_id: monitor.id } });
		expect(results).toHaveLength(0);
	});

	test("responds 404 for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.tcp.delete,
			deleteTcpMonitor as RequestHandler<any>,
			"DELETE",
			{ monitor_id: crypto.randomUUID() },
		);

		expect(response.status).toBe(404);
	});
});

describe("checkTcpMonitor", () => {
	test("records an up result and redirects to the monitor's detail page", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			tcpMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Redis",
				host: "redis.internal",
				port: 6379,
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.tcp.check,
			checkTcpMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: monitor.id },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.tcpMonitors.show.href({ team: team.slug, monitorId: monitor.id }),
		);

		let updated = await db.findOne(tcpMonitors, { where: { id: monitor.id } });
		expect(updated?.last_status).toBe("up");
		expect(updated?.last_checked_at).not.toBeNull();

		let results = await db.findMany(tcpMonitorResults, { where: { tcp_monitor_id: monitor.id } });
		expect(results).toHaveLength(1);
		expect(results[0]?.status).toBe("up");
	});

	test("responds 404 for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.actions.monitor.tcp.check,
			checkTcpMonitor as RequestHandler<any>,
			"POST",
			{ monitor_id: crypto.randomUUID() },
		);

		expect(response.status).toBe(404);
	});
});
