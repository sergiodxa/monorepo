/**
 * Tests the DNS monitor detail page's three `Frame`s end to end through the app's real
 * renderer, so every fragment controller runs under production's middleware chain and its
 * markup has to actually reach the client for a case to pass. Each case asserts a frame's
 * `<template>` streamed and closed under its placeholder's id, since a fragment can render
 * valid markup and still never be sent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestHandler } from "remix/router";

import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import i18n from "~/app/http/middleware/i18n";
import { createHtmlRenderer } from "~/app/http/render";
import { createTestDatabase } from "~/app/lib/test/db";
import en from "~/app/locales/en";
import {
	dnsMonitorRecords,
	dnsMonitorResults,
	dnsMonitors,
	memberships,
	monitorDailyStats,
	teams,
} from "~/database/schema";
import routes from "~/routes/web";

/**
 * The page and its three fragments, mapped whole — middleware chain included — rather than
 * unwrapped to their handlers, so `requireUser`/`requireTeam` run on the frame
 * sub-requests exactly as they do in production.
 */
interface Mapped {
	middleware?: readonly Middleware[];
	handler: RequestHandler<never>;
}

let show = (await import("./dns-monitor-show")).default as unknown as Mapped;
let cardResults = (await import("./dns-monitor-card-results")).default as unknown as Mapped;
let cardCheckHistory = (await import("./dns-monitor-card-check-history"))
	.default as unknown as Mapped;
let cardUptimeHistory = (await import("./dns-monitor-card-uptime-history"))
	.default as unknown as Mapped;

const BASE_URL = "https://uptime.test";

/**
 * The CSS declarations a rendered element's classes resolve to, read out of the `<style>`
 * tags the renderer emits — `css()` mixins turn into generated class names, so a layout
 * assertion has to compare declarations, since the class name itself changes with the rule.
 */
function declarationsFor(html: string, classAttribute: string): string {
	let rules = new Map<string, string>();
	for (let match of html.matchAll(/<style data-rmx-style="([^"]+)">.*?\{\s*\.\1\s*\{([^}]*)\}/gs)) {
		rules.set(match[1] ?? "", (rules.get(match[1] ?? "") ?? "") + (match[2] ?? ""));
	}

	return classAttribute
		.split(/\s+/)
		.map((name) => rules.get(name) ?? "")
		.join("");
}

/**
 * Every frame placeholder in the document that no template ever answered — the client keeps
 * showing its fallback until a closed `<template>` of the same id arrives, so only a closed
 * tag counts: a fragment that died mid-body leaves its template unterminated.
 */
function unresolvedFrameIds(html: string): string[] {
	let streamed = new Set(
		[...html.matchAll(/<template id="([^"]+)">[\s\S]*?<\/template>/g)].map(
			(match) => match[1] ?? "",
		),
	);

	return [...html.matchAll(/<!-- rmx:f:(\S+) -->/g)]
		.map((match) => match[1] ?? "")
		.filter((id) => !streamed.has(id));
}

/**
 * Where each frame placeholder sits in the document, in document order — the only handle a
 * test has on *which* frame is which, since the placeholder's id is generated and carries no
 * relation to the name the page declared. Document order is also the client's layout contract.
 */
function frameOffsets(html: string): number[] {
	return [...html.matchAll(/<!-- rmx:f:\S+ -->/g)].map((match) => match.index);
}

/** Elements the HTML parser accepts as a direct child of each table-structure element. */
const ALLOWED_TABLE_CHILDREN: Record<string, readonly string[]> = {
	table: ["caption", "colgroup", "thead", "tbody", "tfoot", "tr", "script", "template", "style"],
	thead: ["tr", "script", "template", "style"],
	tbody: ["tr", "script", "template", "style"],
	tfoot: ["tr", "script", "template", "style"],
	tr: ["td", "th", "script", "template", "style"],
};

/**
 * Everything the browser's parser would foster-parent out of a table: an element, or text,
 * that lands as a direct child of `<table>`/`<tbody>`/`<tr>`, outside any cell. Hoisted
 * content moves to just before the table, carrying whatever follows it along.
 */
function fosterParentedContent(html: string): string[] {
	let offenders: string[] = [];
	let stack: string[] = [];

	for (let match of html.matchAll(/<!--[\s\S]*?-->|<(\/?)([a-zA-Z][^\s/>]*)[^>]*?(\/?)>|[^<]+/g)) {
		let [token, closing, tag, selfClosing] = match;
		if (token.startsWith("<!--")) continue;

		let parent = stack.at(-1);
		let allowed = parent === undefined ? undefined : ALLOWED_TABLE_CHILDREN[parent];

		if (tag === undefined) {
			if (allowed && token.trim() !== "") offenders.push(`text in <${parent}>: ${token.trim()}`);
			continue;
		}

		let name = tag.toLowerCase();

		if (closing === "/") {
			let index = stack.lastIndexOf(name);
			if (index !== -1) stack.length = index;
			continue;
		}

		if (allowed && !allowed.includes(name)) offenders.push(`<${name}> in <${parent}>`);
		if (selfClosing !== "/" && name in ALLOWED_TABLE_CHILDREN) stack.push(name);
		if (name === "td" || name === "th") stack.push(name);
	}

	return offenders;
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

/**
 * One team, one DNS monitor, and the page plus every fragment route on a single router,
 * seeded with one record per state a row can be drawn in so the inline table between the
 * frames renders every branch its cells have, including the watch toggle's own form.
 */
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

	for (let record of [
		{ record_type: "A", value: "1.2.3.4", status: "ok", is_enabled: true },
		{ record_type: "MX", value: "10 mx.example.com", status: "new", is_enabled: false },
		{ record_type: "TXT", value: "v=spf1 include:_spf.example.com ~all", status: "changed" },
		{ record_type: "CNAME", value: "example.com", status: "missing", is_enabled: false },
		{ record_type: "NS", value: "ns1.example.com", status: "error", is_enabled: true },
	] as const) {
		await db.create(
			dnsMonitorRecords,
			{
				id: crypto.randomUUID(),
				dns_monitor_id: monitor.id,
				name: "example.com",
				record_type: record.record_type,
				value: record.value,
				source: "resolver",
				is_enabled: "is_enabled" in record ? record.is_enabled : true,
				status: record.status,
				first_seen_at: Date.now(),
				last_seen_at: Date.now(),
				last_checked_at: Date.now(),
			},
			{ touch: true, returnRow: true },
		);
	}

	let router = createRouter({
		middleware: [
			asyncContext(),
			seedTeam(team, membership),
			i18n,
			renderWith(createHtmlRenderer) as Middleware,
		],
	});

	let map = router.map.bind(router) as (target: unknown, action: unknown) => void;
	map(routes.app.team.dnsMonitors.show, show);
	map(routes.app.team.dnsMonitors.cards.results, options.results ?? cardResults);
	map(routes.app.team.dnsMonitors.cards.checkHistory, cardCheckHistory);
	map(routes.app.team.dnsMonitors.cards.uptimeHistory, cardUptimeHistory);

	let container = new ServiceContainer();
	container.instance(Database, db);

	return {
		db,
		team,
		monitor,

		/** The detail page document, with every frame resolved through this router. */
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
	/**
	 * Per-check latency stays on the row it belongs to, so a headline card's numbers describe
	 * only the resolver's own speed, and a sweep that lost queries reports exactly how many
	 * went unanswered.
	 */
	test("resolves the summary and check-history fragments instead of leaving their skeletons", async () => {
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
		expect(unresolvedFrameIds(body)).toEqual([]);
		expect(body).toContain(en.page.dnsMonitorDetail.stats.successRate.label);
		expect(body).toContain(en.page.dnsMonitorDetail.stats.totalChecks.label);
		expect(body).toContain(en.page.dnsMonitorDetail.results.title);
		expect(body).toContain("42ms");
		expect(body).not.toContain("Avg. Response Time");
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
		expect(unresolvedFrameIds(body)).toEqual([]);
		expect(body).toContain(en.page.dnsMonitorDetail.uptimeHistory);
		expect(body).toContain(en.statusPage.uptimeBar.legend.full);
	});

	test("resolves every frame on a monitor that has never been checked", async () => {
		let harness = await createHarness();

		let body = await (await harness.visit()).text();

		expect(body).not.toContain("Frame error:");
		expect(unresolvedFrameIds(body)).toEqual([]);
		expect(body).toContain(en.page.dnsMonitorDetail.results.empty);
		expect(body).toContain(en.page.dnsMonitorDetail.uptimeHistory);
	});

	/**
	 * The check log is the least-scanned thing on the page, so it goes last — under a record
	 * table that on a real zone runs to dozens of rows. Order here is a property of placeholder
	 * position in the document, the only layout contract the client honours.
	 */
	test("puts the check history last, below the record table", async () => {
		let harness = await createHarness();

		let body = await (await harness.visit()).text();

		let [summary, uptimeHistory, checkHistory] = frameOffsets(body);
		let records = body.indexOf(en.page.dnsMonitorDetail.records.title);

		expect(frameOffsets(body)).toHaveLength(3);
		expect(uptimeHistory).toBeGreaterThan(summary ?? -1);
		expect(records).toBeGreaterThan(uptimeHistory ?? -1);
		expect(checkHistory).toBeGreaterThan(records);
	});

	/**
	 * The record table renders inline, between the frames, and a browser hoists content found
	 * directly inside a table out of it, carrying everything after it along — the check-history
	 * placeholder sitting just below included.
	 */
	test("emits the record table with nothing a browser would hoist out of it", async () => {
		let harness = await createHarness();

		let body = await (await harness.visit()).text();

		expect(body).toContain(en.page.dnsMonitorDetail.records.actions.disable);
		expect(fosterParentedContent(body)).toEqual([]);
	});

	/**
	 * `StatCardSkeleton` renders bare cards so several frames can share one row a caller lays
	 * out. This page's frames stand alone, so each fallback opens its own row — the shape every
	 * fragment here actually resolves to once it streams in.
	 */
	test("opens each frame's fallback with a row, so the placeholder cards are not flush", async () => {
		let harness = await createHarness();

		let body = await (await harness.visit()).text();

		let fallbacks = [...body.matchAll(/<!-- rmx:f:[^>]*-->\s*<div class="([^"]*)"/g)];
		expect(fallbacks).toHaveLength(3);

		for (let fallback of fallbacks) {
			let declarations = declarationsFor(body, fallback[1] ?? "");
			expect(declarations).toContain("display: flex");
			expect(declarations).toContain("gap: 16px");
		}
	});

	/**
	 * A fallback of the wrong height moves the page when the frame swaps out, so the number of
	 * placeholder cards has to equal the fragment's own: two, since the summary now totals
	 * success rate and total checks, each drawn as `Card`'s tinted `<section>`.
	 */
	test("holds exactly as many placeholder cards as the summary resolves to", async () => {
		let harness = await createHarness();

		let body = await (await harness.visit()).text();

		let [summary, uptimeHistory] = frameOffsets(body);
		let fallback = body.slice(summary, uptimeHistory);

		expect([...fallback.matchAll(/<section data-color=/g)]).toHaveLength(2);
	});

	/**
	 * A fragment that throws before it produces a response: frame resolution rejects, and a
	 * rejection streams no `<template>`, so a failure has to surface as visible content — an
	 * error message — while the surviving frame still arrives.
	 */
	test("renders a fragment that throws as an error rather than an unresolvable skeleton", async () => {
		let harness = await createHarness({
			results: {
				handler() {
					throw new Error("fragment blew up");
				},
			},
		});

		let body = await (await harness.visit()).text();

		expect(body).toContain("Frame error: fragment blew up");
		expect(unresolvedFrameIds(body)).toEqual([]);
		expect(body).toContain(en.page.dnsMonitorDetail.uptimeHistory);
	});

	/**
	 * A fragment's response exists before its HTML does — `ctx.render` returns the moment its
	 * stream is created — so a component that throws mid-tree fails after the response already
	 * shipped, and the renderer has to turn that stream failure into a visible error template.
	 */
	test("renders a fragment that fails while its body streams, not a silent skeleton", async () => {
		let harness = await createHarness({
			results: {
				handler() {
					return new Response(
						new ReadableStream({
							start(controller) {
								controller.error(new Error("body blew up"));
							},
						}),
						{ headers: { "content-type": "text/html; charset=utf-8" } },
					);
				},
			},
		});

		let body = await (await harness.visit()).text();

		expect(body).toContain("Frame error:");
		expect(unresolvedFrameIds(body)).toEqual([]);
		expect(body).toContain(en.page.dnsMonitorDetail.uptimeHistory);
	});
});
