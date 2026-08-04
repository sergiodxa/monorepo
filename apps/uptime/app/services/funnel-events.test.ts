/**
 * Tests the funnel-event service: the names and properties each event emits, and the two
 * guarantees the callers depend on.
 *
 * The first is privacy, and it is the suite that matters most. Every one of these events is
 * emitted from a path that has a URL, an address or a webhook secret in scope, so the rule is
 * pinned twice over: once as "no typed property carries one", and once as "a value that looks
 * like one is redacted even if a property is added carelessly later".
 *
 * The second is that emitting cannot fail a request. A sink that throws, and no sink at all,
 * both have to leave the caller running — instrumentation is never a reason somebody's form
 * submission returns a 500.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import type { FunnelEventSink } from "~/app/services/funnel-events";

import {
	attributionProperties,
	hostnameOf,
	trackAccountCreated,
	trackAlertConfigured,
	trackFirstTrialAlertSent,
	trackFirstTrialCheckCompleted,
	trackSecondMonitorCreated,
	trackSubscriptionStarted,
	trackTrialMonitorStarted,
	trackTrialProgressEmailSent,
	trackUrlCheckCompleted,
	trackUrlCheckStarted,
} from "~/app/services/funnel-events";

/** One recorded emission, as the sink saw it. */
interface Recorded {
	event: string;
	payload: Record<string, unknown>;
}

/** A sink that keeps what it was handed, standing in for a request or job logger. */
function recordingSink() {
	let recorded: Recorded[] = [];

	let sink: FunnelEventSink = {
		info(event, payload) {
			recorded.push({ event, payload: payload ?? {} });
		},
	};

	return { sink, recorded };
}

/** A sink that fails the way a flushed or disposed logger would. */
const THROWING_SINK: FunnelEventSink = {
	info() {
		throw new Error("logger unavailable");
	},
};

describe("hostnameOf", () => {
	test("keeps the host and drops the path, query and fragment", () => {
		expect(hostnameOf("https://example.com/health?token=secret#frag")).toBe("example.com");
	});

	test("answers null for a string that is not a URL", () => {
		expect(hostnameOf("not a url")).toBeNull();
	});
});

describe("attributionProperties", () => {
	test("nulls every field when there is no record, so the event shape never changes", () => {
		expect(attributionProperties()).toEqual({ source: null, campaign: null, landingPath: null });
	});

	test("carries the three fields a first-touch record holds", () => {
		expect(
			attributionProperties({
				source: "outreach",
				campaign: "agencies-august",
				landingPath: "/for/agencies",
			}),
		).toEqual({ source: "outreach", campaign: "agencies-august", landingPath: "/for/agencies" });
	});
});

describe("event names", () => {
	test("every event is emitted under the funnel prefix", () => {
		let { sink, recorded } = recordingSink();

		trackUrlCheckStarted(sink, { hostname: "example.com", sourcePage: "/try", signedIn: false });
		trackUrlCheckCompleted(sink, {
			hostname: "example.com",
			sourcePage: "/try",
			signedIn: false,
			status: "up",
			succeeded: true,
			responseTimeMs: 42,
		});
		trackTrialMonitorStarted(sink, {
			leadId: "lead_1",
			watchId: "watch_1",
			hostname: "example.com",
			monitorType: "http",
			immediateCheckSucceeded: true,
			consented: false,
		});
		trackFirstTrialCheckCompleted(sink, {
			leadId: "lead_1",
			watchId: "watch_1",
			hostname: "example.com",
			monitorType: "http",
			status: "up",
			succeeded: true,
		});
		trackFirstTrialAlertSent(sink, {
			leadId: "lead_1",
			watchId: "watch_1",
			hostname: "example.com",
			monitorType: "http",
			status: "down",
			previousStatus: "up",
		});
		trackTrialProgressEmailSent(sink, {
			leadId: "lead_1",
			period: "daily",
			targets: 3,
			hadIncident: true,
		});
		trackAccountCreated(sink, {
			ownerId: "subject_1",
			fromTrial: true,
			watchCount: 2,
			emailsSent: 4,
			source: null,
			campaign: null,
			landingPath: null,
		});
		trackSubscriptionStarted(sink, {
			ownerId: "subject_1",
			fromTrial: true,
			monitorCount: 3,
			daysToConvert: 9,
			source: null,
			campaign: null,
			landingPath: null,
		});
		trackSecondMonitorCreated(sink, {
			teamId: "team_1",
			authorId: "subject_1",
			monitorType: "http",
			monitorCount: 2,
		});
		trackAlertConfigured(sink, {
			teamId: "team_1",
			alertId: "alert_1",
			strategy: "slack",
			monitorScoped: false,
			alertCount: 1,
		});

		expect(recorded.map((entry) => entry.event)).toEqual([
			"funnel.url_check_started",
			"funnel.url_check_completed",
			"funnel.trial_monitor_started",
			"funnel.first_trial_check_completed",
			"funnel.first_trial_alert_sent",
			"funnel.trial_progress_email_sent",
			"funnel.account_created",
			"funnel.subscription_started",
			"funnel.second_monitor_created",
			"funnel.alert_configured",
		]);
	});

	test("carries the properties it was given through untouched when they are safe", () => {
		let { sink, recorded } = recordingSink();

		trackSecondMonitorCreated(sink, {
			teamId: "team_1",
			authorId: "subject_1",
			monitorType: "http",
			monitorCount: 2,
		});

		expect(recorded[0]?.payload).toEqual({
			teamId: "team_1",
			authorId: "subject_1",
			monitorType: "http",
			monitorCount: 2,
		});
	});

	test("keeps a hostname, which is the most an event may say about a target", () => {
		let { sink, recorded } = recordingSink();

		trackTrialMonitorStarted(sink, {
			leadId: "lead_1",
			watchId: "watch_1",
			hostname: "status.example.co.uk",
			monitorType: "http",
			immediateCheckSucceeded: false,
			consented: true,
		});

		expect(recorded[0]?.payload.hostname).toBe("status.example.co.uk");
	});
});

describe("no personal data", () => {
	/**
	 * The rule, pinned as one table rather than one test each: an event may never carry a full
	 * URL, an address, a token, a query string, a response body, or free text. Each of these is
	 * fed in through a property whose type says `string`, which is exactly the mistake a future
	 * change could make, and every one of them has to come back out redacted.
	 */
	let unsafe: Array<[string, string]> = [
		["an email address", "reader@example.com"],
		["an address with a tag", "reader+trial@example.com"],
		["a full URL", "https://example.com/health"],
		["a bare-scheme URL", "http://169.254.169.254/latest/meta-data"],
		["a query string", "?token=abc123"],
		["a fragment", "#access_token=abc123"],
		["a response body", "OK - all systems nominal"],
		["a bearer token", `Bearer ${"a".repeat(40)}`],
		["an oversized blob", "a".repeat(101)],
	];

	for (let [description, value] of unsafe) {
		test(`redacts ${description}`, () => {
			let { sink, recorded } = recordingSink();

			trackAlertConfigured(sink, {
				teamId: "team_1",
				alertId: "alert_1",
				strategy: value,
				monitorScoped: false,
				alertCount: 1,
			});

			expect(recorded[0]?.payload.strategy).toBe("[redacted]");
		});
	}

	test("redacts an unsafe hostname rather than passing it through", () => {
		let { sink, recorded } = recordingSink();

		trackUrlCheckCompleted(sink, {
			hostname: "https://example.com/secret",
			sourcePage: "/try",
			signedIn: false,
			status: "down",
			succeeded: false,
			responseTimeMs: null,
		});

		expect(recorded[0]?.payload.hostname).toBe("[redacted]");
	});

	test("no emitted payload of any event contains an address, a URL or a query string", () => {
		let { sink, recorded } = recordingSink();

		/**
		 * Every event, each fed the worst value its string properties will accept, so the check
		 * is over the whole taxonomy at once rather than over the handful of events that happen
		 * to be interesting. Nothing that comes out may look like personal data.
		 */
		let poison = "reader@example.com?token=abc https://example.com/x";

		trackUrlCheckStarted(sink, { hostname: poison, sourcePage: poison, signedIn: false });
		trackUrlCheckCompleted(sink, {
			hostname: poison,
			sourcePage: poison,
			signedIn: true,
			status: "up",
			succeeded: true,
			responseTimeMs: 1,
		});
		trackTrialMonitorStarted(sink, {
			leadId: poison,
			watchId: poison,
			hostname: poison,
			monitorType: "http",
			immediateCheckSucceeded: true,
			consented: true,
		});
		trackFirstTrialCheckCompleted(sink, {
			leadId: poison,
			watchId: poison,
			hostname: poison,
			monitorType: "http",
			status: "up",
			succeeded: true,
		});
		trackFirstTrialAlertSent(sink, {
			leadId: poison,
			watchId: poison,
			hostname: poison,
			monitorType: "http",
			status: "down",
			previousStatus: "up",
		});
		trackTrialProgressEmailSent(sink, {
			leadId: poison,
			period: "weekly",
			targets: 1,
			hadIncident: false,
		});
		trackAccountCreated(sink, {
			ownerId: poison,
			fromTrial: true,
			watchCount: 1,
			emailsSent: 1,
			source: poison,
			campaign: poison,
			landingPath: poison,
		});
		trackSubscriptionStarted(sink, {
			ownerId: poison,
			fromTrial: false,
			monitorCount: 1,
			daysToConvert: null,
			source: poison,
			campaign: poison,
			landingPath: poison,
		});
		trackSecondMonitorCreated(sink, {
			teamId: poison,
			authorId: poison,
			monitorType: "http",
			monitorCount: 2,
		});
		trackAlertConfigured(sink, {
			teamId: poison,
			alertId: poison,
			strategy: poison,
			monitorScoped: true,
			alertCount: 1,
		});

		expect(recorded).toHaveLength(10);

		/**
		 * Asserted as "nothing that reaches a log looks like personal data" rather than as
		 * "everything was redacted", because the enum values these events legitimately carry —
		 * `up`, `http`, `daily` — are strings too and must survive.
		 */
		for (let entry of recorded) {
			for (let value of Object.values(entry.payload)) {
				if (typeof value !== "string") continue;
				expect(value).not.toMatch(/[@\s?#]|:\/\//);
				expect(value.length).toBeLessThanOrEqual(100);
			}
		}
	});
});

describe("emitting never throws into the caller", () => {
	test("a sink that throws is absorbed", () => {
		expect(() =>
			trackSecondMonitorCreated(THROWING_SINK, {
				teamId: "team_1",
				authorId: "subject_1",
				monitorType: "http",
				monitorCount: 2,
			}),
		).not.toThrow();
	});

	test("no sink at all is a no-op rather than a crash", () => {
		expect(() =>
			trackAlertConfigured(undefined, {
				teamId: "team_1",
				alertId: "alert_1",
				strategy: "email",
				monitorScoped: false,
				alertCount: 1,
			}),
		).not.toThrow();
	});

	test("an undefined property is dropped rather than recorded as a null", () => {
		let { sink, recorded } = recordingSink();

		trackUrlCheckStarted(sink, {
			hostname: undefined as unknown as string | null,
			sourcePage: "/try",
			signedIn: false,
		});

		expect(recorded[0]?.payload).toEqual({ sourcePage: "/try", signedIn: false });
	});
});
