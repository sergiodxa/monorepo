/**
 * Tests for the add/remove/retry-verification team-domain actions. The `QUEUE` binding is
 * an in-memory queue installed through `cloudflare:workers`, so `waitUntil(QUEUE.send(...))`
 * — fired for every add and every retry of an unverified domain — is asserted on the
 * message that really landed rather than on the fact a function was called.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ManagementClient } from "@sdxc/auth/management-client";
import type { QueueMock } from "@sdxc/cloudflare-mocks";
import type { RemixNode } from "remix/component";
import type { Database } from "remix/data-table";
import type { Middleware, RequestContext, RequestHandler } from "remix/router";
import type { Route } from "remix/routes";

import { SubjectNotFoundError } from "@sdxc/auth/management-client";
import { createEnv, createQueue } from "@sdxc/cloudflare-mocks";
import { database } from "@sdxc/database-middleware";
import { createTranslator } from "@sdxc/i18n";
import { jobEnqueuer } from "@sdxc/jobs/router";
import { failure } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
import { renderToStream } from "remix/component/server";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { formData } from "remix/middleware/form-data";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { admin } from "~/app/http/middleware/admin";
import { createTestDatabase } from "~/app/test/db";
import { testAssets } from "~/app/test/document-assets";
import { memberships, teamDomains, teams } from "~/database/schema";
import en from "~/resources/locales/en";
import routes from "~/routes/web";

/** The only message these actions enqueue: a request to verify one team domain's ownership. */
interface VerifyDomainMessage {
	job: "verifyDomainOwnership";
	body: { teamDomainId: string };
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
let { default: models } = await import("~/app/http/middleware/models");
let { addDomain, removeDomain, retryDomainVerification } = await import("./team-domains");
let { jobQueue } = await import("~/app/initializers/queue");

/** Creates an in-memory database seeded with one team and an admin membership. */
async function createFixture() {
	let { db } = createTestDatabase();

	let team = await db.create(
		teams,
		{ id: generateUUID(), owner_id: "owner-1", name: "Acme", slug: "acme", logo: null },
		{ touch: true, returnRow: true },
	);
	let membership = await db.create(
		memberships,
		{ id: generateUUID(), subject_id: "owner-1", team_id: team.id, role: "admin" },
		{ touch: true, returnRow: true },
	);

	return { db, team, membership };
}

/** Provides the translator directly, standing in for the app's language middleware here. */
let { intl } = createTranslator({
	resources: { en },
	supportedLanguages: ["en"],
	fallbackLanguage: "en",
})();

/**
 * Middleware that seeds `ctx.team`/`ctx.membership` in place of `requireTeam`/`requireRole`,
 * plus the translator and the signed-in viewer the settings page a refused domain draws again needs.
 */
function seedTeam(team: SelectTeam, membership: SelectMembership): Middleware {
	return (ctx, next) => {
		let viewer: Viewer = {
			id: membership.subject_id,
			name: "Test Viewer",
			email: "viewer@example.com",
			avatar: "",
		};
		ctx.team = team;
		ctx.teams = [team];
		ctx.membership = membership;
		ctx.locale = "en";
		ctx.intl = intl;
		ctx.set(Auth, { ok: true, identity: viewer, method: "test" });
		return next();
	};
}

/** Minimal request-scoped HTML renderer standing in for the app's `render()` middleware. */
function createHtmlRenderer(ctx: RequestContext) {
	return async function render(node: RemixNode, init?: ResponseInit): Promise<Response> {
		let stream = renderToStream(node, { frameSrc: ctx.request.url, resolveFrame: async () => "" });
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(stream, { ...init, headers });
	};
}

/** A management client that knows no subject, so the settings page lists members by raw id. */
let fakeAdmin = {
	fetchSubjectById: async (subjectId: string) => failure(new SubjectNotFoundError(subjectId)),
} as unknown as ManagementClient;

/** The add-domain dialog's markup as a refused submission draws it, open on load. */
function addDomainDialog(body: string): string | undefined {
	return /<dialog[^>]*id="add-domain"[^>]*>[\s\S]*?<\/dialog>/.exec(body)?.[0];
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
	let router = createRouter({
		middleware: [
			asyncContext(),
			database(db),
			models(),
			jobEnqueuer(jobQueue),
			admin(() => fakeAdmin),
			formData() as Middleware,
			testAssets(),
			renderWith(createHtmlRenderer) as Middleware,
		],
	});
	router.map(route, { middleware: [seedTeam(team, membership)], handler });

	let request = new Request(new URL(route.href({ team: team.slug }), "https://uptime.test"), {
		method,
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(params).toString(),
	});

	return router.fetch(request);
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
			{ job: "verifyDomainOwnership", body: { teamDomainId: domain!.id } },
		]);
	});

	test("rejects a hostname already verified for the team without creating a duplicate", async () => {
		let { db, team, membership } = await createFixture();

		await db.create(
			teamDomains,
			{
				id: generateUUID(),
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

		expect(response.status).toBe(422);
		let dialog = addDomainDialog(await response.text());
		expect(dialog).toMatch(/<dialog[^>]*\sopen/);
		expect(dialog).toContain(
			intl.t("actions.addDomain.errors.alreadyVerified", { hostname: "verified.com" }),
		);

		let matching = await db.findMany(teamDomains, {
			where: { team_id: team.id, hostname: "verified.com" },
		});
		expect(matching).toHaveLength(1);
		expect(queue.sent).toHaveLength(0);
	});

	test("draws the settings page again with the add-domain dialog open when the hostname is empty", async () => {
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

		expect(response.status).toBe(422);
		let dialog = addDomainDialog(await response.text());
		expect(dialog).toMatch(/<dialog[^>]*\sopen/);
		expect(dialog).toContain(en.actions.addDomain.errors.invalidHostname);

		let matching = await db.findMany(teamDomains, { where: { team_id: team.id } });
		expect(matching).toHaveLength(0);
		expect(queue.sent).toHaveLength(0);
	});

	test("keeps a refused hostname in the open dialog beside its error, creating nothing", async () => {
		let { db, team, membership } = await createFixture();
		let hostname = `${"a".repeat(256)}.com`;

		let response = await send(
			db,
			team,
			membership,
			routes.teamAdminActions.domain.add,
			addDomain as RequestHandler<any>,
			"POST",
			{ hostname },
		);

		expect(response.status).toBe(422);
		let dialog = addDomainDialog(await response.text());
		expect(dialog).toMatch(/<dialog[^>]*\sopen/);
		expect(dialog).toMatch(new RegExp(`<input[^>]*name="hostname"[^>]*value="${hostname}"`));
		expect(dialog).toContain(en.actions.addDomain.errors.invalidHostname);
		expect(await db.findMany(teamDomains, { where: { team_id: team.id } })).toHaveLength(0);
		expect(queue.sent).toHaveLength(0);
	});
});

describe("removeDomain", () => {
	test("deletes the domain and redirects to team settings", async () => {
		let { db, team, membership } = await createFixture();
		let domain = await db.create(
			teamDomains,
			{ id: generateUUID(), team_id: team.id, hostname: "remove-me.com", verified_at: null },
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
			{ domain_id: generateUUID() },
		);

		expect(response.status).toBe(404);
	});
});

describe("retryDomainVerification", () => {
	test("re-enqueues verification for an unverified domain and redirects to team settings", async () => {
		let { db, team, membership } = await createFixture();
		let domain = await db.create(
			teamDomains,
			{ id: generateUUID(), team_id: team.id, hostname: "pending.com", verified_at: null },
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
			{ job: "verifyDomainOwnership", body: { teamDomainId: domain.id } },
		]);
	});

	test("does not re-enqueue an already-verified domain", async () => {
		let { db, team, membership } = await createFixture();
		let domain = await db.create(
			teamDomains,
			{
				id: generateUUID(),
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
			{ domain_id: generateUUID() },
		);

		expect(response.status).toBe(404);
	});
});
