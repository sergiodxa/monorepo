/**
 * Tests `/try`, both methods, since a `GET` and a `POST` share one page.
 *
 * `GET` only ever renders the empty form; probing the URL and billing the
 * check are `POST`'s job alone, asserted on its response, the only evidence
 * a single request leaves behind. A signed-in viewer gets its own block below.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UsageEvent } from "@pkg/billing";
import type { Result } from "@pkg/result";
import type { Renderer } from "remix/middleware/render";
import type { Middleware } from "remix/router";
import type { RemixNode } from "remix/ui";

import billing from "@pkg/billing/middleware";
import {
	createAnalyticsEngine,
	createDurableObjectNamespace,
	createEnv,
} from "@pkg/cloudflare-mocks";
import { failure, success } from "@pkg/result";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { formData } from "remix/middleware/form-data";
import { renderWith } from "remix/middleware/render";
import { createRouter } from "remix/router";
import { Session } from "remix/session";
import { renderToString } from "remix/ui/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { GeoFetchDO } from "~/app/do/geo-fetch";
import type { TrialProbeState } from "~/app/http/controllers/trial/session";
import type { Viewer } from "~/app/http/middleware/auth";
import type {
	TrialProbeGrant,
	TrialProbeRequest,
	TrialRefusal,
	TrialRefusalReason,
} from "~/app/services/trial-guard";
import type { SelectTeam } from "~/database/schema";

import i18n from "~/app/http/middleware/i18n";
import { BASE_PRICE_USD } from "~/app/lib/pricing";
import {
	createActiveSubscription,
	createRevokedSubscription,
	createTestBilling,
} from "~/app/lib/test/billing";
import { createTestDatabase } from "~/app/lib/test/db";
import { memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

/** Every probe the action issued, as the Durable Object stub saw it. */
let probes: Array<{ url: string; headers: Headers }> = [];

/** What the stub answers with; a test swaps it to shape the outcome. */
let doFetch = vi.fn(async (url: string, init?: RequestInit) => {
	probes.push({ url, headers: new Headers(init?.headers) });
	return new Response("OK", { status: 200, headers: { "X-Response-Time": "12" } });
});

/** The dataset a billed check reports to; a trial probe leaves it untouched. */
let pingResults = createAnalyticsEngine();

/** The prober's namespace, routing every object it hands out to {@link doFetch}. */
let geoFetch = createDurableObjectNamespace<GeoFetchDO>(() => ({ fetch: doFetch }));

/** Work the action deferred, drained by {@link dispatch} so the meter event can be read. */
let deferred: Promise<unknown>[] = [];

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({
		GEO_FETCH: geoFetch,
		PING_RESULTS: pingResults,
	}),
	waitUntil: (promise: Promise<unknown>) => {
		deferred.push(promise);
	},
	DurableObject: class {},
}));

/**
 * Stands in for the guard's own `TrialRefusal`, whose module is replaced below — the type
 * still comes from the real one, so a field renamed there fails to compile here.
 */
class TestRefusal extends Error {
	constructor(
		readonly reason: TrialRefusalReason,
		readonly retryAfterSeconds: number | null = null,
		readonly detail: string = "test",
	) {
		super(`Trial probe refused: ${reason}`);
		this.name = "TrialRefusal";
	}
}

/** The guard's verdict for the next submission, set per test. */
let guardResult: Result<TrialProbeGrant, TrialRefusal> = success({
	url: new URL("https://example.com/"),
	addresses: ["93.184.216.34"],
	budgetRemaining: 499,
});

let guardTrialProbe = vi.fn(async (_probe: TrialProbeRequest) => guardResult);

let trialTurnstileSiteKey = vi.fn((): string | null => null);

vi.doMock("~/app/services/trial-guard", () => ({ guardTrialProbe, trialTurnstileSiteKey }));

/** The guard's own logging is noise here; the assertions read the rendered page. */
vi.doMock("@pkg/logger", () => ({
	logger: { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} },
}));

let { TRIAL_PROBE, TRIAL_WATCH_REPEATED, TRIAL_WATCH_STARTED } =
	await import("~/app/http/controllers/trial/session");
let { NO_REDIRECT_HEADER } = await import("~/app/do/geo-fetch");
let { default: trialCheck } = await import("./index");

/** Renders through `renderToString`, sufficient for a page that outputs plain HTML. */
function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let html = await renderToString(node);
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/** A probe result in the shape the session carries it for the email form. */
function probeState(overrides: Partial<TrialProbeState> = {}): TrialProbeState {
	return {
		url: "https://example.com/",
		status: "up",
		responseStatus: 200,
		responseTimeMs: 123,
		location: null,
		checkedAt: Date.UTC(2026, 0, 2, 3, 4, 5),
		...overrides,
	};
}

/**
 * The platform the action bills against, with its one ingestion call spied on. The
 * middleware resolves it per request, so the router built below reads this instance.
 */
let testBilling = createTestBilling();
let ingestMock = vi.spyOn(testBilling.usage, "ingest");

/** Event batches the action handed the platform, one entry per call. */
function ingested(): UsageEvent[][] {
	return ingestMock.mock.calls.map(([events]) => [...events]);
}

let viewer: Viewer = {
	id: "viewer-1",
	name: "Test Viewer",
	email: "viewer@example.com",
	avatar: "",
};

/** A signed-in viewer with a team, as the request runs as them. */
interface Actor {
	db: ReturnType<typeof createTestDatabase>["db"];
	team: SelectTeam;
}

/**
 * Seeds a viewer's team and its owner's entitlement. `subscription` picks
 * one of the projection's three answers — a recorded active row, a recorded
 * revoked one, or no row at all, which must still be billed as `unknown`.
 */
async function signIn(subscription: "active" | "revoked" | "unknown"): Promise<Actor> {
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
	await db.create(
		memberships,
		{ id: crypto.randomUUID(), subject_id: viewer.id, team_id: team.id, role: "admin" },
		{ touch: true, returnRow: true },
	);

	if (subscription === "active") await createActiveSubscription(db, team.owner_id);
	if (subscription === "revoked") await createRevokedSubscription(db, team.owner_id);

	return { db, team };
}

/**
 * Both methods run through the same router; only the request and the actor differ.
 * Draining `deferred` mimics the platform settling background work after the
 * response, so the meter-event assertion always runs after that work has settled.
 */
async function dispatch(request: Request, session: Session, actor?: Actor) {
	let db = actor?.db ?? createTestDatabase().db;
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [
			asyncContext(),
			billing({ provider: () => testBilling }) as Middleware,
			((ctx, next) => {
				if (actor === undefined) ctx.set(Auth, { ok: false });
				else ctx.set(Auth, { ok: true, identity: viewer, method: "test" });
				return next();
			}) as Middleware,
			((ctx, next) => {
				ctx.set(Session, session, { property: "session" });
				return next();
			}) as Middleware,
			i18n as Middleware,
			formData() as Middleware,
			renderWith(createTestRenderer) as Middleware,
		],
	});
	router.map(routes.trial.check, trialCheck);

	let response = await container.scope(() => router.fetch(request));
	await Promise.all(deferred.splice(0));

	return { response, session, body: await response.text() };
}

/**
 * The subscription price as the page states it, computed from `~/app/lib/pricing`
 * so a price change moves the assertion together with the product.
 */
const PRICE = BASE_PRICE_USD.toLocaleString("en", {
	style: "currency",
	currency: "USD",
	minimumFractionDigits: 0,
	maximumFractionDigits: 2,
});

/** Loads `/try` with a session seeded however the test needs it. */
async function getTry(session = new Session(), search = "") {
	let url = `https://uptime.test${routes.trial.check.index.href()}${search}`;
	return dispatch(new Request(url), session);
}

/** Submits the form and reads back both the rendered page and the session it touched. */
async function runTry(body: Record<string, string>, session = new Session(), actor?: Actor) {
	let request = new Request(`https://uptime.test${routes.trial.check.action.href()}`, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(body),
	});

	let result = await dispatch(request, session, actor);

	return { ...result, probe: session.get(TRIAL_PROBE) as TrialProbeState | undefined };
}

beforeEach(() => {
	probes.length = 0;
	pingResults.reset();
	ingestMock.mockClear();
	deferred.length = 0;
	guardTrialProbe.mockClear();
	trialTurnstileSiteKey.mockReset();
	trialTurnstileSiteKey.mockImplementation(() => null);
	doFetch.mockReset();
	doFetch.mockImplementation(async (url: string, init?: RequestInit) => {
		probes.push({ url, headers: new Headers(init?.headers) });
		return new Response("OK", { status: 200, headers: { "X-Response-Time": "12" } });
	});
	guardResult = success({
		url: new URL("https://example.com/"),
		addresses: ["93.184.216.34"],
		budgetRemaining: 499,
	});
});

describe("GET /try", () => {
	test("renders the form and posts it to the same URL", async () => {
		let { response, body } = await getTry();

		expect(response.status).toBe(200);
		expect(body).toContain(`action="${routes.trial.check.action.href()}"`);
		expect(body).toContain('method="post"');
		expect(body).toContain('name="url"');
		expect(guardTrialProbe).not.toHaveBeenCalled();
	});

	test("pre-fills from ?url= without running a probe", async () => {
		let { body } = await getTry(new Session(), "?url=https%3A%2F%2Fexample.com");

		expect(body).toContain('value="https://example.com"');
		expect(guardTrialProbe).not.toHaveBeenCalled();
		expect(probes).toHaveLength(0);
	});

	/**
	 * The page frames itself as a run of checks, so a crawler's `GET` would be
	 * expensive if the method ever started one. The bare `GET` and the pre-filled
	 * one are asserted separately, each confined to rendering the form alone.
	 */
	test("a bare GET starts nothing, whatever the page is offering", async () => {
		let { response, body } = await getTry();

		expect(response.status).toBe(200);
		expect(body).toContain('name="url"');
		expect(guardTrialProbe).not.toHaveBeenCalled();
		expect(probes).toHaveLength(0);
		expect(pingResults.dataPoints).toHaveLength(0);
	});

	test("a pre-filled GET starts nothing either — the field is filled, not submitted", async () => {
		let { body } = await getTry(new Session(), "?url=https%3A%2F%2Fexample.com");

		expect(body).toContain('value="https://example.com"');
		expect(body).toContain('method="post"');
		expect(guardTrialProbe).not.toHaveBeenCalled();
		expect(probes).toHaveLength(0);
		expect(pingResults.dataPoints).toHaveLength(0);
	});

	test("comes back empty even when a probe is still sitting in the session", async () => {
		let session = new Session();
		session.set(TRIAL_PROBE, probeState());

		let { body } = await getTry(session);

		expect(body).not.toContain("Check another URL");
		expect(body).not.toContain(`action="${routes.trial.lead.href()}"`);
		expect(body).toContain('name="url"');
	});

	test("leaves the probe alone for the email form to claim", async () => {
		let session = new Session();
		session.set(TRIAL_PROBE, probeState());

		await getTry(session);

		expect(session.get(TRIAL_PROBE)).toBeDefined();
	});

	/**
	 * Each section is identified by the line that names the thing it sells, so a
	 * rewrite of the pitch cannot quietly delete a section's coverage by renaming
	 * its heading.
	 */
	test("sells nothing before a check has run", async () => {
		let { body } = await getTry();

		expect(body).not.toContain("A check every hour");
		expect(body).not.toContain("Not just websites");
		expect(body).not.toContain("See pricing");
	});

	test("renders no Turnstile widget when the deployment has no site key", async () => {
		let { body } = await getTry();

		expect(body).not.toContain("cf-turnstile");
		expect(body).not.toContain("challenges.cloudflare.com");
	});

	test("renders the Turnstile widget and its loader when a site key is configured", async () => {
		trialTurnstileSiteKey.mockImplementation(() => "0x-site-key");

		let { body } = await getTry();

		expect(body).toContain('class="cf-turnstile"');
		expect(body).toContain('data-sitekey="0x-site-key"');
		expect(body).toContain("https://challenges.cloudflare.com/turnstile/v0/api.js");
	});

	test("renders the watch receipt once and then forgets it", async () => {
		let session = new Session();
		session.set(TRIAL_WATCH_STARTED, "https://example.com/");

		let { body } = await getTry(session);

		expect(body).toContain("We are on it");
		expect(body).toContain("https://example.com/");
		expect(session.get(TRIAL_WATCH_STARTED)).toBeUndefined();
	});

	/**
	 * The capped submission's own receipt. It reads differently from the started
	 * one because a visitor has only this page's wording to judge whether a
	 * check truly started.
	 */
	test("renders the capped receipt once and then forgets it", async () => {
		let session = new Session();
		session.set(TRIAL_WATCH_REPEATED, "https://example.com/");

		let { body } = await getTry(session);

		expect(body).toContain("We have already checked this one");
		expect(body).toContain("https://example.com/");
		expect(body).not.toContain("We are on it");
		expect(session.get(TRIAL_WATCH_REPEATED)).toBeUndefined();
	});
});

describe("POST /try", () => {
	test("probes a granted target and renders the answer in its own response", async () => {
		let { response, body } = await runTry({ url: "example.com" });

		expect(response.status).toBe(200);
		expect(response.headers.get("location")).toBeNull();
		expect(body).toContain("Check another URL");
		expect(body).toContain("https://example.com/");
		expect(body).toContain("HTTP 200");
		expect(body).toContain("12 ms");
		expect(body).toContain(`action="${routes.trial.lead.href()}"`);
	});

	test("puts the answer where the form was rather than under it", async () => {
		let { body } = await runTry({ url: "example.com" });

		expect(body).not.toContain('name="url"');
		expect(body).not.toContain(`action="${routes.trial.check.action.href()}"`);
	});

	test("offers the way back as a plain link to the empty form", async () => {
		let { body } = await runTry({ url: "example.com" });

		expect(body).toContain(`href="${routes.trial.check.index.href()}"`);
		expect(body).toContain("Check another URL");
	});

	test("leads the result card with the URL rather than with a sentence about it", async () => {
		let { body } = await runTry({ url: "example.com" });

		let title = body.match(/<h[1-6][^>]*data-heading-level[^>]*>([^<]*)<\/h[1-6]>/g) ?? [];

		expect(title.some((heading) => heading.includes("https://example.com/"))).toBe(true);
	});

	test("asks the Durable Object not to follow redirects", async () => {
		await runTry({ url: "example.com" });

		expect(probes).toHaveLength(1);
		expect(probes[0]?.headers.get(NO_REDIRECT_HEADER)).not.toBeNull();
	});

	test("keeps the probe in the session so the email form has something real to claim", async () => {
		let { probe } = await runTry({ url: "example.com" });

		expect(probe?.url).toBe("https://example.com/");
		expect(probe?.status).toBe("up");
		expect(probe?.responseStatus).toBe(200);
	});

	test("describes a 3xx as a redirect instead of grading it down", async () => {
		doFetch.mockImplementation(async (url: string, init?: RequestInit) => {
			probes.push({ url, headers: new Headers(init?.headers) });
			return new Response(null, {
				status: 301,
				headers: { location: "https://example.com/", "X-Response-Time": "4" },
			});
		});

		let { body } = await runTry({ url: "example.com" });

		expect(body).toContain("This URL redirects somewhere else");
		expect(body).toContain("HTTP 301");
		expect(body).not.toContain(">Down<");
	});

	test("withholds the email form for a redirect, so no week of false outages is started", async () => {
		doFetch.mockImplementation(async (url: string, init?: RequestInit) => {
			probes.push({ url, headers: new Headers(init?.headers) });
			return new Response(null, { status: 302, headers: { "X-Response-Time": "4" } });
		});

		let { body } = await runTry({ url: "example.com" });

		expect(body).not.toContain(`action="${routes.trial.lead.href()}"`);
	});

	test("reports a 3xx as the status it is rather than following it", async () => {
		doFetch.mockImplementation(async (url: string, init?: RequestInit) => {
			probes.push({ url, headers: new Headers(init?.headers) });
			return new Response(null, {
				status: 302,
				headers: { location: "http://169.254.169.254/", "X-Response-Time": "4" },
			});
		});

		let { probe } = await runTry({ url: "example.com" });

		expect(probe?.responseStatus).toBe(302);
		expect(probes).toHaveLength(1);
		expect(probes.map((entry) => entry.url)).not.toContain("http://169.254.169.254/");
	});

	test("renders a result for a target that never answered rather than an error", async () => {
		doFetch.mockImplementation(async (url: string, init?: RequestInit) => {
			probes.push({ url, headers: new Headers(init?.headers) });
			return new Response(null, { status: 204, headers: { "X-Probe-Outcome": "unreachable" } });
		});

		let { response, body, probe } = await runTry({ url: "example.com" });

		expect(response.status).toBe(200);
		expect(body).toContain("No response");
		expect(body).toContain(">Down<");
		expect(probe?.status).toBe("down");
		expect(probe?.responseStatus).toBeNull();
	});

	test("keeps grading a 4xx and a 5xx rather than calling them redirects", async () => {
		doFetch.mockImplementation(async (url: string, init?: RequestInit) => {
			probes.push({ url, headers: new Headers(init?.headers) });
			return new Response(null, { status: 500, headers: { "X-Response-Time": "9" } });
		});

		let { body } = await runTry({ url: "example.com" });

		expect(body).toContain(">Down<");
		expect(body).not.toContain("This URL redirects somewhere else");
	});

	test("reports an unreachable prober as ours rather than as the target being down", async () => {
		doFetch.mockImplementation(async () => {
			throw new Error("no such Durable Object");
		});

		let { body, probe } = await runTry({ url: "example.com" });

		expect(probe).toBeUndefined();
		expect(body).toContain("Something on our side stopped the check");
		expect(body).not.toContain("Check another URL");
	});

	test("bills nothing: no data point is written for a trial probe", async () => {
		await runTry({ url: "example.com" });

		expect(pingResults.dataPoints).toHaveLength(0);
	});

	test("passes the Turnstile token through under the name the widget writes", async () => {
		await runTry({ url: "example.com", "cf-turnstile-response": "token-1" });

		expect(guardTrialProbe).toHaveBeenCalledTimes(1);
		expect(guardTrialProbe.mock.calls[0]?.[0].token).toBe("token-1");
	});

	test("treats an absent token as no token rather than as an empty one", async () => {
		await runTry({ url: "example.com" });

		expect(guardTrialProbe.mock.calls[0]?.[0].token).toBeNull();
	});

	test("sells the free run only once there is something to have an opinion about", async () => {
		let { body } = await runTry({ url: "example.com" });

		expect(body).toContain("A check every hour");
		expect(body).toContain("Not just websites");
		expect(body).toContain("See pricing");
	});

	/**
	 * The closing pitch is about carrying on, so what it costs must be on it: the
	 * price is asserted as `pricing.ts` formats it, alongside the two destinations,
	 * so a rewrite of the copy cannot drop the price or its links.
	 */
	test("closes on the price the subscription actually costs", async () => {
		let { body } = await runTry({ url: "example.com" });

		expect(body).toContain(PRICE);
		expect(body).toContain(`href="${routes.app.index.href()}"`);
		expect(body).toContain(`${routes.home.href()}#pricing`);
	});

	/**
	 * The terms — what will be checked, how often, which emails arrive, and
	 * what's optional — sit above the field that accepts them, asserted by
	 * position so the copy can be rewritten without moving the guarantee.
	 */
	test("sets out what is being asked for before the email field", async () => {
		let { body } = await runTry({ url: "example.com" });

		let cardAt = body.indexOf("https://example.com/");
		let formAt = body.indexOf(`action="${routes.trial.lead.href()}"`);
		let listAt = body.lastIndexOf("<ul", formAt);

		expect(cardAt).toBeGreaterThan(-1);
		expect(listAt).toBeGreaterThan(cardAt);
		expect(formAt).toBeGreaterThan(listAt);
		expect(body.slice(listAt, formAt).match(/<li/g) ?? []).toHaveLength(4);
	});
});

describe("POST /try refusals", () => {
	/**
	 * The sentence each code must produce, and a word no other code's sentence
	 * contains. `unavailable` comes only from the prober throwing, tested above,
	 * so it appears here solely for the distinctness check.
	 */
	let cases: Array<{ code: TrialRefusalReason; contains: string }> = [
		{ code: "blocked-target", contains: "not an address we will check on your behalf" },
		{ code: "challenge-incomplete", contains: "Complete the verification" },
		{ code: "failed-challenge", contains: "could not confirm the request came from a browser" },
		{ code: "rate-limited", contains: "run another check" },
		{ code: "budget-exhausted", contains: "every free check we run in a day" },
		{ code: "unavailable", contains: "Something on our side stopped the check" },
	];

	/**
	 * The reasons that render in the Alert. `challenge-incomplete` renders on
	 * the field, and the prober-throwing test above already covers
	 * `unavailable`'s only reachable path here.
	 */
	let guardReasons: Array<{ code: TrialRefusalReason; contains: string }> = [
		{ code: "blocked-target", contains: "not an address we will check on your behalf" },
		{ code: "failed-challenge", contains: "could not confirm the request came from a browser" },
		{ code: "rate-limited", contains: "run another check" },
		{ code: "budget-exhausted", contains: "every free check we run in a day" },
	];

	for (let { code, contains } of guardReasons) {
		test(`explains "${code}" in its own words and never reaches the network`, async () => {
			guardResult = failure(new TestRefusal(code));

			let { response, body, probe } = await runTry({ url: "example.com" });

			expect(response.status).toBe(200);
			expect(body).toContain("The check did not run");
			expect(body).toContain(contains);
			expect(body).not.toContain("Check another URL");
			expect(probe).toBeUndefined();
			expect(probes).toHaveLength(0);
		});
	}

	test("every refusal reads differently from every other one", async () => {
		let rendered = new Set<string>();

		for (let { contains } of cases) rendered.add(contains);

		expect(rendered.size).toBe(cases.length);
	});

	test("names the wait when the rate limiter reported one", async () => {
		guardResult = failure(new TestRefusal("rate-limited", 42));

		let { body } = await runTry({ url: "example.com" });

		expect(body).toContain("42 seconds");
	});

	test("says nothing about waiting when the limiter reported no window", async () => {
		guardResult = failure(new TestRefusal("rate-limited"));

		let { body } = await runTry({ url: "example.com" });

		expect(body).toContain("in a minute");
		expect(body).not.toContain("seconds.");
	});

	test("keeps the submitted URL in the box so a refused attempt can be retried", async () => {
		guardResult = failure(new TestRefusal("rate-limited", 42));

		let { body } = await runTry({ url: "https://example.com/" });

		expect(body).toContain('value="https://example.com/"');
	});

	test("drops a previous probe, so nothing off the screen stays claimable", async () => {
		let session = new Session();
		session.set(TRIAL_PROBE, probeState());
		guardResult = failure(new TestRefusal("budget-exhausted"));

		let { probe } = await runTry({ url: "example.com" }, session);

		expect(probe).toBeUndefined();
	});

	test("submits an empty target to the guard rather than skipping it", async () => {
		guardResult = failure(new TestRefusal("blocked-target"));

		let { body } = await runTry({ url: "" });

		expect(guardTrialProbe).toHaveBeenCalledTimes(1);
		expect(body).toContain("not an address we will check on your behalf");
	});

	/**
	 * The submit control is located by its `type`, a stable anchor independent
	 * of its label, since the guarantee under test is the alert's position
	 * relative to the control that produced it.
	 */
	test("renders the alert inside the form card rather than adrift below it", async () => {
		guardResult = failure(new TestRefusal("budget-exhausted"));

		let { body } = await runTry({ url: "example.com" });

		let formStart = body.indexOf(`action="${routes.trial.check.action.href()}"`);
		let alertAt = body.indexOf("every free check we run in a day");
		let submitAt = body.lastIndexOf('type="submit"');

		expect(formStart).toBeGreaterThan(-1);
		expect(alertAt).toBeGreaterThan(formStart);
		expect(alertAt).toBeLessThan(submitAt);
	});

	test("renders an unfinished challenge as field validation, never as the alert", async () => {
		guardResult = failure(new TestRefusal("challenge-incomplete"));

		let { body } = await runTry({ url: "example.com" });

		expect(body).toContain("Complete the verification");
		expect(body).toContain("data-field-error");
		expect(body).not.toContain("The check did not run");
	});

	test("does not tell somebody who never ticked the box to reload the page", async () => {
		guardResult = failure(new TestRefusal("challenge-incomplete"));

		let { body } = await runTry({ url: "example.com" });

		expect(body).not.toContain("could not confirm the request came from a browser");
	});
});

describe("POST /try for a signed-in viewer", () => {
	/**
	 * The data point carries the team's id as its only index, with no monitor
	 * id, so an ad hoc check counts toward the team's total alone.
	 */
	test("bills the check to their team and spends neither free budget", async () => {
		let actor = await signIn("active");

		await runTry({ url: "example.com" }, new Session(), actor);

		expect(guardTrialProbe.mock.calls[0]?.[0].billed).toBe(true);
		expect(pingResults.dataPoints).toHaveLength(1);
		expect(pingResults.dataPoints[0]?.indexes).toEqual([actor.team.id]);
		expect(ingested()).toHaveLength(1);
		expect(ingested()[0]?.[0]?.customer).toEqual({ externalId: actor.team.owner_id });
		expect(ingested()[0]?.[0]?.metadata).toMatchObject({ teamId: actor.team.id, type: "adhoc" });
		expect(ingested()[0]?.[0]?.metadata).not.toHaveProperty("monitorId");
	});

	test("bills an owner whose subscription state cannot be determined", async () => {
		let actor = await signIn("unknown");

		await runTry({ url: "example.com" }, new Session(), actor);

		expect(guardTrialProbe.mock.calls[0]?.[0].billed).toBe(true);
		expect(pingResults.dataPoints).toHaveLength(1);
	});

	test("gives a revoked subscription the free path rather than refusing it", async () => {
		let actor = await signIn("revoked");

		let { body } = await runTry({ url: "example.com" }, new Session(), actor);

		expect(guardTrialProbe.mock.calls[0]?.[0].billed).toBe(false);
		expect(pingResults.dataPoints).toHaveLength(0);
		expect(ingested()).toHaveLength(0);
		expect(body).toContain("HTTP 200");
	});

	test("offers a monitor on the checked URL instead of asking for an email", async () => {
		let actor = await signIn("active");

		let { body } = await runTry({ url: "example.com" }, new Session(), actor);

		expect(body).toContain("Create a monitor for this URL");
		expect(body).toContain(
			`${routes.app.team.monitors.new.href({ team: actor.team.slug })}?url=https%3A%2F%2Fexample.com%2F`,
		);
		expect(body).not.toContain(`action="${routes.trial.lead.href()}"`);
		expect(body).not.toContain("Also email me occasionally about Uptime itself.");
	});

	/**
	 * Sliced past `</head>`, since the page's own meta description quotes "no
	 * card, no account" for every visitor already; the pitch section that
	 * follows belongs only to a visitor who still lacks both.
	 */
	test("drops the free-week pitch, which describes an offer they were not made", async () => {
		let actor = await signIn("active");

		let { body } = await runTry({ url: "example.com" }, new Session(), actor);

		let rendered = body.slice(body.indexOf("</head>"));

		expect(rendered).not.toContain("A check every hour");
		expect(rendered).not.toContain("No account, no card");
	});

	test("offers billing alongside the monitor when the subscription is not active", async () => {
		let actor = await signIn("revoked");

		let { body } = await runTry({ url: "example.com" }, new Session(), actor);

		expect(body).toContain("Create a monitor for this URL");
		expect(body).toContain("Start your subscription");
		expect(body).toContain(routes.app.team.checkout.href({ team: actor.team.slug }));
		expect(body).not.toContain(`action="${routes.trial.lead.href()}"`);
	});

	test("marks the billing offer as a document navigation", async () => {
		let actor = await signIn("revoked");

		let { body } = await runTry({ url: "example.com" }, new Session(), actor);

		let link = body.match(
			new RegExp(`<a[^>]*href="${routes.app.team.checkout.href({ team: actor.team.slug })}"[^>]*>`),
		);
		expect(link?.[0]).toContain("data-rmx-document");
	});

	test("does not offer billing to a team that is already paying", async () => {
		let actor = await signIn("active");

		let { body } = await runTry({ url: "example.com" }, new Session(), actor);

		expect(body).not.toContain("Start your subscription");
		expect(body).not.toContain(routes.app.team.checkout.href({ team: actor.team.slug }));
	});

	test("stores no probe, since the form that would claim it never renders", async () => {
		let actor = await signIn("active");

		let { probe } = await runTry({ url: "example.com" }, new Session(), actor);

		expect(probe).toBeUndefined();
	});

	test("leaves the anonymous visitor exactly as they were", async () => {
		let { body } = await runTry({ url: "example.com" });

		expect(guardTrialProbe.mock.calls[0]?.[0].billed).toBe(false);
		expect(pingResults.dataPoints).toHaveLength(0);
		expect(ingested()).toHaveLength(0);
		expect(body).toContain(`action="${routes.trial.lead.href()}"`);
		expect(body).toContain("Also email me occasionally about Uptime itself.");
		expect(body).not.toContain("Create a monitor for this URL");
	});
});
