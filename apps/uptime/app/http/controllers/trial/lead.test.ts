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
 * The third suite is the free-watch cap, which is the only condition on the middle write.
 * One person gets one free week per URL per thirty days, and the cases worth testing are the
 * spellings that used to walk past that: a trailing slash, a fragment, a reordered query
 * string, and a `+tag` on the address. Each one has to land on the watch that already exists
 * — while `http://` and `https://` deliberately do not, and mail still goes to whichever
 * spelling of the address was actually typed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Renderer } from "remix/middleware/render";
import type { Middleware } from "remix/router";
import type { RemixNode } from "remix/ui";

import { createEnv } from "@pkg/cloudflare-mocks";
import { BatchedLogger } from "@pkg/logger";
import { MemoryTransport } from "@pkg/mail/memory";
import mail from "@pkg/mail/middleware";
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

import type { TrialProbeState } from "~/app/http/controllers/trial/session";

import Lead from "~/app/data/lead";
import TrialWatch from "~/app/data/trial-watch";
import { MAIL_FROM } from "~/app/emails/sender";
import { TrialConfirmationEmail } from "~/app/emails/trial-confirmation";
import { TrialRepeatReportEmail } from "~/app/emails/trial-repeat-report";
import {
	TRIAL_PROBE,
	TRIAL_WATCH_REPEATED,
	TRIAL_WATCH_STARTED,
} from "~/app/http/controllers/trial/session";
import i18n from "~/app/http/middleware/i18n";
import { createTestDatabase } from "~/app/lib/test/db";
import routes from "~/routes/web";

/**
 * Re-rendering the page on a rejected address pulls the try-it controller in, and through
 * it `HttpCheck` and `~/app/do/geo-fetch`, whose `DurableObject` base class only exists
 * inside the Workers runtime. Nothing here probes anything, so a bare base class and an
 * environment with no bindings at all are enough to let the module graph load — and the
 * environment being strict is what keeps that claim honest, since a binding this route
 * quietly started reading would fail by name rather than read as `undefined`.
 */
vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({}),
	waitUntil: () => {},
	DurableObject: class {},
}));

vi.doMock("~/app/services/trial-guard", () => ({
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

/**
 * Submits the capture form and returns everything it touched.
 *
 * `existing` reuses a database from an earlier submission, which is the only way to reach
 * the cap: it needs a watch this address already opened, and that has to have been opened by
 * a real submission rather than seeded past the code under test.
 */
async function submit(
	body: Record<string, string>,
	session: Session,
	existing?: ReturnType<typeof createTestDatabase>["db"],
	logger?: BatchedLogger,
) {
	let db = existing ?? createTestDatabase().db;
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
				/**
				 * Installed only when a test asks for it. Every other test in this file runs with
				 * no logger at all, which is what pins that the funnel event is optional.
				 */
				if (logger) (ctx as unknown as { logger: BatchedLogger }).logger = logger;
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

describe("POST /try/lead free-watch cap", () => {
	/**
	 * Opens the first watch on `url` for `email`, then submits `again` and returns the state
	 * both submissions left behind. Two real requests against one database, because the cap
	 * reads a row the first request wrote.
	 */
	async function submitTwice(first: { email: string; url: string }, again: Partial<typeof first>) {
		let one = new Session();
		one.set(TRIAL_PROBE, probeState({ url: first.url }));
		let { db } = await submit({ email: first.email }, one);

		transport.clear();

		let two = new Session();
		two.set(TRIAL_PROBE, probeState({ url: again.url ?? first.url }));
		let result = await submit({ email: again.email ?? first.email }, two, db);

		return { db, session: two, response: result.response };
	}

	/** Every watch in the database, whichever lead opened it. */
	async function allWatches(db: ReturnType<typeof createTestDatabase>["db"]) {
		let lead = await Lead.findByEmail(db, "reader@example.com");
		return lead === null ? [] : await TrialWatch.listByLead(db, lead.id);
	}

	test("opens no second watch on a URL that already has one", async () => {
		let { db } = await submitTwice(
			{ email: "reader@example.com", url: "https://probed.example/" },
			{},
		);

		expect(await allWatches(db)).toHaveLength(1);
	});

	test("sends the report of what the existing watch found, not the confirmation", async () => {
		await submitTwice({ email: "reader@example.com", url: "https://probed.example/" }, {});

		expect(transport.messages).toHaveLength(1);
		expect(transport.last?.email).toBeInstanceOf(TrialRepeatReportEmail);
	});

	/**
	 * Asserted through the rendered body rather than the argument: a token that reaches the
	 * template and renders no anchor would satisfy the weaker check, and the whole point of the
	 * link is that the reader can come back to the report after the mail is buried.
	 */
	test("links the existing watch's report page, addressed by that watch's own token", async () => {
		let { db } = await submitTwice(
			{ email: "reader@example.com", url: "https://probed.example/" },
			{},
		);

		let [watch] = await allWatches(db);
		expect(watch?.report_token).toBeTruthy();

		expect(transport.last?.html).toContain(
			routes.trial.report.href({ token: watch?.report_token ?? "" }),
		);
	});

	test("leaves the capped receipt rather than the one that claims a watch started", async () => {
		let { session, response } = await submitTwice(
			{ email: "reader@example.com", url: "https://probed.example/" },
			{},
		);

		expect(response.status).toBe(303);
		expect(session.get(TRIAL_WATCH_STARTED)).toBeUndefined();
		expect(session.get(TRIAL_WATCH_REPEATED)).toBe("https://probed.example/");
	});

	test("claims the probe, so the capped submission is not repeatable either", async () => {
		let { session } = await submitTwice(
			{ email: "reader@example.com", url: "https://probed.example/" },
			{},
		);

		expect(session.get(TRIAL_PROBE)).toBeUndefined();
	});

	test.each([
		["a trailing slash", "https://probed.example"],
		["a fragment", "https://probed.example/#pricing"],
		["an uppercase host", "https://PROBED.example/"],
	])("caps a resubmission spelled with %s", async (_label, spelling) => {
		let { db } = await submitTwice(
			{ email: "reader@example.com", url: "https://probed.example/" },
			{ url: spelling },
		);

		expect(await allWatches(db)).toHaveLength(1);
		expect(transport.last?.email).toBeInstanceOf(TrialRepeatReportEmail);
	});

	test("caps a resubmission whose query parameters were reordered", async () => {
		let { db } = await submitTwice(
			{ email: "reader@example.com", url: "https://probed.example/api?b=2&a=1" },
			{ url: "https://probed.example/api?a=1&b=2" },
		);

		expect(await allWatches(db)).toHaveLength(1);
	});

	test.each([["hello+b@sergiodxa.com"], ["HELLO@sergiodxa.com"]])(
		"caps a resubmission from %s, which is the same person",
		async (spelling) => {
			let one = new Session();
			one.set(TRIAL_PROBE, probeState({ url: "https://probed.example/" }));
			let { db } = await submit({ email: "hello+a@sergiodxa.com" }, one);

			transport.clear();

			let two = new Session();
			two.set(TRIAL_PROBE, probeState({ url: "https://probed.example/" }));
			await submit({ email: spelling }, two, db);

			let lead = await Lead.findByEmail(db, "hello@sergiodxa.com");
			expect(await TrialWatch.listByLead(db, lead!.id)).toHaveLength(1);
			expect(transport.last?.email).toBeInstanceOf(TrialRepeatReportEmail);
		},
	);

	/** Tagging is a privacy practice, not a bypass: the report goes to the spelling they used. */
	test("mails the report to the address as typed, not to the key it was capped under", async () => {
		let one = new Session();
		one.set(TRIAL_PROBE, probeState({ url: "https://probed.example/" }));
		let { db } = await submit({ email: "hello+a@sergiodxa.com" }, one);

		transport.clear();

		let two = new Session();
		two.set(TRIAL_PROBE, probeState({ url: "https://probed.example/" }));
		await submit({ email: "hello+b@sergiodxa.com" }, two, db);

		expect(transport.last?.to).toEqual([{ email: "hello+b@sergiodxa.com" }]);
	});

	/** The deliberate exception: two schemes are two endpoints and each is worth its own week. */
	test("starts a second watch for http when https already has one", async () => {
		let { db } = await submitTwice(
			{ email: "reader@example.com", url: "https://probed.example/" },
			{ url: "http://probed.example/" },
		);

		expect(await allWatches(db)).toHaveLength(2);
		expect(transport.last?.email).toBeInstanceOf(TrialConfirmationEmail);
	});

	test("starts a normal watch for a different URL from the same address", async () => {
		let { db, session } = await submitTwice(
			{ email: "reader@example.com", url: "https://probed.example/" },
			{ url: "https://other.example/" },
		);

		let watches = await allWatches(db);
		expect(watches.map((watch) => watch.url).sort()).toEqual([
			"https://other.example/",
			"https://probed.example/",
		]);
		expect(session.get(TRIAL_WATCH_STARTED)).toBe("https://other.example/");
		expect(transport.last?.email).toBeInstanceOf(TrialConfirmationEmail);
	});

	test("counts the report against the emails the lead has received", async () => {
		let { db } = await submitTwice(
			{ email: "reader@example.com", url: "https://probed.example/" },
			{},
		);

		// One confirmation for the watch that opened, one report for the one that was capped.
		expect((await Lead.findByEmail(db, "reader@example.com"))?.emails_sent).toBe(2);
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

/**
 * The `funnel.trial_monitor_started` event: the funnel's first commitment, emitted only for a
 * submission that actually started a week of checks. A capped submission is answered with a
 * report and starts nothing, so it is not one of these — and the event names the host and
 * never the URL or the address the visitor typed.
 */
describe("POST /try/lead funnel event", () => {
	/** Every trial-monitor-started event the request emitted. */
	function funnelEvents(logger: BatchedLogger) {
		return logger.events.filter((event) => event.event === "funnel.trial_monitor_started");
	}

	test("reports the watch, the host, and the check the visitor was shown", async () => {
		let session = new Session();
		session.set(TRIAL_PROBE, probeState({ url: "https://probed.example/health?token=secret" }));
		let logger = new BatchedLogger("test");

		let { db } = await submit(
			{ email: "reader@example.com", consent: "true" },
			session,
			undefined,
			logger,
		);

		let lead = await Lead.findByEmail(db, "reader@example.com");
		let watches = await TrialWatch.listByLead(db, lead!.id);

		expect(funnelEvents(logger)).toHaveLength(1);
		expect(funnelEvents(logger)[0]).toMatchObject({
			leadId: lead!.id,
			watchId: watches[0]!.id,
			hostname: "probed.example",
			monitorType: "http",
			immediateCheckSucceeded: true,
			consented: true,
		});
	});

	test("records a probe the visitor saw fail as one", async () => {
		let session = new Session();
		session.set(TRIAL_PROBE, probeState({ status: "down" }));
		let logger = new BatchedLogger("test");

		await submit({ email: "reader@example.com" }, session, undefined, logger);

		expect(funnelEvents(logger)[0]).toMatchObject({
			immediateCheckSucceeded: false,
			consented: false,
		});
	});

	test("names neither the address nor the URL", async () => {
		let session = new Session();
		session.set(TRIAL_PROBE, probeState({ url: "https://probed.example/admin?token=secret" }));
		let logger = new BatchedLogger("test");

		await submit({ email: "reader@example.com" }, session, undefined, logger);

		let [event] = funnelEvents(logger);
		expect(event).toBeDefined();
		for (let value of Object.values(event ?? {})) {
			if (typeof value !== "string") continue;
			expect(value).not.toContain("reader@example.com");
			expect(value).not.toContain("token=secret");
			expect(value).not.toContain("/admin");
		}
	});

	test("a capped submission started nothing and so reports nothing", async () => {
		let first = new Session();
		first.set(TRIAL_PROBE, probeState());
		let { db } = await submit({ email: "reader@example.com" }, first);

		let second = new Session();
		second.set(TRIAL_PROBE, probeState());
		let logger = new BatchedLogger("test");
		await submit({ email: "reader@example.com" }, second, db, logger);

		expect(funnelEvents(logger)).toHaveLength(0);
	});

	test("a rejected address wrote nothing and so reports nothing", async () => {
		let session = new Session();
		session.set(TRIAL_PROBE, probeState());
		let logger = new BatchedLogger("test");

		await submit({ email: "not-an-address" }, session, undefined, logger);

		expect(funnelEvents(logger)).toHaveLength(0);
	});

	test("a submission with no logger installed still opens the watch", async () => {
		let session = new Session();
		session.set(TRIAL_PROBE, probeState());

		let { response, db } = await submit({ email: "reader@example.com" }, session);

		expect(response.status).toBe(303);
		let lead = await Lead.findByEmail(db, "reader@example.com");
		expect(await TrialWatch.listByLead(db, lead!.id)).toHaveLength(1);
	});
});
