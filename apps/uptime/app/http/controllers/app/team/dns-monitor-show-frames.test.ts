/**
 * Tests the DNS monitor detail page's two `Frame`s end to end, through the app's real
 * renderer: the document request dispatches each frame's `src` back through the same
 * router, so both fragment controllers run for real — middleware chain, current schema,
 * migrated tables — and their HTML has to land inside the document.
 *
 * The page's own tests stub `resolveFrame` to an empty string, which makes every frame
 * look like it resolved to nothing and lets a page whose frames never arrive ship
 * unnoticed. This file imports `~/app/http/render` instead of restating it, so the code
 * under test is the code that runs in production.
 *
 * The last case is the failure mode itself. A frame's content reaches the client as a
 * `<template>` streamed after the document; when frame resolution rejects rather than
 * answering, no template is streamed, the client waits for one forever, and the fallback
 * skeleton becomes permanent with nothing said anywhere about why. A failed frame must
 * report itself in the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { Middleware, RequestHandler } from "remix/fetch-router";

import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Auth } from "remix/auth-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { renderWith } from "remix/render-middleware";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import i18n from "~/app/http/middleware/i18n";
import { createHtmlRenderer } from "~/app/http/render";
import { createTestDatabase } from "~/app/lib/test/db";
import en from "~/app/locales/en";
import {
	dnsMonitorResults,
	dnsMonitors,
	memberships,
	monitorDailyStats,
	teams,
} from "~/database/schema";
import routes from "~/routes/web";

/**
 * The page and its two fragments, mapped whole — middleware chain included — rather than
 * unwrapped to their handlers, so `requireUser`/`requireTeam` run on the frame
 * sub-requests exactly as they do in production.
 */
interface Mapped {
	middleware?: readonly Middleware[];
	handler: RequestHandler<never>;
}

let show = (await import("./dns-monitor-show")).default as unknown as Mapped;
let cardResults = (await import("./dns-monitor-card-results")).default as unknown as Mapped;
let cardUptimeHistory = (await import("./dns-monitor-card-uptime-history"))
	.default as unknown as Mapped;

const BASE_URL = "https://uptime.test";

/**
 * The CSS declarations a rendered element's classes resolve to, read out of the `<style>`
 * tags the renderer emits alongside the markup. `css()` mixins turn into generated class
 * names, so a layout assertion has to go through them rather than matching a class name
 * that changes whenever the rule does.
 */
function declarationsFor(html: string, classAttribute: string): string {
	let rules = new Map<string, string>();
	for (let match of html.matchAll(/<style data-rmx="([^"]+)">.*?\{\s*\.\1\s*\{([^}]*)\}/gs)) {
		rules.set(match[1] ?? "", (rules.get(match[1] ?? "") ?? "") + (match[2] ?? ""));
	}

	return classAttribute
		.split(/\s+/)
		.map((name) => rules.get(name) ?? "")
		.join("");
}

/** Seeds `ctx.team`/`ctx.membership`/`ctx.teams`/auth state, standing in for the real sign-in. */
function seedTeam(team: SelectTeam, membership: SelectMembership): Middleware {
	let viewer: Viewer = {
		id: membership.subject_id,
		name: "Test Viewer",
		email: "viewer@example.com",
		avatar: "",
	};

	return (ctx, next) => {
		ctx.team = team;
		ctx.membership = membership;
		ctx.teams = [team];
		ctx.set(Auth, { ok: true, identity: viewer, method: "test" });
		return next();
	};
}

namespace createHarness {
	export interface Options {
		/** Replaces the results fragment's handler, for the failure case. */
		results?: Mapped;
	}
}

/** One team, one DNS monitor, and the page plus both fragment routes on a single router. */
async function createHarness(options: createHarness.Options = {}) {
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
	let monitor = await db.create(
		dnsMonitors,
		{ id: crypto.randomUUID(), team_id: team.id, name: "Production DNS", domain: "example.com" },
		{ touch: true, returnRow: true },
	);

	// Mirrors production: the renderer and the language resolver are global middleware, so
	// a frame sub-request is rendered by the same request-scoped renderer the document is.
	let router = createRouter({
		middleware: [
			asyncContext(),
			seedTeam(team, membership),
			i18n,
			renderWith(createHtmlRenderer) as Middleware,
		],
	});

	let map = router.map as (target: unknown, action: unknown) => void;
	map(routes.app.team.dnsMonitors.show, show);
	map(routes.app.team.dnsMonitors.cards.results, options.results ?? cardResults);
	map(routes.app.team.dnsMonitors.cards.uptimeHistory, cardUptimeHistory);

	let container = new ServiceContainer();
	container.instance(Database, db);

	return {
		db,
		team,
		monitor,

		/** The detail page document, with both frames resolved through this router. */
		async visit() {
			let request = new Request(
				new URL(
					routes.app.team.dnsMonitors.show.href({ team: team.slug, monitorId: monitor.id }),
					BASE_URL,
				),
			);

			return await container.scope(() => router.fetch(request));
		},
	};
}

describe("the DNS monitor detail page's frames, resolved server-side", () => {
	test("resolves the results fragment into the document instead of leaving its skeleton", async () => {
		let harness = await createHarness();

		await harness.db.create(
			dnsMonitorResults,
			{
				id: crypto.randomUUID(),
				dns_monitor_id: harness.monitor.id,
				status: "changed",
				checked_at: Date.now(),
				response_time_ms: 42,
				records_checked: 4,
				records_changed: 1,
				records_missing: 0,
				records_new: 0,
				queries_failed: 2,
				error_message: null,
			},
			{ touch: true, returnRow: true },
		);

		let body = await (await harness.visit()).text();

		expect(body).not.toContain("Frame error:");
		// Markup only the fragment route renders: with frame resolution stubbed out, every
		// assertion below would be run against an empty string.
		expect(body).toContain(en.page.dnsMonitorDetail.stats.successRate.label);
		expect(body).toContain(en.page.dnsMonitorDetail.stats.totalChecks.label);
		expect(body).toContain(en.page.dnsMonitorDetail.results.title);
		expect(body).toContain("42ms");
		// A sweep that lost queries knows less than a whole one did, and says so.
		expect(body).toContain("2 queries did not answer");
	});

	test("resolves the uptime-history fragment into the document instead of leaving its skeleton", async () => {
		let harness = await createHarness();

		await harness.db.create(
			monitorDailyStats,
			{
				id: crypto.randomUUID(),
				monitor_id: harness.monitor.id,
				monitor_type: "dns",
				date: new Date().toISOString().slice(0, 10),
				total_checks: 10,
				successful_checks: 10,
				failed_checks: 0,
				avg_response_time_ms: 30,
				max_response_time_ms: 30,
				p95_response_time_ms: 30,
				status: "up",
			},
			{ touch: true, returnRow: true },
		);

		let body = await (await harness.visit()).text();

		expect(body).not.toContain("Frame error:");
		expect(body).toContain(en.page.dnsMonitorDetail.uptimeHistory);
		expect(body).toContain(en.statusPage.uptimeBar.legend.full);
	});

	test("resolves both frames on a monitor that has never been checked", async () => {
		let harness = await createHarness();

		let body = await (await harness.visit()).text();

		expect(body).not.toContain("Frame error:");
		expect(body).toContain(en.page.dnsMonitorDetail.results.empty);
		expect(body).toContain(en.page.dnsMonitorDetail.uptimeHistory);
	});

	/**
	 * `StatCardSkeleton` renders bare cards deliberately, so several frames can share one
	 * row a caller lays out. This page's frames each stand alone, so each has to open its
	 * fallback with a row of its own — without one the placeholder cards stack flush, which
	 * is not the shape either fragment resolves to.
	 */
	test("opens each frame's fallback with a row, so the placeholder cards are not flush", async () => {
		let harness = await createHarness();

		let body = await (await harness.visit()).text();

		let fallbacks = [...body.matchAll(/<!-- rmx:f:[^>]*-->\s*<div class="([^"]*)"/g)];
		expect(fallbacks).toHaveLength(2);

		for (let fallback of fallbacks) {
			let declarations = declarationsFor(body, fallback[1] ?? "");
			expect(declarations).toContain("display: flex");
			expect(declarations).toContain("gap: 16px");
		}
	});

	/**
	 * The regression the page shipped with: a fragment that throws rejects frame
	 * resolution, and a rejection streams no `<template>` at all — so the client's frame
	 * never resolves and the skeleton is what the visitor keeps. A failure has to become
	 * content, and the surviving frame has to arrive regardless.
	 */
	test("renders a failing fragment as an error rather than an unresolvable skeleton", async () => {
		let harness = await createHarness({
			results: {
				handler() {
					throw new Error("fragment blew up");
				},
			},
		});

		let body = await (await harness.visit()).text();

		expect(body).toContain("Frame error: fragment blew up");
		// The failure is contained: the other frame still resolves.
		expect(body).toContain(en.page.dnsMonitorDetail.uptimeHistory);
	});
});
