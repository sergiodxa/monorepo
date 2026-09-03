/**
 * Tests the dashboard's quick-check fragment, `GET /app/:team/dashboard/quick-ping`,
 * which renders the header's URL bar alone, or beside a toast built from a stored
 * check result. The session middleware and its storage are real here, with the
 * cookie carried between requests, so a stored result renders exactly once. The
 * `cloudflare:workers` mock exists only so the action's module graph resolves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware, RequestContext, RequestHandler } from "remix/router";
import type { RemixNode } from "remix/ui";

import { createEnv } from "@sdxc/cloudflare-mocks";
import { createTranslator } from "@sdxc/i18n";
import { ServiceContainer } from "@sdxc/service-container";
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
import { describe, expect, test, vi } from "vitest";

import type { QuickPingError, QuickPingResult } from "~/app/http/controllers/actions/ping";
import type { Viewer } from "~/app/http/middleware/auth";
import type { SelectMembership, SelectTeam } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import en from "~/app/locales/en";
import { memberships, teams } from "~/database/schema";
import routes from "~/routes/web";

vi.doMock("cloudflare:workers", () => ({
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
	/**
	 * The description lives in the sheet, where a touch screen can actually display it,
	 * and the field's `aria-describedby` reaches it from both layouts so the copy exists
	 * once for both.
	 */
	test("renders the bar alone when no check has run", async () => {
		let { db, team, membership } = await createFixture();

		let response = await render(db, team, membership);
		expect(response.status).toBe(200);

		let body = await response.text();
		expect(body).toContain(en.page.dashboard.quickPing.action.submit);
		expect(body).toContain(en.page.dashboard.quickPing.description);
		expect(body).not.toContain(`title="${en.page.dashboard.quickPing.description}"`);
		expect(body).toContain('aria-describedby="quick-ping-help"');
		expect(body).not.toContain(en.page.dashboard.quickPing.result.status.up);
		expect(body).not.toContain("HTTP");
	});

	/**
	 * Two separate renderings would each read the once-only session result, and only
	 * whichever ran first would find it there — so one form serves both layouts,
	 * becoming a popover the trigger opens below 768px.
	 */
	test("serves both layouts from one form, opened by the trigger where it is a sheet", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await render(db, team, membership)).text();

		expect(body.match(/<form/g)?.length).toBe(1);
		expect(body).toContain('id="quick-ping-form"');
		expect(body).toContain('popover="auto"');
		expect(body).toContain('commandfor="quick-ping-form"');
		expect(body).toContain(`aria-label="${en.page.dashboard.quickPing.action.open}"`);
	});

	/**
	 * The header's fixed 64px row has no line to draw an answer on, so the answer gets
	 * its own region after the form; the field and button keep the order they submit
	 * in and stay put when a check comes back.
	 */
	test("reports the answer as a toast beside the bar rather than a line inside it", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await render(db, team, membership, await storeResult(upResult()))).text();

		let field = body.indexOf('name="url"');
		let submit = body.indexOf(`>${en.page.dashboard.quickPing.action.submit}<`);
		let status = body.indexOf(`>${en.page.dashboard.quickPing.result.status.up}<`);

		expect(field).toBeGreaterThan(-1);
		expect(submit).toBeGreaterThan(field);
		expect(status).toBeGreaterThan(submit);
		expect(body).toContain(`aria-label="${en.page.dashboard.quickPing.result.label}"`);
	});

	/**
	 * The caption's `<span>` is what gets clipped for the header's tight width — the
	 * `<label>` keeps wrapping the control regardless, so the accessible name never
	 * depends on the caption staying visible.
	 */
	test("names the field through a label that wraps it rather than through an id", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await render(db, team, membership)).text();

		expect(body).toMatch(
			new RegExp(
				`<label[^>]*>\\s*<span[^>]*>${en.page.dashboard.quickPing.field.label}</span>\\s*<input[^>]*name="url"`,
			),
		);
	});

	/**
	 * The redirect clears the form, so the target reaches the field only through its
	 * `value` attribute — asserted there since the placeholder happens to share this
	 * URL as a prefix and could otherwise match by accident.
	 */
	test("names the status and reports the code and the timing of the check that just ran", async () => {
		let { db, team, membership } = await createFixture();

		let response = await render(db, team, membership, await storeResult(upResult()));

		let body = await response.text();
		expect(body).toContain(en.page.dashboard.quickPing.result.status.up);
		expect(body).toContain("HTTP 200");
		expect(body).toContain("12 ms");
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

	/**
	 * The frame reloads itself right after a check runs, so a result that survived a
	 * second read would be shown as the answer to a check nobody just ran.
	 */
	test("shows an answer once, so a reloaded frame doesn't keep a stale one", async () => {
		let { db, team, membership } = await createFixture();
		let cookie = await storeResult(upResult());

		let first = await render(db, team, membership, cookie);
		expect(await first.text()).toContain("HTTP 200");

		let second = await render(db, team, membership, cookie);
		let body = await second.text();
		expect(body).not.toContain("HTTP 200");
		expect(body).toContain(en.page.dashboard.quickPing.action.submit);
	});

	/**
	 * The frame swap patches the toast already on screen, and replaying a finished
	 * animation on the same element plays nothing — held at `opacity: 0` by the first
	 * one's fill mode until the second answer gets an animation name of its own.
	 */
	test("fades each answer under an animation of its own, so a second one still plays", async () => {
		let { db, team, membership } = await createFixture();

		let first = await (await render(db, team, membership, await storeResult(upResult()))).text();
		let second = await (await render(db, team, membership, await storeResult(upResult()))).text();

		let firstFade = fadeName(first);
		let secondFade = fadeName(second);
		expect(firstFade).not.toBe(secondFade);
		expect(first).toContain(`@keyframes ${firstFade}`);
		expect(second).toContain(`@keyframes ${secondFade}`);
	});

	/**
	 * Two identical refusals produce the same code, copy, colour, and markup, so
	 * nothing in their wording could tell them apart — only the animation name
	 * distinguishes them.
	 */
	test("distinguishes two identical refusals, which nothing in their wording could", async () => {
		let { db, team, membership } = await createFixture();
		let refusal = (): QuickPingError => ({
			kind: "error",
			id: crypto.randomUUID(),
			code: "invalidUrl",
		});

		let first = await (await render(db, team, membership, await storeRefusal(refusal()))).text();
		let second = await (await render(db, team, membership, await storeRefusal(refusal()))).text();

		expect(first).toContain(en.page.dashboard.quickPing.error.invalidUrl);
		expect(fadeName(first)).not.toBe(fadeName(second));
	});

	/**
	 * The form action is where the no-JavaScript path submits, and `src` is where the
	 * hydrated island reloads the frame from — each points at its own URL.
	 */
	test("points the form at the run-ping action and the frame back at itself", async () => {
		let { db, team, membership } = await createFixture();

		let body = await (await render(db, team, membership)).text();

		expect(body).toContain(`action="${routes.actions.runPing.href({ team: team.slug })}"`);
		expect(body).toContain(
			`"src":"${routes.app.team.dashboard.quickPing.href({ team: team.slug })}"`,
		);
	});
});
