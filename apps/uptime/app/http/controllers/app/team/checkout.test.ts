/**
 * Tests for the billing checkout entry point. A fake `PolarClient` stands in for the
 * real one, stubbing every method `~/app/data/customer.ts` calls. Whether the owner is
 * subscribed is seeded into the `subscriptions` projection instead of stubbed on the
 * client (ADR-005), since that is where it is read from.
 *
 * No `cloudflare:workers` mock is registered here, but the controller's graph does reach
 * it: `requireTeam` calls `apportionCostByTeam`, and `~/app/services/cost.ts` imports
 * `env` at module load. The virtual module from the preload in `bunfig.toml` is what
 * satisfies that — nothing here reads a binding, so no binding needs faking.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import type { Middleware, RequestContext, RequestHandler } from "remix/fetch-router";
import type { RemixNode } from "remix/ui";

import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { createInstance } from "i18next";
import { asyncContext } from "remix/async-context-middleware";
import { Auth } from "remix/auth-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { renderWith } from "remix/render-middleware";
import { renderToStream } from "remix/ui/server";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { createActiveSubscription } from "~/app/lib/test/polar";
import en from "~/app/locales/en";
import { memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

import * as checkoutModule from "./checkout";

function createHtmlRenderer(ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit) {
		let stream = renderToStream(node, { frameSrc: ctx.request.url, resolveFrame: async () => "" });
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(stream, { ...init, headers });
	};
}

let i18nextInstance = createInstance();
await i18nextInstance.init({
	lng: "en",
	fallbackLng: "en",
	supportedLngs: ["en"],
	resources: { en: { translation: en } },
});

/** Seeds ctx.team/ctx.membership/ctx.teams/ctx.locale/ctx.i18next + Auth. */
function seedTeam(
	team: SelectTeam,
	membership: SelectMembership,
	teamsList: SelectTeam[] = [team],
): Middleware {
	let viewer: Viewer = {
		id: membership.subject_id,
		name: "Test Viewer",
		email: "viewer@example.com",
		avatar: "",
	};
	return (ctx, next) => {
		ctx.team = team;
		ctx.membership = membership;
		ctx.teams = teamsList;
		ctx.locale = "en";
		ctx.i18next = i18nextInstance;
		ctx.set(Auth, { ok: true, identity: viewer, method: "test" });
		return next();
	};
}

async function createFixture() {
	let { db } = createTestDatabase();
	let team = await db.create(
		teams,
		{ id: crypto.randomUUID(), owner_id: "owner-1", name: "Acme", slug: "acme", logo: null },
		{ touch: true, returnRow: true },
	);
	return { db, team };
}

async function renderCheckout(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	polar: PolarClient,
) {
	let router = createRouter({
		middleware: [asyncContext(), renderWith(createHtmlRenderer) as Middleware],
	});
	router.map(routes.app.team.checkout, {
		middleware: [seedTeam(team, membership)],
		handler: (checkoutModule.default as { handler: RequestHandler<any> }).handler,
	});

	let container = new ServiceContainer();
	container.instance(Database, db);
	container.instance(PolarClient, polar);

	let request = new Request(
		new URL(routes.app.team.checkout.href({ team: team.slug }), "https://uptime.test"),
		{ redirect: "manual" },
	);
	return container.scope(() => router.fetch(request));
}

function createFakePolar(overrides: Partial<Record<string, unknown>> = {}): PolarClient {
	return {
		getExternalCustomer: mock(async () => ({ id: "cus_1" })),
		createCheckoutSession: mock(async () => ({ url: "https://polar.sh/checkout/123" })),
		createPortalSession: mock(async () => ({ url: "https://polar.sh/portal/123" })),
		...overrides,
	} as unknown as PolarClient;
}

describe("checkout page", () => {
	test("shows an owner-only message for a non-owner membership, without redirecting", async () => {
		let { db, team } = await createFixture();
		let membership = await db.create(
			memberships,
			{ id: crypto.randomUUID(), subject_id: "member-2", team_id: team.id, role: "member" },
			{ touch: true, returnRow: true },
		);
		let polar = createFakePolar();

		let response = await renderCheckout(db, team, membership, polar);
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain(en.page.billing.header.title);
		expect(body).toContain("Only the team owner can view and manage billing for this team.");
	});

	test("redirects the owner to a Polar checkout session when there's no active subscription", async () => {
		let { db, team } = await createFixture();
		let membership = await db.create(
			memberships,
			{ id: crypto.randomUUID(), subject_id: "owner-1", team_id: team.id, role: "admin" },
			{ touch: true, returnRow: true },
		);
		let polar = createFakePolar({
			getExternalCustomer: mock(async () => ({ id: "cus_1" })),
			createCheckoutSession: mock(async () => ({ url: "https://polar.sh/checkout/123" })),
		});

		let response = await renderCheckout(db, team, membership, polar);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe("https://polar.sh/checkout/123");
	});

	test("redirects the owner to the Polar customer portal when there's an active subscription", async () => {
		let { db, team } = await createFixture();
		let membership = await db.create(
			memberships,
			{ id: crypto.randomUUID(), subject_id: "owner-1", team_id: team.id, role: "admin" },
			{ touch: true, returnRow: true },
		);
		let polar = createFakePolar({
			getExternalCustomer: mock(async () => ({ id: "cus_1" })),
			createPortalSession: mock(async () => ({ url: "https://polar.sh/portal/123" })),
		});
		// Entitlement comes from the D1 projection now, not from a Polar lookup (ADR-005).
		await createActiveSubscription(db, team.owner_id);

		let response = await renderCheckout(db, team, membership, polar);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe("https://polar.sh/portal/123");
	});
});
