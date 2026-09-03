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

import type { Middleware, RequestContext, RequestHandler, Router } from "remix/router";
import type { RemixNode } from "remix/ui";
import type { ResolveFrameContext } from "remix/ui/server";

import billing from "@sdxc/billing/middleware";
import {
	createAnalyticsEngine,
	createDurableObjectNamespace,
	createEnv,
} from "@sdxc/cloudflare-mocks";
import { createTranslator } from "@sdxc/i18n";
import { ServiceContainer } from "@sdxc/service-container";
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

import { createTestBilling } from "~/app/lib/test/billing";
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

/** The check's data point, landing in Analytics Engine the way production writes it. */
let pingResults = createAnalyticsEngine();

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({
		GEO_FETCH: geoFetch,
		PING_RESULTS: pingResults,
	}),
	waitUntil: (promise: Promise<unknown>) => {
		deferred.push(promise);
	},
	/** A type-only stand-in that `~/app/do/geo-fetch` extends at module load. */
	DurableObject: class {},
}));

/**
 * The three handlers a no-JavaScript submit passes through, narrowed to their handler:
 * an `Action` is either a function or this shape, and only the handler is mapped,
 * since the real `requireUser`/`requireTeam` chain needs a sign-in this harness cannot perform.
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

/**
 * Fetches a frame's HTML through the router the document is rendered by —
 * the same shape as `bootstrap/app.tsx`'s `resolveFrame`, minus the redirect
 * chasing no route here needs. Stubbing this out hid the flash bug, so it has to stay real.
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
 * A browser's cookie jar: folds each response's `Set-Cookie`s in and returns
 * the `Cookie` header for the next request, accumulating across requests so
 * a session cookie set once stays attached after later responses answer with just a tab cookie.
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
			billing({ provider: createTestBilling() }),
			session(sessionCookie, sessionStorage),
			formData(),
			renderWith(createHtmlRenderer) as Middleware,
		],
	});

	/**
	 * The cast lives on `router.map`, since the session middleware widens the
	 * router's context while each handler keeps its plain, unwidened context
	 * type — the cast absorbs that mismatch in one place.
	 */
	let map = router.map.bind(router) as (target: unknown, action: unknown) => void;
	let mapped = { middleware: [seedTeam(team, membership)] };

	map(routes.actions.runPing, { ...mapped, handler: runPing.handler });
	map(routes.app.team.dashboard.index, { ...mapped, handler: dashboard.handler });
	map(routes.app.team.dashboard.quickPing, { ...mapped, handler: quickPing.handler });

	let container = new ServiceContainer();
	container.instance(Database, db);

	let jar = new Map<string, string>();
	let cookie = "";

	return {
		team,

		/**
		 * Submits the quick-check form the way a browser with no JavaScript submits
		 * it, draining the deferred work the real platform would settle after the
		 * response on its own.
		 */
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
	/**
	 * These assertions double as proof that frame resolution ran: the bar's
	 * markup exists only where the fragment route renders it, and — since
	 * nothing has been submitted yet — the header carries just the bar, with no result toast.
	 */
	test("resolves the quick-check fragment into the document rather than leaving a placeholder", async () => {
		let harness = await createHarness();

		let body = await (await harness.visitDashboard()).text();

		expect(body).toContain(en.page.dashboard.quickPing.field.label);
		expect(body).toContain(en.page.dashboard.quickPing.action.submit);
		expect(body).toContain(`action="${routes.actions.runPing.href({ team: harness.team.slug })}"`);
		expect(body).not.toContain("HTTP 200");
		expect(body).not.toContain("12 ms");
	});

	/**
	 * The redirect clears the query string, so the submitted target has to come
	 * back through the stored result to repopulate the field. Checked via the
	 * `value` attribute, since the placeholder text is a URL that starts the same way.
	 */
	test("renders the result on the dashboard a no-JavaScript submit is redirected to", async () => {
		let harness = await createHarness();

		let posted = await harness.submit("https://example.com/health");
		expect(posted.status).toBe(303);
		expect(posted.headers.get("Location")).toBe(
			routes.app.team.dashboard.index.href({ team: harness.team.slug }),
		);

		let body = await (await harness.visitDashboard()).text();

		expect(body).toContain(en.page.dashboard.quickPing.result.status.up);
		expect(body).toContain("HTTP 200");
		expect(body).toContain("12 ms");
		expect(body).toContain('value="https://example.com/health"');
	});

	/**
	 * Reloaded with the same session and jar right away, so the fragment's own
	 * `unset` call is what has to have cleared the result by now — nothing else
	 * runs between requests to do it.
	 */
	test("shows the result once, so reloading the dashboard comes back to an empty form", async () => {
		let harness = await createHarness();

		await harness.submit("https://example.com/health");
		expect(await (await harness.visitDashboard()).text()).toContain("HTTP 200");

		let body = await (await harness.visitDashboard()).text();
		expect(body).not.toContain("HTTP 200");
		expect(body).not.toContain("12 ms");
		expect(body).toContain(en.page.dashboard.quickPing.action.submit);
	});

	/**
	 * The document's session middleware saves before its child frame resolves,
	 * so leaving this request's session unsaved is what lets the fragment's own
	 * read-and-clear be the write that actually persists.
	 */
	test("leaves the session untouched by the document request that carries the result", async () => {
		let harness = await createHarness();

		let posted = await harness.submit("https://example.com/health");
		expect(posted.headers.getSetCookie().join("; ")).toContain("uptime-test-session=");

		let visited = await harness.visitDashboard();

		let setCookies = visited.headers.getSetCookie();
		expect(setCookies.join("; ")).not.toContain("uptime-test-session=");
		expect(setCookies.join("; ")).toContain("uptime:dashboard-tab");
		expect(await visited.text()).toContain("HTTP 200");
	});
});
