/**
 * Tests `POST /try/lead`: the three writes it makes, and the two things it refuses to
 * take on trust.
 *
 * The URL is the first. A watch is a week of hourly outbound fetches, so the target has to
 * be the one the guard already approved and the probe already ran — never a value posted
 * back up from the browser. The tests submit a URL in the form and assert the watch
 * ignores it, and that a submission with no probe in the session creates nothing at all.
 *
 * Consent is the second. The opt-in is an unticked checkbox, which a browser does not
 * submit, so its absence has to mean "no consent" and not "validation error" and not
 * "default true". `consented_at` staying null while the watch is created anyway is the
 * whole distinction the column exists for: an address given so we can report on one URL is
 * not an address that agreed to be marketed to.
 *
 * The two answers differ in kind and both are asserted: a success redirects, because it
 * has written rows and queued mail and must not be repeatable by a reload, while a rejected
 * address changed nothing and comes back as the page itself with the result still on it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { Middleware } from "remix/fetch-router";
import type { Renderer } from "remix/render-middleware";
import type { RemixNode } from "remix/ui";

import { MemoryTransport } from "@pkg/mail/memory";
import mail from "@pkg/mail/middleware";
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

import Lead from "~/app/data/lead";
import TrialWatch from "~/app/data/trial-watch";
import { MAIL_FROM } from "~/app/emails/sender";
import { TRIAL_PROBE, TRIAL_WATCH_STARTED } from "~/app/http/controllers/trial/session";
import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import routes from "~/routes/web";

/**
 * Re-rendering the page on a rejected address pulls the try-it controller in, and through
 * it `HttpCheck` and `~/app/do/geo-fetch`, whose `DurableObject` base class only exists
 * inside the Workers runtime. Nothing here probes anything, so a bare base class and an
 * empty environment are enough to let the module graph load.
 */
mock.module("cloudflare:workers", () => ({
	env: {},
	waitUntil: () => {},
	DurableObject: class {},
}));

mock.module("~/app/services/trial-guard", () => ({
	guardTrialProbe: async () => {
		throw new Error("POST /try/lead must never run a probe");
	},
	trialTurnstileSiteKey: () => null,
}));

let { default: trialLead } = await import("./lead");

/** Renders through `renderToString` — this page renders no `<Frame>`. */
function createTestRenderer(): Renderer<RemixNode> {
	return async (node, init) => {
		let html = await renderToString(node);
		let headers = new Headers(init?.headers);
		headers.set("content-type", "text/html; charset=utf-8");
		return new Response(html, { ...init, headers });
	};
}

/** A probe as `POST /try` would have left it in the session. */
function probeState(overrides: Partial<TrialProbeState> = {}): TrialProbeState {
	return {
		url: "https://probed.example/",
		status: "up",
		responseStatus: 200,
		responseTimeMs: 88,
		location: null,
		checkedAt: Date.UTC(2026, 0, 2, 3, 4, 5),
		...overrides,
	};
}

let transport = new MemoryTransport();

/** Submits the capture form against a fresh database and returns everything it touched. */
async function submit(body: Record<string, string>, session: Session) {
	let { db } = createTestDatabase();
	let container = new ServiceContainer();
	container.instance(Database, db);

	let router = createRouter({
		middleware: [
			asyncContext(),
			((ctx, next) => {
				ctx.set(Auth, { ok: false });
				return next();
			}) as Middleware,
			((ctx, next) => {
				ctx.set(Session, session, { property: "session" });
				return next();
			}) as Middleware,
			mail({ transport, from: MAIL_FROM }),
			i18n as Middleware,
			formData() as Middleware,
			renderWith(createTestRenderer) as Middleware,
		],
	});
	router.map(routes.trial.lead, trialLead);

	let request = new Request(`https://uptime.test${routes.trial.lead.href()}`, {
		method: "POST",
		headers: { "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(body),
	});

	let response = await container.scope(() => router.fetch(request));

	return { response, db, session };
}

beforeEach(() => {
	transport.clear();
});

describe("POST /try/lead", () => {
	test("records the lead, opens the watch, and redirects back", async () => {
		let session = new Session();
		session.set(TRIAL_PROBE, probeState());

		let { response, db } = await submit({ email: "reader@example.com" }, session);

		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(routes.trial.check.index.href());

		let lead = await Lead.findByEmail(db, "reader@example.com");
		expect(lead).not.toBeNull();

		let watches = await TrialWatch.listByLead(db, lead!.id);
		expect(watches).toHaveLength(1);
		expect(watches[0]?.url).toBe("https://probed.example/");
	});

	test("seeds the watch with the status the visitor was shown", async () => {
		let session = new Session();
		session.set(TRIAL_PROBE, probeState({ status: "degraded" }));

		let { db } = await submit({ email: "reader@example.com" }, session);

		let lead = await Lead.findByEmail(db, "reader@example.com");
		let watches = await TrialWatch.listByLead(db, lead!.id);
		expect(watches[0]?.last_status).toBe("degraded");
	});

	test("watches the probed URL and not one posted in the form", async () => {
		let session = new Session();
		session.set(TRIAL_PROBE, probeState({ url: "https://probed.example/" }));

		let { db } = await submit(
			{ email: "reader@example.com", url: "http://169.254.169.254/" },
			session,
		);

		let lead = await Lead.findByEmail(db, "reader@example.com");
		let watches = await TrialWatch.listByLead(db, lead!.id);
		expect(watches[0]?.url).toBe("https://probed.example/");
	});

	test("creates nothing when no probe is waiting to be claimed", async () => {
		let { response, db } = await submit({ email: "reader@example.com" }, new Session());

		expect(response.status).toBe(303);
		expect(await Lead.findByEmail(db, "reader@example.com")).toBeNull();
		expect(transport.messages).toHaveLength(0);
	});

	test("claims the probe so a resubmit cannot open a second watch on it", async () => {
		let session = new Session();
		session.set(TRIAL_PROBE, probeState());

		await submit({ email: "reader@example.com" }, session);

		expect(session.get(TRIAL_PROBE)).toBeUndefined();
	});

	test("leaves a receipt for the page to render once", async () => {
		let session = new Session();
		session.set(TRIAL_PROBE, probeState());

		await submit({ email: "reader@example.com" }, session);

		expect(session.get(TRIAL_WATCH_STARTED)).toBe("https://probed.example/");
	});

	test("sends the confirmation to the address that was handed over", async () => {
		let session = new Session();
		session.set(TRIAL_PROBE, probeState());

		await submit({ email: "reader@example.com" }, session);

		expect(transport.messages).toHaveLength(1);
		expect(transport.last?.to).toEqual([{ email: "reader@example.com" }]);
	});
});

describe("POST /try/lead consent", () => {
	test("creates the watch without consent when the box was left unticked", async () => {
		let session = new Session();
		session.set(TRIAL_PROBE, probeState());

		let { db } = await submit({ email: "reader@example.com" }, session);

		let lead = await Lead.findByEmail(db, "reader@example.com");
		expect(lead?.consented_at).toBeNull();
		expect(Lead.hasMarketingConsent(lead!)).toBe(false);
		expect(await TrialWatch.listByLead(db, lead!.id)).toHaveLength(1);
	});

	test("records consent when the box was ticked", async () => {
		let session = new Session();
		session.set(TRIAL_PROBE, probeState());

		let { db } = await submit({ email: "reader@example.com", consent: "true" }, session);

		let lead = await Lead.findByEmail(db, "reader@example.com");
		expect(lead?.consented_at).not.toBeNull();
		expect(Lead.hasMarketingConsent(lead!)).toBe(true);
	});
});

describe("POST /try/lead validation", () => {
	test("re-renders the page with the field flagged when the address is unusable", async () => {
		let session = new Session();
		session.set(TRIAL_PROBE, probeState());

		let { db, response } = await submit({ email: "not-an-address" }, session);
		let body = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("location")).toBeNull();
		expect(body).toContain("That does not look like an email address.");
		expect(await TrialWatch.claimDue(db, Date.now() + 86_400_000)).toHaveLength(0);
	});

	test("keeps the result on the page, so a typo does not cost the check", async () => {
		let session = new Session();
		session.set(TRIAL_PROBE, probeState());

		let { response } = await submit({ email: "not-an-address" }, session);
		let body = await response.text();

		expect(body).toContain("Check another URL");
		expect(body).toContain("https://probed.example/");
		expect(session.get(TRIAL_PROBE)).toBeDefined();
	});
});
