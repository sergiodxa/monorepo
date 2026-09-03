/**
 * Tests for the add/remove/retry-verification team-domain actions. The `QUEUE` binding is
 * an in-memory queue installed through `cloudflare:workers`, so `waitUntil(QUEUE.send(...))`
 * — fired for every add and every retry of an unverified domain — is asserted on the
 * message that really landed rather than on the fact a function was called.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { QueueMock } from "@sdxc/cloudflare-mocks";
import type { Middleware, RequestHandler } from "remix/router";
import type { Route } from "remix/routes";

import { createEnv, createQueue } from "@sdxc/cloudflare-mocks";
import { ServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { formData } from "remix/middleware/form-data";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { memberships, teamDomains, teams } from "~/database/schema";
import routes from "~/routes/web";

/** The only message these actions enqueue: a request to verify one team domain's ownership. */
interface VerifyDomainMessage {
	type: "verifyDomainOwnership";
	teamDomainId: string;
}

/**
 * The queue verification requests land on. It lives at module scope because the actions
 * capture `env` on import; `beforeEach` empties it for each test.
 */
let queue: QueueMock<VerifyDomainMessage> = createQueue<VerifyDomainMessage>();

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({ QUEUE: queue }),
	waitUntil: (promise: Promise<unknown>) => promise,
}));

beforeEach(() => {
	queue.reset();
});

/**
 * `@sdxc/validate`'s `validate()` flattens `FormData` into a plain object, which
 * `remix/data-schema/form-data`'s `f.object()` rejects — a real bug that fails every
 * call. This mock forwards the form container to the schema unflattened, exercising real branching.
 */
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

		let response = await send(
			db,
			team,
			membership,
			routes.teamAdminActions.domain.add,
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
		expect(queue.sent.map((message) => message.body)).toEqual([
			{ type: "verifyDomainOwnership", teamDomainId: domain!.id },
		]);
	});

	test("rejects a hostname already verified for the team without creating a duplicate", async () => {
		let { db, team, membership } = await createFixture();

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
			routes.teamAdminActions.domain.add,
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
		expect(queue.sent).toHaveLength(0);
	});

	test("redirects back without creating a domain when the hostname is empty", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.teamAdminActions.domain.add,
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
		expect(queue.sent).toHaveLength(0);
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
			routes.teamAdminActions.domain.remove,
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
			routes.teamAdminActions.domain.remove,
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

		let response = await send(
			db,
			team,
			membership,
			routes.teamAdminActions.domain.retryVerification,
			retryDomainVerification as RequestHandler<any>,
			"POST",
			{ domain_id: domain.id },
		);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			routes.app.team.settings.href({ team: team.slug }),
		);
		expect(queue.sent.map((message) => message.body)).toEqual([
			{ type: "verifyDomainOwnership", teamDomainId: domain.id },
		]);
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

		let response = await send(
			db,
			team,
			membership,
			routes.teamAdminActions.domain.retryVerification,
			retryDomainVerification as RequestHandler<any>,
			"POST",
			{ domain_id: domain.id },
		);

		expect(response.status).toBe(303);
		expect(queue.sent).toHaveLength(0);
	});

	test("responds 404 for a domain that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(
			db,
			team,
			membership,
			routes.teamAdminActions.domain.retryVerification,
			retryDomainVerification as RequestHandler<any>,
			"POST",
			{ domain_id: crypto.randomUUID() },
		);

		expect(response.status).toBe(404);
	});
});
