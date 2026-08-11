/**
 * Tests for the DNS monitor detail page controller. `~/app/data/dns-monitor` doesn't
 * import `cloudflare:workers`, so no module mock is needed here. `getViewer()`/
 * `ctx.team`/`ctx.membership`/`ctx.teams` are seeded directly by a fake middleware
 * standing in for the real `auth`/`requireUser`/`requireTeam` chain. The uptime bar and the
 * check history live behind `Frame`s, so what is asserted of those is the frames themselves;
 * the record list renders inline and is asserted in full, including the two readings the
 * data makes non-obvious — an RRset edit arriving as a removal plus an addition, and a
 * declared-but-unresolved record that is routine rather than broken.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { Middleware, RequestContext, RequestHandler } from "remix/fetch-router";
import type { RemixNode } from "remix/ui";

import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Auth } from "remix/auth-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { renderWith } from "remix/render-middleware";
import { renderToStream } from "remix/ui/server";

import type { Viewer } from "~/app/http/middleware/auth";
import type { InsertDnsMonitorRecord, SelectMembership, SelectTeam } from "~/database/schema";

import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import { dnsMonitorRecords, dnsMonitors, memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

let { handler } = (await import("./dns-monitor-show")).default as { handler: RequestHandler<any> };

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

/** Inserts one tracked record, defaulting to a watched record that resolved. */
async function seedRecord(
	db: Database,
	monitorId: string,
	overrides: Partial<InsertDnsMonitorRecord> &
		Pick<InsertDnsMonitorRecord, "name" | "record_type" | "value">,
) {
	return await db.create(
		dnsMonitorRecords,
		{
			id: crypto.randomUUID(),
			dns_monitor_id: monitorId,
			source: "resolver",
			is_enabled: true,
			status: "ok",
			first_seen_at: 0,
			last_seen_at: 0,
			last_checked_at: 0,
			...overrides,
		},
		{ touch: true, returnRow: true },
	);
}

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

/** How many elements the page draws in the destructive tone, the signal "something is wrong". */
function dangerCount(html: string): number {
	return html.match(/data-color="danger"/g)?.length ?? 0;
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

/** Minimal request-scoped HTML renderer standing in for `bootstrap/app.tsx`'s `createHtmlRenderer`. Frame resolution isn't exercised by a single-request page test, so `resolveFrame` is a no-op. */
function createHtmlRenderer(ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit): Response {
		let stream = renderToStream(node, { frameSrc: ctx.request.url, resolveFrame: async () => "" });
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(stream, { ...init, headers });
	};
}

/** Sends a GET request through a minimal router mapping a single page route. */
async function send(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	monitorId: string,
): Promise<Response> {
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({ middleware: [asyncContext()] });
	router.map(routes.app.team.dnsMonitors.show, {
		middleware: [seedTeam(team, membership), i18n, renderWith(createHtmlRenderer) as Middleware],
		handler,
	});

	let request = new Request(
		new URL(
			routes.app.team.dnsMonitors.show.href({ team: team.slug, monitorId }),
			"https://uptime.test",
		),
	);

	return container.scope(() => router.fetch(request));
}

describe("dnsMonitorShow", () => {
	test("renders the monitor's configuration and the fragment frames", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			dnsMonitors,
			{
				id: crypto.randomUUID(),
				team_id: team.id,
				name: "Production DNS",
				domain: "example.com",
			},
			{ touch: true, returnRow: true },
		);

		let response = await send(db, team, membership, monitor.id);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain("Production DNS");
		expect(body).toContain("example.com");
		// The history bar and the result table are their own fragments now, so the page
		// only promises the frames that will fetch them.
		expect(body).toContain(
			routes.app.team.dnsMonitors.cards.uptimeHistory.href({
				team: team.slug,
				monitorId: monitor.id,
			}),
		);
		expect(body).toContain(
			routes.app.team.dnsMonitors.cards.results.href({ team: team.slug, monitorId: monitor.id }),
		);
	});

	test("lists every tracked record with its state and a control that says what watching it would do", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			dnsMonitors,
			{ id: crypto.randomUUID(), team_id: team.id, name: "Acme DNS", domain: "acme.test" },
			{ touch: true, returnRow: true },
		);

		await seedRecord(db, monitor.id, {
			name: "acme.test",
			record_type: "MX",
			value: "10 mail.acme.test",
			status: "ok",
		});
		await seedRecord(db, monitor.id, {
			name: "acme.test",
			record_type: "MX",
			value: "20 mail.attacker.test",
			source: "resolver",
			is_enabled: false,
			status: "new",
		});

		let body = await (await send(db, team, membership, monitor.id)).text();

		expect(body).toContain("10 mail.acme.test");
		expect(body).toContain("20 mail.attacker.test");
		expect(body).toContain("New");
		// One of two records is watched, and the discovered one offers the act of accepting
		// it while the accepted one offers the reverse.
		expect(body).toContain("1 of 2");
		expect(body).toContain("Watch");
		expect(body).toContain("Stop watching");
		expect(body).toContain(routes.actions.monitor.dns.toggleRecord.href({ team: team.slug }));
	});

	/**
	 * "Stop watching" is a phrase, not a word, and a column sized for the header broke it
	 * over two lines — which made every row in the table taller. The column has to size to
	 * its content instead, which is `1%` plus a cell that refuses to wrap.
	 */
	test("sizes the watch column to its control, so the longer label stays on one line", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			dnsMonitors,
			{ id: crypto.randomUUID(), team_id: team.id, name: "Acme DNS", domain: "acme.test" },
			{ touch: true, returnRow: true },
		);

		await seedRecord(db, monitor.id, { name: "acme.test", record_type: "A", value: "192.0.2.1" });

		let body = await (await send(db, team, membership, monitor.id)).text();

		// The records table is the only one this page renders inline — the check history is
		// behind a frame this harness resolves to nothing — so the last header cell and the
		// last body cell in the document are the watch column's.
		let header = [...body.matchAll(/<th[^>]*class="([^"]*)"/g)].at(-1);
		let cell = [...body.matchAll(/<td[^>]*class="([^"]*)"/g)].at(-1);

		for (let match of [header, cell]) {
			let declarations = declarationsFor(body, match?.[1] ?? "");
			expect(declarations).toContain("white-space: nowrap");
			expect(declarations).toContain("inline-size: 1%");
		}
	});

	/**
	 * A record identified by `(name, type, value)` cannot express an edit inside an RRset
	 * that holds more than one record: the old value stops resolving and the new one has no
	 * row, so the page must show both, side by side, rather than claim a single change.
	 */
	test("shows an edit inside a multi-record RRset as the removal and the addition it is", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			dnsMonitors,
			{ id: crypto.randomUUID(), team_id: team.id, name: "Acme DNS", domain: "acme.test" },
			{ touch: true, returnRow: true },
		);

		await seedRecord(db, monitor.id, {
			name: "acme.test",
			record_type: "MX",
			value: "10 old.acme.test",
			status: "missing",
		});
		await seedRecord(db, monitor.id, {
			name: "acme.test",
			record_type: "MX",
			value: "10 new.acme.test",
			is_enabled: false,
			status: "new",
		});

		let body = await (await send(db, team, membership, monitor.id)).text();

		expect(body).toContain("Missing");
		expect(body).toContain("New");
		expect(body).not.toContain("Changed");
	});

	/**
	 * On a proxied zone a record the customer's own zone file declares routinely does not
	 * resolve at all, so an unwatched `missing` record is the common case and must not be
	 * drawn in the tone reserved for something being wrong.
	 */
	test("draws a declared but unresolved record neutrally, and a watched missing one as a failure", async () => {
		let { db, team, membership } = await createFixture();
		let monitor = await db.create(
			dnsMonitors,
			{ id: crypto.randomUUID(), team_id: team.id, name: "Acme DNS", domain: "acme.test" },
			{ touch: true, returnRow: true },
		);

		// The page draws destructively-toned controls of its own, so what is asserted is the
		// change each record makes rather than the presence of the tone anywhere on it.
		let baseline = dangerCount(await (await send(db, team, membership, monitor.id)).text());

		await seedRecord(db, monitor.id, {
			name: "proxied.acme.test",
			record_type: "A",
			value: "192.0.2.1",
			source: "zone_file",
			is_enabled: false,
			status: "missing",
			last_seen_at: null,
		});

		let declaredOnly = await (await send(db, team, membership, monitor.id)).text();
		expect(declaredOnly).toContain("Zone file");
		expect(dangerCount(declaredOnly)).toBe(baseline);

		await seedRecord(db, monitor.id, {
			name: "acme.test",
			record_type: "A",
			value: "192.0.2.9",
			status: "missing",
		});

		let withWatched = await (await send(db, team, membership, monitor.id)).text();
		expect(dangerCount(withWatched)).toBe(baseline + 1);
	});

	test("404s for a monitor that doesn't belong to the team", async () => {
		let { db, team, membership } = await createFixture();

		let response = await send(db, team, membership, crypto.randomUUID());
		expect(response.status).toBe(404);
	});
});
