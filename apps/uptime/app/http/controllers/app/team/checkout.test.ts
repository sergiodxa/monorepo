/**
 * Tests for the billing checkout entry point: who gets redirected to a hosted page, which
 * page, and what an owner sees when the platform cannot open one.
 *
 * The platform is a real in-memory one, so the hosted pages under assertion are the URLs it
 * actually handed back rather than strings this file made up. Subscription status is seeded
 * into the `subscriptions` projection (ADR-005), the store the controller reads at request
 * time. The `bunfig.toml` preload supplies `cloudflare:workers` for `env` on this path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing, Checkout } from "@sdxc/billing";
import type { RemixNode } from "remix/component";
import type { Database } from "remix/data-table";
import type { Middleware, RequestContext, RequestHandler } from "remix/router";

import { attribution } from "@sdxc/attribution/middleware";
import billing from "@sdxc/billing/middleware";
import { MemoryBilling } from "@sdxc/billing/providers/memory";
import { createTranslator } from "@sdxc/i18n";
import { log } from "@sdxc/logger/middleware";
import { unwrap } from "@sdxc/result";
import { renderToStream } from "remix/component/server";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { describe, expect, test, vi } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { database } from "~/app/http/middleware/database";
import { createActiveSubscription, createTestBilling } from "~/app/lib/test/billing";
import { createTestDatabase } from "~/app/lib/test/db";
import en from "~/app/locales/en";
import { memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

import * as checkoutModule from "./checkout";

/** The controller's own logging is noise here; the assertions read the response. */
vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(console, "info").mockImplementation(() => {});

function createHtmlRenderer(ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit) {
		let stream = renderToStream(node, { frameSrc: ctx.request.url, resolveFrame: async () => "" });
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(stream, { ...init, headers });
	};
}

let { intl } = createTranslator({
	resources: { en },
	supportedLanguages: ["en"],
	fallbackLanguage: "en",
})();

/** Seeds ctx.team/ctx.membership/ctx.teams/ctx.locale/ctx.intl + Auth. */
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
		ctx.intl = intl;
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

/**
 * Requests the checkout page through the attribution middleware the app installs, so a
 * navigation carrying campaign parameters reaches the handler as the owner's first touch.
 *
 * @param init - The page's query string and request headers, for a request that is a navigation.
 */
async function renderCheckout(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	platform: Billing,
	init: { search?: string; headers?: HeadersInit } = {},
) {
	let router = createRouter({
		middleware: [
			asyncContext(),
			database(() => db),
			log() as Middleware,
			billing({ provider: platform }),
			attribution({ store: "session" }),
			renderWith(createHtmlRenderer) as Middleware,
		],
	});
	router.map(routes.app.team.checkout, {
		middleware: [seedTeam(team, membership)],
		handler: (checkoutModule.default as { handler: RequestHandler<any> }).handler,
	});

	let url = new URL(routes.app.team.checkout.href({ team: team.slug }), "https://uptime.test");
	url.search = init.search ?? "";
	let request = new Request(url, { redirect: "manual", headers: init.headers });
	return router.fetch(request);
}

/** The maps the platform keeps its state in, for the one checkout no method lists back. */
interface PlatformState {
	checkouts: Map<string, Checkout>;
}

/** The single session the request opened, which is the page the owner has to land on. */
function onlyCheckout(platform: MemoryBilling): Checkout {
	let opened = [...(platform.native as PlatformState).checkouts.values()];
	expect(opened).toHaveLength(1);

	let [checkout] = opened;
	if (checkout === undefined) throw new Error("the platform opened no checkout");

	return checkout;
}

describe("checkout page", () => {
	test("shows an owner-only message for a non-owner membership, without redirecting", async () => {
		let { db, team } = await createFixture();
		let membership = await db.create(
			memberships,
			{ id: crypto.randomUUID(), subject_id: "member-2", team_id: team.id, role: "member" },
			{ touch: true, returnRow: true },
		);

		let response = await renderCheckout(db, team, membership, createTestBilling());
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain(en.page.billing.header.title);
		expect(body).toContain("Only the team owner can view and manage billing for this team.");
	});

	test("redirects the owner to a hosted checkout when there's no active subscription", async () => {
		let { db, team } = await createFixture();
		let membership = await db.create(
			memberships,
			{ id: crypto.randomUUID(), subject_id: "owner-1", team_id: team.id, role: "admin" },
			{ touch: true, returnRow: true },
		);
		let platform = createTestBilling();

		let response = await renderCheckout(db, team, membership, platform);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(onlyCheckout(platform).url);
	});

	/**
	 * The checkout's metadata comes back on the platform's order and subscription webhooks,
	 * which is how a payment is joined to the campaign that brought the owner in.
	 */
	test("opens the checkout carrying where the owner arrived from", async () => {
		let { db, team } = await createFixture();
		let membership = await db.create(
			memberships,
			{ id: crypto.randomUUID(), subject_id: "owner-1", team_id: team.id, role: "admin" },
			{ touch: true, returnRow: true },
		);
		let platform = createTestBilling();

		await renderCheckout(db, team, membership, platform, {
			search: "?utm_source=newsletter&utm_medium=email&utm_campaign=launch-week",
			headers: {
				Accept: "text/html",
				"Sec-Fetch-Dest": "document",
				"User-Agent":
					"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
			},
		});

		expect(onlyCheckout(platform).providerData).toMatchObject({
			metadata: {
				first_channel: "email",
				first_source: "newsletter",
				first_campaign: "launch-week",
				first_landing: routes.app.team.checkout.href({ team: team.slug }),
			},
		});
	});

	test("redirects the owner to the hosted portal when there's an active subscription", async () => {
		let { db, team } = await createFixture();
		let membership = await db.create(
			memberships,
			{ id: crypto.randomUUID(), subject_id: "owner-1", team_id: team.id, role: "admin" },
			{ touch: true, returnRow: true },
		);
		let platform = createTestBilling();

		/** The portal is a page for an existing customer, so the owner has to be one. */
		let customer = await unwrap(
			platform.customers.create({ email: "owner@example.com", externalId: team.owner_id }),
		);
		await createActiveSubscription(db, team.owner_id);

		let response = await renderCheckout(db, team, membership, platform);

		expect(response.status).toBe(303);
		expect(response.headers.get("Location")).toBe(
			(await unwrap(platform.portal.create({ customer: { id: customer.id } }))).url,
		);
	});

	/**
	 * A platform that cannot open the page still leaves the owner somewhere to read: the
	 * billing page says so, rather than the request failing on them.
	 */
	test("renders the billing page when the platform opens no hosted page", async () => {
		let { db, team } = await createFixture();
		let membership = await db.create(
			memberships,
			{ id: crypto.randomUUID(), subject_id: "owner-1", team_id: team.id, role: "admin" },
			{ touch: true, returnRow: true },
		);

		/** A platform carrying nothing this app sells, so opening a checkout finds no product. */
		let response = await renderCheckout(db, team, membership, new MemoryBilling());
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(body).toContain(en.page.billing.header.title);
		expect(body).toContain(en.page.billing.unavailable);
	});
});
