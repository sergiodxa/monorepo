/**
 * Tests the dashboard's quick-check fragment, `GET /app/:team/dashboard/quick-ping`. It
 * renders the header's URL bar on its own and, when the action that just ran left a
 * result in the session, a toast reporting the status and the code and timing — the two
 * states the same markup has to cover, since the scripted frame reload and a plain
 * no-JavaScript navigation both land here.
 *
 * The case worth the harness is the third one: a stored result is rendered exactly
 * once, so a second load of this frame comes back to an empty form instead of to an
 * answer about a check nobody just ran. That is a property of a real session being read
 * and saved, not of the handler's code, so the session middleware and its storage are
 * real here and the tests carry the cookie between requests the way a browser would.
 * `requireUser`/`requireTeam`/`i18n` need a real sign-in and a locale lookup, so
 * `ctx.team`/`ctx.membership`/`ctx.i18next` are seeded directly instead.
 *
 * `cloudflare:workers` is mocked because the session key is imported from the action, whose
 * module graph reaches the `GeoFetchDO` the probe goes through — nothing here probes
 * anything, so the double only has to make the module resolve.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, mock, test } from "bun:test";

import type { Middleware, RequestContext, RequestHandler } from "remix/router";
import type { RemixNode } from "remix/ui";

import { createEnv } from "@pkg/cloudflare-mocks";
import { createTranslator } from "@pkg/i18n";
import { ServiceContainer } from "@pkg/service-container";
import { createCookie } from "remix/cookie";
import { Database } from "remix/data-table";
import { asyncContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";
import { renderWith } from "remix/middleware/render";
import { session } from "remix/middleware/session";
import { createRouter } from "remix/router";
import { createSession } from "remix/session";
import { createMemorySessionStorage } from "remix/session-storage/memory";
import { renderToStream } from "remix/ui/server";

import type { QuickPingError, QuickPingResult } from "~/app/http/controllers/actions/ping";
import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import en from "~/app/locales/en";
import { memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

await mock.module("cloudflare:workers", () => ({
	env: createEnv<Env>({}),
	waitUntil: () => {},
	/** Never instantiated here; `~/app/do/geo-fetch` extends it at module load. */
	DurableObject: class {},
}));

let { QUICK_PING_RESULT } = await import("~/app/http/controllers/actions/ping");
let quickPing = (await import("./dashboard-quick-ping")).default as {
	handler: RequestHandler<RequestContext>;
};

let { i18n: i18nextInstance } = await createTranslator({
	resources: { en: { translation: en } },
	supportedLanguages: ["en"],
	fallbackLanguage: "en",
})();

let sessionCookie = createCookie("uptime-test-session", { secrets: ["test-secret"] });
let sessionStorage = createMemorySessionStorage();

/** Minimal request-scoped HTML renderer standing in for `bootstrap/app.tsx`'s own. */
function createHtmlRenderer(ctx: RequestContext) {
	return function render(node: RemixNode, init?: ResponseInit) {
		let stream = renderToStream(node, { frameSrc: ctx.request.url, resolveFrame: async () => "" });
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

/**
 * Stores a session holding `result` the way the action stores it and returns the `Cookie` header
 * that reaches it — the state the dashboard is in immediately after a check has run.
 */
async function storeResult(result: QuickPingResult): Promise<string> {
	let stored = createSession();
	stored.set(QUICK_PING_RESULT, result);
	let value = await sessionStorage.save(stored);
	let setCookie = await sessionCookie.serialize(value ?? "");
	return setCookie.split(";")[0] ?? "";
}

/** Same, for a refusal — the outcome the action stores when no check ever ran. */
async function storeRefusal(error: QuickPingError): Promise<string> {
	let stored = createSession();
	stored.set(QUICK_PING_RESULT, error);
	let value = await sessionStorage.save(stored);
	let setCookie = await sessionCookie.serialize(value ?? "");
	return setCookie.split(";")[0] ?? "";
}

/**
 * The name of the animation the response's toast fades under, read out of the emitted
 * stylesheet. It is the only observable in server-rendered HTML for "this is a different
 * animation from the last one", which is what the browser needs in order to play it.
 */
function fadeName(body: string): string {
	let match = body.match(/animation-name:\s*(uptime-toast-fade[\w-]*)/);
	expect(match).not.toBeNull();
	return match?.[1] ?? "";
}

/** Requests the fragment, optionally carrying a session cookie back with it. */
async function render(
	db: Database,
	team: SelectTeam,
	membership: SelectMembership,
	cookie?: string,
): Promise<Response> {
	let router = createRouter({
		middleware: [
			asyncContext(),
			session(sessionCookie, sessionStorage),
			renderWith(createHtmlRenderer) as Middleware,
		],
	});
	/**
	 * `router.map` itself is cast rather than the handler, because the session middleware
	 * widens the router's context and the fragment's own handler is written against the
	 * plain one — casting the handler would be casting away the context it does use.
	 */
	(router.map as (target: unknown, action: unknown) => void)(routes.app.team.dashboard.quickPing, {
		middleware: [seedTeam(team, membership)],
		handler: quickPing.handler,
	});

	let container = new ServiceContainer();
	container.instance(Database, db);

	let headers = new Headers();
	if (cookie !== undefined) headers.set("Cookie", cookie);

	let request = new Request(
		new URL(routes.app.team.dashboard.quickPing.href({ team: team.slug }), "https://uptime.test"),
		{ headers },
	);

	return container.scope(() => router.fetch(request));
}

/** An `up` result, as the action stores one — a fresh id each time, as the action mints one. */
function upResult(overrides: Partial<QuickPingResult> = {}): QuickPingResult {
	return {
		kind: "result",
		id: crypto.randomUUID(),
		url: "https://example.com/health",
		status: "up",
		responseStatus: 200,
		responseTimeMs: 12,
		...overrides,
	};
}

describe("dashboard-quick-ping", () => {
	test("renders the bar alone when no check has run", async () => {
		let { db, team, membership } = await createFixture();

		let response = await render(db, team, membership);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain(en.page.dashboard.quickPing.action.submit);
		// The one place a visitor is told a check saves nothing and sends no alerts. It spent
		// a while as the heading's `title`, where a touch screen never showed it at all; the
		// sheet has the room to draw it, and the field points `aria-describedby` at it in
		// both layouts rather than the copy existing only in one.
		expect(body).toContain(en.page.dashboard.quickPing.description);
		expect(body).not.toContain(`title="${en.page.dashboard.quickPing.description}"`);
		expect(body).toContain('aria-describedby="quick-ping-help"');
		// Nothing to report yet, so no toast at all.
		expect(body).not.toContain(en.page.dashboard.quickPing.result.status.up);
		expect(body).not.toContain("HTTP");
	});

	test("serves both layouts from one form, opened by the trigger where it is a sheet", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await render(db, team, membership)).text();

		// Two renderings — a bar in the header and a card below it — would be two frames
		// reading one session, and only whichever ran first would find the result in it. So
		// there is one form, and below 768px it is a popover the trigger button opens.
		expect(body.match(/<form/g)?.length).toBe(1);
		expect(body).toContain('id="quick-ping-form"');
		expect(body).toContain('popover="auto"');
		expect(body).toContain('commandfor="quick-ping-form"');
		expect(body).toContain(`aria-label="${en.page.dashboard.quickPing.action.open}"`);
	});

	test("reports the answer as a toast beside the bar rather than a line inside it", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await render(db, team, membership, await storeResult(upResult()))).text();

		// The bar sits in the header's fixed 64px row, which has no line to draw an answer on.
		// So the answer is a region of its own, after the whole form: the field and the button
		// keep the order they submit in, and nothing between them moves when a check comes back.
		let field = body.indexOf('name="url"');
		let submit = body.indexOf(`>${en.page.dashboard.quickPing.action.submit}<`);
		let status = body.indexOf(`>${en.page.dashboard.quickPing.result.status.up}<`);

		expect(field).toBeGreaterThan(-1);
		expect(submit).toBeGreaterThan(field);
		expect(status).toBeGreaterThan(submit);
		expect(body).toContain(`aria-label="${en.page.dashboard.quickPing.result.label}"`);
	});

	test("names the field through a label that wraps it rather than through an id", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await render(db, team, membership)).text();

		// The caption is clipped in the header layout, but the accessible name never depended
		// on it being visible and must not start to: it rests on the `<label>` still wrapping
		// the control, and only the caption's own `<span>` is ever clipped — clipping the
		// label itself would take the field down with it.
		expect(body).toMatch(
			new RegExp(
				`<label[^>]*>\\s*<span[^>]*>${en.page.dashboard.quickPing.field.label}</span>\\s*<input[^>]*name="url"`,
			),
		);
	});

	test("names the status and reports the code and the timing of the check that just ran", async () => {
		let { db, team, membership } = await createFixture();

		let response = await render(db, team, membership, await storeResult(upResult()));

		let body = await response.text();
		expect(body).toContain(en.page.dashboard.quickPing.result.status.up);
		expect(body).toContain("HTTP 200");
		expect(body).toContain("12 ms");
		// The redirect cleared the form, so the target is put back into it. Asserted as the
		// attribute, since the placeholder is a URL this one is a prefix of.
		expect(body).toContain('value="https://example.com/health"');
	});

	test("says a target never answered rather than reporting a code it never sent", async () => {
		let { db, team, membership } = await createFixture();
		let result = upResult({ status: "down", responseStatus: null, responseTimeMs: null });

		let response = await render(db, team, membership, await storeResult(result));

		let body = await response.text();
		expect(body).toContain(en.page.dashboard.quickPing.result.status.down);
		expect(body).toContain(en.page.dashboard.quickPing.result.noResponse);
		expect(body).not.toContain("HTTP");
	});

	test("shows an answer once, so a reloaded frame doesn't keep a stale one", async () => {
		let { db, team, membership } = await createFixture();
		let cookie = await storeResult(upResult());

		let first = await render(db, team, membership, cookie);
		expect(await first.text()).toContain("HTTP 200");

		// Same session, immediately again: the frame reloads on its own after a check, and
		// a result that survived that would be attributed to a check nobody just ran.
		let second = await render(db, team, membership, cookie);
		let body = await second.text();
		expect(body).not.toContain("HTTP 200");
		expect(body).toContain(en.page.dashboard.quickPing.action.submit);
	});

	test("fades each answer under an animation of its own, so a second one still plays", async () => {
		let { db, team, membership } = await createFixture();

		let first = await (await render(db, team, membership, await storeResult(upResult()))).text();
		let second = await (await render(db, team, membership, await storeResult(upResult()))).text();

		// The frame swap patches the toast that is on screen rather than building a new one,
		// and re-applying a finished animation to the same element plays nothing — so the
		// second answer arrived invisible, held at `opacity: 0` by the first one's fill mode.
		// What makes it play is being a different animation, which is what this asserts.
		let firstFade = fadeName(first);
		let secondFade = fadeName(second);
		expect(firstFade).not.toBe(secondFade);
		// Both still have to be an animation the response also defines keyframes for.
		expect(first).toContain(`@keyframes ${firstFade}`);
		expect(second).toContain(`@keyframes ${secondFade}`);
	});

	test("distinguishes two identical refusals, which nothing in their wording could", async () => {
		let { db, team, membership } = await createFixture();
		let refusal = (): QuickPingError => ({
			kind: "error",
			id: crypto.randomUUID(),
			code: "invalidUrl",
		});

		let first = await (await render(db, team, membership, await storeRefusal(refusal()))).text();
		let second = await (await render(db, team, membership, await storeRefusal(refusal()))).text();

		// Typing the same nonsense twice is the case a name derived from what the toast says
		// could never tell apart: same code, same copy, same colour, byte-identical markup.
		expect(first).toContain(en.page.dashboard.quickPing.error.invalidUrl);
		expect(fadeName(first)).not.toBe(fadeName(second));
	});

	test("points the form at the run-ping action and the frame back at itself", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await render(db, team, membership)).text();

		// The form itself is what the no-JavaScript path submits, and `src` is what the
		// hydrated island reloads the frame from — one URL each, and neither is the other.
		expect(body).toContain(`action="${routes.actions.runPing.href({ team: team.slug })}"`);
		expect(body).toContain(
			`"src":"${routes.app.team.dashboard.quickPing.href({ team: team.slug })}"`,
		);
	});
});
