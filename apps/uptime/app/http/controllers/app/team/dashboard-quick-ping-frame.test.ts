/**
 * Tests the no-JavaScript path of the dashboard's quick check end to end: the header
 * form posts to `run-ping`, which redirects to the dashboard document, and that
 * document server-side-resolves its quick-check `<Frame>` through the same router
 * with the cookie forwarded — two requests, one session, since a session flash used
 * to carry the result was cleared before the frame read it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { PolarClient as PolarClientType } from "@pkg/polar";
import type { Middleware, RequestContext, RequestHandler, Router } from "remix/router";
import type { RemixNode } from "remix/ui";
import type { ResolveFrameContext } from "remix/ui/server";

import {
	createAnalyticsEngine,
	createDurableObjectNamespace,
	createEnv,
} from "@pkg/cloudflare-mocks";
import { createTranslator } from "@pkg/i18n";
import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { createCookie } from "remix/cookie";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { formData } from "remix/middleware/form-data";
import { renderWith } from "remix/middleware/render";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { createMemorySessionStorage } from "remix/session-storage/memory";
import { renderToStream } from "remix/ui/server";
import { describe, expect, test, vi } from "vitest";

import type { GeoFetchDO } from "~/app/do/geo-fetch";
import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import en from "~/app/locales/en";
import { memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

/** The `GeoFetchDO` stub every probe goes through: one healthy answer, in 12 ms. */
async function probe() {
	return new Response("OK", { status: 200, headers: { "X-Response-Time": "12" } });
}

/** The `GEO_FETCH` binding, routing every object it hands out to {@link probe}. */
let geoFetch = createDurableObjectNamespace<GeoFetchDO>(() => ({ fetch: probe }));

/** Work the action deferred, drained by {@link createHarness}'s `submit` before it returns. */
let deferred: Promise<unknown>[] = [];

/** The check's data point; nothing here asserts on it, but it has to land somewhere. */
let pingResults = createAnalyticsEngine();

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({
		GEO_FETCH: geoFetch,
		PING_RESULTS: pingResults,
	}),
	waitUntil: (promise: Promise<unknown>) => {
		deferred.push(promise);
	},
	/** Never instantiated here; `~/app/do/geo-fetch` extends it at module load. */
	DurableObject: class {},
}));

/**
 * The three handlers a no-JavaScript submit passes through, in the order it hits them.
 * Each is narrowed to its handler because an `Action` is either a function or this shape,
 * and only the handler is mapped here — the real `requireUser`/`requireTeam` chain each
 * carries needs a sign-in this harness has no way to perform.
 */
type Mapped = { handler: RequestHandler<RequestContext> };

let { runPing } = (await import("~/app/http/controllers/actions/ping")) as unknown as {
	runPing: Mapped;
};
let dashboard = (await import("./dashboard")).default as Mapped;
let quickPing = (await import("./dashboard-quick-ping")).default as Mapped;

/** The entitlement gate logs every inconclusive lookup; the assertions read the HTML. */
vi.spyOn(console, "info").mockImplementation(() => {});

let BASE_URL = "https://uptime.test";

let { i18n: i18nextInstance } = await createTranslator({
	resources: { en: { translation: en } },
	supportedLanguages: ["en"],
	fallbackLanguage: "en",
})();

let sessionCookie = createCookie("uptime-test-session", { secrets: ["test-secret"] });
let sessionStorage = createMemorySessionStorage();

/** Billing is the one dependency held as a double; nothing here asserts on it. */
let polar = {
	async ingestEventsSafe() {
		return true;
	},
} as unknown as PolarClientType;

/**
 * Fetches a frame's HTML through the router the document is being rendered by, forwarding
 * the request's cookie — `bootstrap/app.tsx`'s `resolveFrame`, minus the redirect chasing
 * no route here performs. Stubbing this out is what kept the flash bug invisible, so it is
 * the one piece of the renderer that has to be real.
 */
async function resolveFrame(
	router: Router,
	request: Request,
	src: string,
	target?: string,
	context?: ResolveFrameContext,
) {
	let url = new URL(src, context?.currentFrameSrc ?? request.url);
	let headers = new Headers({ accept: "text/html", "x-remix-frame": "true" });
	if (target) headers.set("x-remix-target", target);

	let cookie = request.headers.get("cookie");
	if (cookie) headers.set("cookie", cookie);

	let response = await router.fetch(new Request(url, { method: "GET", headers }));
	if (response.body) return response.body;
	if (response.ok) return response.text();
	return `<pre>Frame error: ${response.status} ${response.statusText}</pre>`;
}

/** Request-scoped HTML renderer mirroring `bootstrap/app.tsx`'s, frame resolution and all. */
function createHtmlRenderer(ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit) {
		let stream = renderToStream(node, {
			frameSrc: ctx.request.url,
			resolveFrame(src, target, context) {
				return resolveFrame(ctx.router, ctx.request, src, target, context);
			},
		});

		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");

		return new Response(stream, { ...init, headers });
	};
}

/** Seeds `ctx.team`/`ctx.membership`/auth/i18next state, standing in for the real chain. */
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
		ctx.locale = "en";
		ctx.i18next = i18nextInstance;
		ctx.set(Auth, { ok: true, identity: viewer, method: "test" });
		return next();
	};
}

/**
 * A browser's cookie jar: folds a response's `Set-Cookie`s in and hands back the `Cookie`
 * header to send next. The dashboard document answers with its tab cookie and — when the
 * session stayed clean, which is the point — no session cookie at all, so carrying the jar
 * rather than the last response's headers is what keeps the session alive across requests.
 */
function updateJar(jar: Map<string, string>, response: Response): string {
	for (let header of response.headers.getSetCookie()) {
		let pair = header.split(";")[0] ?? "";
		let separator = pair.indexOf("=");
		if (separator === -1) continue;
		jar.set(pair.slice(0, separator), pair.slice(separator + 1));
	}

	return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

/**
 * One signed-in visitor on one team, with the three routes a no-JavaScript quick check
 * touches mapped on a single router, and a cookie jar carried between their requests.
 */
async function createHarness() {
	let { db } = createTestDatabase();

	let team = await db.create(
		teams,
		{
			id: crypto.randomUUID(),
			owner_id: crypto.randomUUID(),
			name: "Acme",
			slug: `acme-${crypto.randomUUID()}`,
			logo: null,
		},
		{ touch: true, returnRow: true },
	);
	let membership = await db.create(
		memberships,
		{ id: crypto.randomUUID(), subject_id: "member-1", team_id: team.id, role: "admin" },
		{ touch: true, returnRow: true },
	);

	let router = createRouter({
		middleware: [
			asyncContext(),
			session(sessionCookie, sessionStorage),
			formData(),
			renderWith(createHtmlRenderer) as Middleware,
		],
	});

	/**
	 * `router.map` itself is cast rather than the handlers, because the session middleware
	 * widens the router's context while the handlers are written against the plain one —
	 * casting a handler would be casting away the context it does use.
	 */
	let map = router.map.bind(router) as (target: unknown, action: unknown) => void;
	let mapped = { middleware: [seedTeam(team, membership)] };

	map(routes.actions.runPing, { ...mapped, handler: runPing.handler });
	map(routes.app.team.dashboard.index, { ...mapped, handler: dashboard.handler });
	map(routes.app.team.dashboard.quickPing, { ...mapped, handler: quickPing.handler });

	let container = new ServiceContainer();
	container.instance(Database, db);
	container.instance(PolarClient, polar);

	let jar = new Map<string, string>();
	let cookie = "";

	return {
		team,

		/** Submits the quick-check form the way a browser with no JavaScript submits it. */
		async submit(url: string) {
			let request = new Request(
				new URL(routes.actions.runPing.href({ team: team.slug }), BASE_URL),
				{
					method: "POST",
					headers: { "content-type": "application/x-www-form-urlencoded", cookie },
					body: new URLSearchParams({ url }),
				},
			);

			let response = await container.scope(() => router.fetch(request));
			// The platform settles deferred work after the response; this stands in for that.
			await Promise.all(deferred.splice(0));
			cookie = updateJar(jar, response);

			return response;
		},

		/** Follows the redirect: the dashboard document, with its frames resolved. */
		async visitDashboard() {
			let request = new Request(
				new URL(routes.app.team.dashboard.index.href({ team: team.slug }), BASE_URL),
				{ headers: { cookie } },
			);

			let response = await container.scope(() => router.fetch(request));
			cookie = updateJar(jar, response);

			return response;
		},
	};
}

describe("the dashboard's quick-check frame, resolved server-side", () => {
	test("resolves the quick-check fragment into the document rather than leaving a placeholder", async () => {
		let harness = await createHarness();

		let body = await (await harness.visitDashboard()).text();

		// The bar's own markup, which only the fragment route renders: if frame resolution
		// were stubbed out, everything below would be asserting on an empty string.
		expect(body).toContain(en.page.dashboard.quickPing.field.label);
		expect(body).toContain(en.page.dashboard.quickPing.action.submit);
		expect(body).toContain(`action="${routes.actions.runPing.href({ team: harness.team.slug })}"`);
		// Nothing has run, so the header is the bar alone, with no toast beside it.
		expect(body).not.toContain("HTTP 200");
		expect(body).not.toContain("12 ms");
	});

	test("renders the result on the dashboard a no-JavaScript submit is redirected to", async () => {
		let harness = await createHarness();

		let posted = await harness.submit("https://example.com/health");
		expect(posted.status).toBe(303);
		expect(posted.headers.get("Location")).toBe(
			routes.app.team.dashboard.index.href({ team: harness.team.slug }),
		);

		let body = await (await harness.visitDashboard()).text();

		// The document request and the fragment request it dispatches share one session, and
		// the document's own save must not have taken the result with it before the fragment
		// read it — the failure the flash used to produce was this card, empty.
		expect(body).toContain(en.page.dashboard.quickPing.result.status.up);
		expect(body).toContain("HTTP 200");
		expect(body).toContain("12 ms");
		// The redirect cleared the form, so the target is put back into it. Asserted as the
		// attribute, since the placeholder is a URL that starts the same way.
		expect(body).toContain('value="https://example.com/health"');
	});

	test("shows the result once, so reloading the dashboard comes back to an empty form", async () => {
		let harness = await createHarness();

		await harness.submit("https://example.com/health");
		expect(await (await harness.visitDashboard()).text()).toContain("HTTP 200");

		// Same session, same jar, immediately again: a result that survived the render would
		// be attributed to a check nobody just ran. The fragment's own `unset` is what clears
		// it, and this is where that has to have happened.
		let body = await (await harness.visitDashboard()).text();
		expect(body).not.toContain("HTTP 200");
		expect(body).not.toContain("12 ms");
		expect(body).toContain(en.page.dashboard.quickPing.action.submit);
	});

	test("leaves the session untouched by the document request that carries the result", async () => {
		let harness = await createHarness();

		let posted = await harness.submit("https://example.com/health");
		// The action wrote the result, so its own save persisted the session.
		expect(posted.headers.getSetCookie().join("; ")).toContain("uptime-test-session=");

		let visited = await harness.visitDashboard();

		// The document request only reads: it must save nothing, because its save runs before
		// the frames resolve and would write back a session the fragment had not read yet.
		let setCookies = visited.headers.getSetCookie();
		expect(setCookies.join("; ")).not.toContain("uptime-test-session=");
		expect(setCookies.join("; ")).toContain("uptime:dashboard-tab");
		expect(await visited.text()).toContain("HTTP 200");
	});
});
