/**
 * Tests for the DNS monitor review page controller. The page renders from two reads — the
 * monitor row and its records — plus a one-render session flash carrying what a pasted zone
 * file could not be read as, so the fixtures here seed all three: `getViewer()`/`ctx.team`/
 * `ctx.membership`/`ctx.teams` come from a fake middleware standing in for the real
 * `auth`/`requireUser`/`requireTeam` chain, and the report is flashed by an earlier request
 * against a real session, which is the only way this page ever sees one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext, RequestHandler } from "remix/router";
import type { RemixNode } from "remix/ui";

import { ServiceContainer } from "@pkg/service-container";
import { createCookie } from "remix/cookie";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { Session } from "remix/session";
import { createMemorySessionStorage } from "remix/session-storage/memory";
import { renderToStream } from "remix/ui/server";
import { describe, expect, test } from "vitest";

import type { Viewer } from "~/app/http/middleware/auth";
import type { InsertDnsMonitorRecord, SelectMembership, SelectTeam } from "~/database/schema";

import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import en from "~/app/locales/en";
import { MAX_TRACKED_NAMES_PER_MONITOR } from "~/app/services/dns-discovery";
import { dnsMonitorRecords, dnsMonitors, memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

import type { DnsZoneFileReport } from "./dns-monitor-review";

import { DNS_ZONE_FILE_REPORT } from "./dns-monitor-review";

let { handler } = (await import("./dns-monitor-review")).default as {
	handler: RequestHandler<any>;
};

/**
 * Matches a ticked record checkbox by the presence of the `checked` attribute itself,
 * since a browser treats `checked="0"` as ticked and `:checked` styles key off presence
 * alone rather than the attribute's value.
 */
const TICKED = /name="record_ids"[^>]*\schecked(?=[\s/>])/g;

let sessionCookie = createCookie("uptime-test-session", { secrets: ["test-secret"] });
let sessionStorage = createMemorySessionStorage();

/** Every column a record row needs, so a test only states the parts it is about. */
function record(
	monitorId: string,
	values: Partial<InsertDnsMonitorRecord> & Pick<InsertDnsMonitorRecord, "name" | "value">,
): InsertDnsMonitorRecord {
	return {
		id: crypto.randomUUID(),
		dns_monitor_id: monitorId,
		record_type: "A",
		source: "resolver",
		is_enabled: true,
		status: "ok",
		first_seen_at: 1,
		last_seen_at: 1,
		last_checked_at: 1,
		...values,
	};
}

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
	let monitor = await db.create(
		dnsMonitors,
		{
			id: crypto.randomUUID(),
			team_id: team.id,
			name: "Acme DNS",
			domain: "example.com",
			zone_file_imported_at: null,
			interval_seconds: 86_400,
			next_due_at: null,
			is_enabled: true,
			last_checked_at: null,
			last_status: null,
		},
		{ touch: true, returnRow: true },
	);

	return { db, team, membership, monitor };
}

/** Middleware that seeds `ctx.team`/`ctx.membership`/`ctx.teams`/auth state, standing in for the real chain. */
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

/** Minimal request-scoped HTML renderer standing in for `bootstrap/app.tsx`'s `createHtmlRenderer`. */
function createHtmlRenderer(ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit): Response {
		let stream = renderToStream(node, { frameSrc: ctx.request.url });
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(stream, { ...init, headers });
	};
}

/** Reads the `Set-Cookie`s of a response back into a `Cookie` request header. */
function cookieHeader(response: Response): string {
	return response.headers
		.getSetCookie()
		.map((value) => value.split(";")[0])
		.join("; ");
}

/** Renders the review page, optionally after an earlier request flashed a zone-file report. */
async function send(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	monitorId: string,
	report?: DnsZoneFileReport,
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [asyncContext(), session(sessionCookie, sessionStorage)],
	});
	router.map(routes.app.team.dnsMonitors.review, {
		middleware: [seedTeam(team, membership), i18n, renderWith(createHtmlRenderer) as Middleware],
		handler,
	});
	router.post("/flash", (ctx) => {
		if (report) ctx.get(Session)?.flash(DNS_ZONE_FILE_REPORT, report);
		return new Response(null, { status: 204 });
	});

	let url = new URL(
		routes.app.team.dnsMonitors.review.href({ team: team.slug, monitorId }),
		"https://uptime.test",
	);

	let cookie = "";
	if (report) {
		let flashed = await container.scope(() =>
			router.fetch(new Request("https://uptime.test/flash", { method: "POST" })),
		);
		cookie = cookieHeader(flashed);
	}

	return container.scope(() =>
		router.fetch(new Request(url, cookie ? { headers: { Cookie: cookie } } : undefined)),
	);
}

describe("dnsMonitorReview", () => {
	test("404s for a monitor belonging to another team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership, crypto.randomUUID());

		expect(response.status).toBe(404);
	});

	test("lists resolving records, every one of them already ticked", async () => {
		let { db, team, membership, monitor } = await createFixture();
		await db.create(
			dnsMonitorRecords,
			record(monitor.id, { name: "example.com", value: "192.0.2.1" }),
			{ touch: true },
		);
		await db.create(
			dnsMonitorRecords,
			record(monitor.id, { name: "example.com", record_type: "MX", value: "10 mx.example.com" }),
			{ touch: true },
		);

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain('id="dns-review-resolving"');
		expect(body).toContain("192.0.2.1");
		expect(body).toContain("10 mx.example.com");
		expect(body.match(/name="record_ids"/g)).toHaveLength(2);
		expect(body.match(TICKED)).toHaveLength(2);
		expect(body).toContain(routes.actions.monitor.dns.review.href({ team: team.slug }));
		expect(body).toContain(`value="${monitor.id}"`);
	});

	test("lays the records out as a table with its own columns", async () => {
		let { db, team, membership, monitor } = await createFixture();
		await db.create(
			dnsMonitorRecords,
			record(monitor.id, {
				name: "dkim._domainkey.example.com",
				record_type: "TXT",
				value: `v=DKIM1; k=rsa; p=${"A".repeat(400)}`,
			}),
			{ touch: true },
		);

		let body = await (await send(db, team, membership, monitor.id)).text();

		expect(body).toContain("<table");
		expect(body).toContain(en.page.dnsMonitorReview.table.columns.name);
		expect(body).toContain(en.page.dnsMonitorReview.table.columns.type);
		expect(body).toContain(en.page.dnsMonitorReview.table.columns.value);
		expect(body).toContain(en.page.dnsMonitorReview.table.columns.watched);
		expect(body).toContain("max-block-size: 3lh;");
		expect(body).toContain(`v=DKIM1; k=rsa; p=${"A".repeat(400)}`);
	});

	test("keeps a newly appeared record in its own group, unticked", async () => {
		let { db, team, membership, monitor } = await createFixture();
		await db.create(
			dnsMonitorRecords,
			record(monitor.id, {
				name: "example.com",
				value: "203.0.113.9",
				status: "new",
				is_enabled: false,
			}),
			{ touch: true },
		);

		let body = await (await send(db, team, membership, monitor.id)).text();

		expect(body).toContain('id="dns-review-discovered"');
		expect(body).not.toContain('id="dns-review-resolving"');
		expect(body).not.toMatch(TICKED);
	});

	test("groups a declared-but-not-resolving record apart, and does not call it broken", async () => {
		let { db, team, membership, monitor } = await createFixture();
		await db.create(
			dnsMonitorRecords,
			record(monitor.id, {
				name: "gh.example.com",
				record_type: "CNAME",
				value: "sergiodxa.github.io",
				source: "zone_file",
				status: "missing",
				is_enabled: false,
				last_seen_at: null,
			}),
			{ touch: true },
		);

		let body = await (await send(db, team, membership, monitor.id)).text();

		expect(body).toContain('id="dns-review-declared"');
		expect(body).toContain('id="dns-review-proxied-note"');
		expect(body).not.toMatch(TICKED);
	});

	test("reports every unreadable line with its number and its reason", async () => {
		let { db, team, membership, monitor } = await createFixture();
		await db.create(
			dnsMonitorRecords,
			record(monitor.id, { name: "example.com", value: "192.0.2.1" }),
			{ touch: true },
		);

		let body = await (
			await send(db, team, membership, monitor.id, {
				rejected: [
					{ line: 3, input: "$ORIGIN example.com.", reason: "originDirective" },
					{
						line: 9,
						input: 'example.com. 1 IN CAA 0 issue "letsencrypt.org"',
						reason: "unsupportedType",
					},
				],
				duplicates: [],
			})
		).text();

		expect(body).toContain('id="dns-review-unparsed"');
		expect(body).toContain("$ORIGIN example.com.");
		expect(body).toContain(en.page.dnsMonitorReview.unparsed.reasons.originDirective);
		expect(body).toContain(en.page.dnsMonitorReview.unparsed.reasons.unsupportedType);
	});

	test("keeps duplicates out of the not-imported count, since they were imported", async () => {
		let { db, team, membership, monitor } = await createFixture();
		await db.create(
			dnsMonitorRecords,
			record(monitor.id, { name: "example.com", value: "192.0.2.1" }),
			{ touch: true },
		);

		let body = await (
			await send(db, team, membership, monitor.id, {
				rejected: [],
				duplicates: [
					{
						line: 12,
						input: "example.com. 1 IN A 192.0.2.1",
						firstLine: 4,
						name: "example.com",
						type: "A",
					},
				],
			})
		).text();

		expect(body).toContain('id="dns-review-duplicates"');
		expect(body).not.toContain('id="dns-review-unparsed"');
	});

	test("renders no report block when the last request left none", async () => {
		let { db, team, membership, monitor } = await createFixture();
		await db.create(
			dnsMonitorRecords,
			record(monitor.id, { name: "example.com", value: "192.0.2.1" }),
			{ touch: true },
		);

		let body = await (await send(db, team, membership, monitor.id)).text();

		expect(body).not.toContain('id="dns-review-unparsed"');
		expect(body).not.toContain('id="dns-review-duplicates"');
	});

	test("refuses to save a monitor carrying more names than one sweep can cover", async () => {
		let { db, team, membership, monitor } = await createFixture();
		for (let index = 0; index <= MAX_TRACKED_NAMES_PER_MONITOR; index++) {
			await db.create(
				dnsMonitorRecords,
				record(monitor.id, { name: `n${index}.example.com`, value: `192.0.2.${index % 255}` }),
				{ touch: true },
			);
		}

		let body = await (await send(db, team, membership, monitor.id)).text();

		expect(body).toContain('id="dns-review-names-cap"');
		expect(body).toContain("disabled");
	});

	test("saves without complaint at exactly the name cap", async () => {
		let { db, team, membership, monitor } = await createFixture();
		for (let index = 0; index < MAX_TRACKED_NAMES_PER_MONITOR; index++) {
			await db.create(
				dnsMonitorRecords,
				record(monitor.id, { name: `n${index}.example.com`, value: `192.0.2.${index % 255}` }),
				{ touch: true },
			);
		}

		let body = await (await send(db, team, membership, monitor.id)).text();

		expect(body).not.toContain('id="dns-review-names-cap"');
	});

	test("says so plainly when discovery found nothing at all", async () => {
		let { db, team, membership, monitor } = await createFixture();

		let body = await (await send(db, team, membership, monitor.id)).text();

		expect(body).not.toContain('name="record_ids"');
		expect(body).toContain("Nothing was found for this domain.");
	});
});
