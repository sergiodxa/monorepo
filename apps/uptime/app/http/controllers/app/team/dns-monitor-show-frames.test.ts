/**
 * Tests the DNS monitor detail page's three `Frame`s end to end, through the app's real
 * renderer: the document request dispatches each frame's `src` back through the same
 * router, so every fragment controller runs for real — middleware chain, current schema,
 * migrated tables — and their HTML has to land inside the document.
 *
 * The page's own tests stub `resolveFrame` to an empty string, which makes every frame
 * look like it resolved to nothing and lets a page whose frames never arrive ship
 * unnoticed. This file imports `~/app/http/render` instead of restating it, so the code
 * under test is the code that runs in production.
 *
 * A frame's content reaches the client as a `<template>` streamed after the document, and
 * that template is the only thing that ends the skeleton — so every case here asserts it
 * arrived, closed, under the id the document's own placeholder carries. Asserting on the
 * fragment's markup alone does not: a fragment can render perfectly and still never be
 * emitted, which is precisely how a page with permanent skeletons passed its tests.
 *
 * The last two cases are the failure mode itself, once for each side of it. A fragment
 * response's headers exist before its HTML does, so a fragment can fail either before the
 * response — a handler that threw — or after it, while its body renders. Both used to end
 * the same way: no template, no error, a skeleton the visitor keeps forever.
 *
 * The record list is seeded rather than left empty, so the table the page renders inline
 * between the frames is actually emitted and can be checked for the markup a browser would
 * foster-parent out of it — which would relocate everything after it, the check-history
 * placeholder that sits directly below it included.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { Middleware, RequestHandler } from "remix/router";

import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";

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

/**
 * Every frame placeholder in the document that no template ever answered — which is the
 * page's permanent-skeleton list, since the placeholder is a region the client keeps
 * showing its fallback in until a closed `<template>` of the same id arrives.
 *
 * Only closed templates count. A template whose fragment died halfway through its body is
 * never terminated, the browser cannot use it, and matching on the opening tag alone would
 * report it as present.
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
 * Where each frame placeholder sits in the document, in document order — which is the only
 * handle a test has on *which* frame is which, since the id in the placeholder is generated
 * rather than the name the page declared. Document order is also what the client honours:
 * a frame fills the region it was declared in, so position is the page's layout contract.
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
 * sitting directly inside `<table>`/`<tbody>`/`<tr>` rather than inside a cell.
 *
 * Worth checking rather than trusting, because the server's output can be a perfectly
 * balanced string and still parse into a different tree than it reads as. Hoisted content
 * is moved to just before the table, taking whatever follows it out of position — which on
 * this page would mean the frame placeholders themselves.
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
		// Only table structure needs tracking: anything nested inside a cell is the cell's
		// business, and a `<td>` on the stack is what makes its own children legal.
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

/** One team, one DNS monitor, and the page plus every fragment route on a single router. */
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

	// One record per state the row can be drawn in, so the inline table between the frames is
	// rendered with every branch its cells have — including the watch toggle's own form.
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
		// The template is what ends the skeleton, so it is what gets asserted: a fragment can
		// render its whole tree and still never be streamed, and then this page looks exactly
		// as broken as one whose fragment never ran.
		expect(unresolvedFrameIds(body)).toEqual([]);
		// Markup only the fragment route renders: with frame resolution stubbed out, every
		// assertion below would be run against an empty string.
		expect(body).toContain(en.page.dnsMonitorDetail.stats.successRate.label);
		expect(body).toContain(en.page.dnsMonitorDetail.stats.totalChecks.label);
		expect(body).toContain(en.page.dnsMonitorDetail.results.title);
		expect(body).toContain("42ms");
		// Per-check latency stays on the row it belongs to; averaging it into a headline card
		// would report our resolver's speed as a fact about the visitor's DNS.
		expect(body).not.toContain("Avg. Response Time");
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
	 * The page reads from claim to evidence, and the raw check log is the least-scanned
	 * thing on it, so it goes last — under a record table that on a real zone runs to dozens
	 * of rows. Order is a property of where the placeholders sit in the document, which is
	 * the only thing the client can honour: a frame fills the region it was declared in.
	 */
	test("puts the check history last, below the record table", async () => {
		let harness = await createHarness();

		let body = await (await harness.visit()).text();

		// A placeholder's id is generated, so the frames are told apart by where they sit —
		// which is the same thing the assertion is about.
		let [summary, uptimeHistory, checkHistory] = frameOffsets(body);
		let records = body.indexOf(en.page.dnsMonitorDetail.records.title);

		expect(frameOffsets(body)).toHaveLength(3);
		expect(uptimeHistory).toBeGreaterThan(summary ?? -1);
		expect(records).toBeGreaterThan(uptimeHistory ?? -1);
		expect(checkHistory).toBeGreaterThan(records);
	});

	/**
	 * The record table is rendered inline, between the frames, and a browser hoists content
	 * it finds directly inside a table out of it — carrying everything that follows along.
	 * The check-history placeholder sits directly below it, so a stray element in a row
	 * would move the very region the client is waiting to fill.
	 */
	test("emits the record table with nothing a browser would hoist out of it", async () => {
		let harness = await createHarness();

		let body = await (await harness.visit()).text();

		expect(body).toContain(en.page.dnsMonitorDetail.records.actions.disable);
		expect(fosterParentedContent(body)).toEqual([]);
	});

	/**
	 * `StatCardSkeleton` renders bare cards deliberately, so several frames can share one
	 * row a caller lays out. This page's frames each stand alone, so each has to open its
	 * fallback with a row of its own — without one the placeholder cards stack flush, which
	 * is not the shape any fragment resolves to.
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
	 * A fallback of the wrong height moves the page when the frame swaps out, so the number
	 * of placeholder cards has to be the number the fragment resolves to. The summary is two
	 * cards — success rate and total checks — since the average-response-time card was
	 * dropped, and a stale three-card fallback would leave a card-wide hole behind.
	 */
	test("holds exactly as many placeholder cards as the summary resolves to", async () => {
		let harness = await createHarness();

		let body = await (await harness.visit()).text();

		let [summary, uptimeHistory] = frameOffsets(body);
		let fallback = body.slice(summary, uptimeHistory);

		// `Card` renders as a tinted `<section>`, so one match is one placeholder card.
		expect([...fallback.matchAll(/<section data-color=/g)]).toHaveLength(2);
	});

	/**
	 * A fragment that throws before it has a response at all. Frame resolution rejects, and a
	 * rejection streams no `<template>` — so the client's frame never resolves and the
	 * skeleton is what the visitor keeps. A failure has to become content, and the surviving
	 * frame has to arrive regardless.
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
		// The failure is contained: the other frame still resolves.
		expect(body).toContain(en.page.dnsMonitorDetail.uptimeHistory);
	});

	/**
	 * The half the first fix missed, and the one every real fragment failure takes. A
	 * fragment's response exists before its HTML does — `ctx.render` returns the moment its
	 * stream is created — so a component that throws, or a query that rejects part-way
	 * through the tree, fails *after* the response has been handed back. Left as a stream,
	 * that failure lands inside the renderer, which drops the template and says nothing; the
	 * page then looks precisely like one whose fragment was never requested.
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
