/**
 * Tests `/try`, both methods, because they are now one page.
 *
 * The `GET` half has one job and one prohibition: render an empty form, and never reach the
 * prober. The whole no-crawler-can-spend-a-probe story rests on that, so every `GET` here
 * asserts the guard was not consulted. It also has to stay empty when a probe is sitting in
 * the session — that value belongs to the email form, not to this method, and a `GET` that
 * rendered it would bring back the stale-result bug this page was collapsed to remove.
 *
 * The `POST` half is asserted on what comes back in the response rather than on what it
 * left behind, since there is no second request to leave anything for. Three properties are
 * the reason it is allowed to exist at all: a refused submission never reaches the network,
 * the probe does not follow redirects — the header that switches following off is asserted
 * on the outgoing request, so removing it fails a test rather than quietly reopening the
 * hole `trial-guard.ts` describes — and an anonymous check is billed nothing. Each refusal
 * code must still produce its own sentence, because the page's job is to let a visitor tell
 * "we stopped for today" apart from "your site is down"; the one that means "you have not
 * finished the form" is also asserted to render on the field rather than in the Alert.
 *
 * The signed-in half is a different page from the same handler, so it gets its own block at
 * the bottom: a real team row, a real entitlement projection, and assertions on all three
 * of who is charged, which budgets are asked for, and what the card offers. The anonymous
 * expectations are re-asserted there rather than assumed, since the one thing this change
 * could not be allowed to do is alter what a stranger sees.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { IngestEvent, PolarClient as PolarClientType } from "@pkg/polar";
import type { Result } from "@pkg/result";
import type { Middleware } from "remix/fetch-router";
import type { Renderer } from "remix/render-middleware";
import type { RemixNode } from "remix/ui";

import { PolarClient } from "@pkg/polar";
import { failure, success } from "@pkg/result";
import { ServiceContainer } from "@pkg/service-container";
import { asyncContext } from "remix/async-context-middleware";
import { Auth } from "remix/auth-middleware";
import { Database } from "remix/data-table";
import { createRouter } from "remix/fetch-router";
import { formData } from "remix/form-data-middleware";
import { renderWith } from "remix/render-middleware";
import { Session } from "remix/session";
import { renderToString } from "remix/ui/server";

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
import { createTestDatabase } from "~/app/lib/test/db";
import { createActiveSubscription, createRevokedSubscription } from "~/app/lib/test/polar";
import { memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

/** Every probe the action issued, as the Durable Object stub saw it. */
let probes: Array<{ url: string; headers: Headers }> = [];

/** What the stub answers with; a test swaps it to shape the outcome. */
let doFetch = mock(async (url: string, init?: RequestInit) => {
	probes.push({ url, headers: new Headers(init?.headers) });
	return new Response("OK", { status: 200, headers: { "X-Response-Time": "12" } });
});

/** Data points written to Analytics Engine; a trial probe must write none. */
let writtenPoints: unknown[] = [];

function makeGeoFetchNamespace() {
	return {
		idFromName: (name: string) => ({ name }),
		jurisdiction: () => makeGeoFetchNamespace(),
		get: () => ({ fetch: doFetch }),
	};
}

/** Work the action deferred, drained by {@link dispatch} so the meter event can be read. */
let deferred: Promise<unknown>[] = [];

mock.module("cloudflare:workers", () => ({
	env: {
		GEO_FETCH: makeGeoFetchNamespace(),
		PING_RESULTS: { writeDataPoint: (point: unknown) => writtenPoints.push(point) },
	},
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

let guardTrialProbe = mock(async (_probe: TrialProbeRequest) => guardResult);

let trialTurnstileSiteKey = mock((): string | null => null);

mock.module("~/app/services/trial-guard", () => ({ guardTrialProbe, trialTurnstileSiteKey }));

/** The guard's own logging is noise here; the assertions read the rendered page. */
mock.module("@pkg/logger", () => ({
	logger: { info: () => {}, error: () => {}, warn: () => {}, debug: () => {} },
}));

let { TRIAL_PROBE, TRIAL_WATCH_REPEATED, TRIAL_WATCH_STARTED } =
	await import("~/app/http/controllers/trial/session");
let { NO_REDIRECT_HEADER } = await import("~/app/do/geo-fetch");
let { default: trialCheck } = await import("./index");

/** Renders through `renderToString` — this page renders no `<Frame>`. */
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

/** Event batches the action handed the billing client, one entry per call. */
let ingested: IngestEvent[][] = [];

let polar = {
	async ingestEventsSafe(events: IngestEvent[]) {
		ingested.push(events);
		return true;
	},
} as unknown as PolarClientType;

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
 * Seeds a viewer's team and its owner's entitlement.
 *
 * `subscription` is the state the projection is left in, and the three values are three
 * different answers from the gate: a recorded active row, a recorded revoked one, and no
 * row at all — which reads as `unknown` and must still be billed.
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

/** Both methods run through the same router; only the request and the actor differ. */
async function dispatch(request: Request, session: Session, actor?: Actor) {
	let db = actor?.db ?? createTestDatabase().db;
	let container = new ServiceContainer();
	container.instance(Database, db);
	container.instance(PolarClient, polar);

	let router = createRouter({
		middleware: [
			asyncContext(),
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
	// The platform settles deferred work after the response; this stands in for that, so
	// asserting on the meter event doesn't race it.
	await Promise.all(deferred.splice(0));

	return { response, session, body: await response.text() };
}

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
	writtenPoints.length = 0;
	ingested.length = 0;
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

	test("sells nothing before a check has run", async () => {
		let { body } = await getTry();

		expect(body).not.toContain("What the week looks like");
		expect(body).not.toContain("Not just websites");
		expect(body).not.toContain("Keep the checks, add the rest");
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
	 * The capped submission's own receipt, and it must not read as the other one: nothing was
	 * started, and saying otherwise is the one claim on this page a visitor cannot check.
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

		expect(writtenPoints).toHaveLength(0);
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

	test("sells the week only once there is something to have an opinion about", async () => {
		let { body } = await runTry({ url: "example.com" });

		expect(body).toContain("What the week looks like");
		expect(body).toContain("Not just websites");
		expect(body).toContain("Keep the checks, add the rest");
	});
});

describe("POST /try refusals", () => {
	/**
	 * The sentence each code must produce, and a word no other code's sentence contains.
	 * `unavailable` is the one the guard never issues — it comes from the prober throwing,
	 * which has its own test above — so it is listed here only for the distinctness check.
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
	 * The reasons that render in the Alert. `challenge-incomplete` is left out because it
	 * renders on the field instead, and `unavailable` because the guard's own version of it
	 * has no test target here — the prober throwing does, above.
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

	test("renders the alert inside the form card rather than adrift below it", async () => {
		guardResult = failure(new TestRefusal("budget-exhausted"));

		let { body } = await runTry({ url: "example.com" });

		let formStart = body.indexOf(`action="${routes.trial.check.action.href()}"`);
		let alertAt = body.indexOf("every free check we run in a day");
		let submitAt = body.indexOf("Run the check");

		expect(formStart).toBeGreaterThan(-1);
		expect(alertAt).toBeGreaterThan(formStart);
		expect(alertAt).toBeLessThan(submitAt);
	});

	test("renders an unfinished challenge as field validation, never as the alert", async () => {
		guardResult = failure(new TestRefusal("challenge-incomplete"));

		let { body } = await runTry({ url: "example.com" });

		expect(body).toContain("Complete the verification");
		expect(body).toContain("data-field-error");
		// The Alert's title is the tell: an incomplete form is not a check that failed.
		expect(body).not.toContain("The check did not run");
	});

	test("does not tell somebody who never ticked the box to reload the page", async () => {
		guardResult = failure(new TestRefusal("challenge-incomplete"));

		let { body } = await runTry({ url: "example.com" });

		expect(body).not.toContain("could not confirm the request came from a browser");
	});
});

describe("POST /try for a signed-in viewer", () => {
	test("bills the check to their team and spends neither free budget", async () => {
		let actor = await signIn("active");

		await runTry({ url: "example.com" }, new Session(), actor);

		expect(guardTrialProbe.mock.calls[0]?.[0].billed).toBe(true);
		expect(writtenPoints).toHaveLength(1);
		expect(ingested).toHaveLength(1);
		expect(ingested[0]?.[0]?.externalCustomerId).toBe(actor.team.owner_id);
		expect(ingested[0]?.[0]?.metadata).toMatchObject({ teamId: actor.team.id, type: "adhoc" });
		// No monitor id: the ping counts toward the team's total and against no monitor.
		expect(ingested[0]?.[0]?.metadata).not.toHaveProperty("monitorId");
	});

	test("bills an owner whose subscription state cannot be determined", async () => {
		let actor = await signIn("unknown");

		await runTry({ url: "example.com" }, new Session(), actor);

		expect(guardTrialProbe.mock.calls[0]?.[0].billed).toBe(true);
		expect(writtenPoints).toHaveLength(1);
	});

	test("gives a revoked subscription the free path rather than refusing it", async () => {
		let actor = await signIn("revoked");

		let { body } = await runTry({ url: "example.com" }, new Session(), actor);

		expect(guardTrialProbe.mock.calls[0]?.[0].billed).toBe(false);
		expect(writtenPoints).toHaveLength(0);
		expect(ingested).toHaveLength(0);
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
		expect(body).not.toContain("Get an email when this changes");
	});

	test("drops the free-week pitch, which describes an offer they were not made", async () => {
		let actor = await signIn("active");

		let { body } = await runTry({ url: "example.com" }, new Session(), actor);

		// "No account, no card" is the closing argument of that section, and it is the line
		// that reads worst to somebody who has both.
		expect(body).not.toContain("What the week looks like");
		expect(body).not.toContain("No account, no card");
	});

	test("offers billing alongside the monitor when the subscription is not active", async () => {
		let actor = await signIn("revoked");

		let { body } = await runTry({ url: "example.com" }, new Session(), actor);

		expect(body).toContain("Create a monitor for this URL");
		expect(body).toContain("Start your subscription");
		expect(body).toContain(routes.app.team.checkout.href({ team: actor.team.slug }));
		expect(body).not.toContain(`action="${routes.trial.lead.href()}"`);
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
		expect(writtenPoints).toHaveLength(0);
		expect(ingested).toHaveLength(0);
		expect(body).toContain(`action="${routes.trial.lead.href()}"`);
		expect(body).toContain("Get an email when this changes");
		expect(body).not.toContain("Create a monitor for this URL");
	});
});
