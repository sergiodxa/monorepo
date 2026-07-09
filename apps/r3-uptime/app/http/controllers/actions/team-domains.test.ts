/**
 * Tests for the add/remove/retry-verification team-domain actions. `cloudflare:workers`
 * is mocked so `waitUntil(env.QUEUE.send(...))` — fired for every add and every retry
 * of an unverified domain — never touches a real queue binding.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import type { Middleware, RequestHandler } from "remix/fetch-router";
import type { Route } from "remix/fetch-router/routes";

import { failure, success } from "@pkg/result";
import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";

import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { memberships, teamDomains, teams } from "~/database/schema";
import routes from "~/routes/web";

let queueSend = mock(async () => {});

mock.module("cloudflare:workers", () => ({
	env: { QUEUE: { send: queueSend } },
	waitUntil: (promise: Promise<unknown>) => promise,
}));

// `@pkg/validate`'s `validate()` flattens `FormData`/`URLSearchParams` into a plain
// object before handing it to the schema, but `remix/data-schema/form-data`'s
// `f.object()` (which every schema in this app is built with) validates the raw
// `FormData`/`URLSearchParams` directly and rejects a flattened object with "Expected
// FormData or URLSearchParams". As shipped, that means `validate(ctx.formData, ...)`
// always fails, regardless of whether the submitted data is actually valid — a real,
// reproducible bug in the shared `@pkg/validate` package (flagged separately). This
// mock forwards the form container straight to the schema instead of flattening it,
// so these tests exercise the actions' real branching instead of always hitting the
// validation-error path; it can be deleted once the real `@pkg/validate` is fixed.
mock.module("@pkg/validate", () => ({
	async validate(
		input: unknown,
		schema: { "~standard": { validate: (value: unknown) => unknown } },
	) {
		let result = (await schema["~standard"].validate(input)) as
			| { issues: Array<{ message: string }> }
			| { value: unknown };

		if ("issues" in result && result.issues) {
			let error = new Error(result.issues[0]?.message ?? "Validation failed") as Error & {
				issues: Array<{ message: string }>;
			};
			error.issues = result.issues;
			return failure(error);
		}

		return success((result as { value: unknown }).value);
	},
}));

let { addDomain, removeDomain, retryDomainVerification } = await import("./team-domains");

/** Creates an in-memory database seeded with one team and an admin membership. */
async function createFixture() {
	let { db } = createTestDatabase();

	let team = await db.create(
		teams,
		{ id: crypto.randomUUID(), owner_id: "owner-1", name: "Acme", slug: "acme", logo: null },
		{ touch: true, returnRow: true },
	);
	let membership = await db.create(
		memberships,
		{ id: crypto.randomUUID(), subject_id: "owner-1", team_id: team.id, role: "admin" },
		{ touch: true, returnRow: true },
	);

	return { db, team, membership };
}

/** Middleware that seeds `ctx.team`/`ctx.membership` in place of `requireTeam`/`requireRole`. */
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

	let router = createRouter({ middleware: [asyncContext(), formData() as Middleware] });
	router.map(route, { middleware: [seedTeam(team, membership)], handler });

	let request = new Request(new URL(route.href({ team: team.slug }), "https://uptime.test"), {
		method,
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(params).toString(),
	});

	return container.scope(() => router.fetch(request));
}

describe("addDomain", () => {
	test("creates a pending domain, enqueues verification, and redirects to team settings", async () => {
		let { db, team, membership } = await createFixture();
		queueSend.mockClear();

		let response = await send(
			db,
			team,
			membership,
			routes.teamAdminActions.addDomain,
			addDomain as RequestHandler<any>,
			"POST",
			{ hostname: "example.com" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.settings.href({ team: team.slug }),
		);

		let domain = await db.findOne(teamDomains, {
			where: { team_id: team.id, hostname: "example.com" },
		});
		expect(domain).not.toBeNull();
		expect(domain?.verified_at).toBeNull();
		expect(queueSend).toHaveBeenCalledTimes(1);
	});

	test("rejects a hostname already verified for the team without creating a duplicate", async () => {
		let { db, team, membership } = await createFixture();
		queueSend.mockClear();

		await db.create(
			teamDomains,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				hostname: "verified.com",
				verified_at: Date.now(),
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			routes.teamAdminActions.addDomain,
			addDomain as RequestHandler<any>,
			"POST",
			{ hostname: "verified.com" },
		);

		expect(response.status).toBe(400);
		expect(await response.text()).toContain("already verified");

		let matching = await db.findMany(teamDomains, {
			where: { team_id: team.id, hostname: "verified.com" },
		});
		expect(matching).toHaveLength(1);
		expect(queueSend).not.toHaveBeenCalled();
	});

	test("redirects back without creating a domain when the hostname is empty", async () => {
		let { db, team, membership } = await createFixture();
		queueSend.mockClear();

		let response = await send(
			db,
			team,
			membership,
			routes.teamAdminActions.addDomain,
			addDomain as RequestHandler<any>,
			"POST",
			{ hostname: "" },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.settings.href({ team: team.slug }),
		);

		let matching = await db.findMany(teamDomains, { where: { team_id: team.id } });
		expect(matching).toHaveLength(0);
		expect(queueSend).not.toHaveBeenCalled();
	});
});

describe("removeDomain", () => {
	test("deletes the domain and redirects to team settings", async () => {
		let { db, team, membership } = await createFixture();
		let domain = await db.create(
			teamDomains,
			{ id: crypto.randomUUID(), team_id: team.id, hostname: "remove-me.com", verified_at: null },
			{ touch: true, returnRow: true },
		);

		let response = await send(
			db,
			team,
			membership,
			routes.teamAdminActions.removeDomain,
			removeDomain as RequestHandler<any>,
			"DELETE",
			{ domain_id: domain.id },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.settings.href({ team: team.slug }),
		);

		expect(await db.findOne(teamDomains, { where: { id: domain.id } })).toBeNull();
	});

	test("responds 404 for a domain that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.teamAdminActions.removeDomain,
			removeDomain as RequestHandler<any>,
			"DELETE",
			{ domain_id: crypto.randomUUID() },
		);

		expect(response.status).toBe(404);
	});
});

describe("retryDomainVerification", () => {
	test("re-enqueues verification for an unverified domain and redirects to team settings", async () => {
		let { db, team, membership } = await createFixture();
		let domain = await db.create(
			teamDomains,
			{ id: crypto.randomUUID(), team_id: team.id, hostname: "pending.com", verified_at: null },
			{ touch: true, returnRow: true },
		);
		queueSend.mockClear();

		let response = await send(
			db,
			team,
			membership,
			routes.teamAdminActions.retryDomainVerification,
			retryDomainVerification as RequestHandler<any>,
			"POST",
			{ domain_id: domain.id },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.settings.href({ team: team.slug }),
		);
		expect(queueSend).toHaveBeenCalledTimes(1);
	});

	test("does not re-enqueue an already-verified domain", async () => {
		let { db, team, membership } = await createFixture();
		let domain = await db.create(
			teamDomains,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				hostname: "verified.com",
				verified_at: Date.now(),
			},
			{ touch: true, returnRow: true },
		);
		queueSend.mockClear();

		let response = await send(
			db,
			team,
			membership,
			routes.teamAdminActions.retryDomainVerification,
			retryDomainVerification as RequestHandler<any>,
			"POST",
			{ domain_id: domain.id },
		);

		expect(response.status).toBe(303);
		expect(queueSend).not.toHaveBeenCalled();
	});

	test("responds 404 for a domain that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.teamAdminActions.retryDomainVerification,
			retryDomainVerification as RequestHandler<any>,
			"POST",
			{ domain_id: crypto.randomUUID() },
		);

		expect(response.status).toBe(404);
	});
});
