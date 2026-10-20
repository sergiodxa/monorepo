/**
 * Every email the app sends, declared in one map with the schema of its props. Importing it
 * costs the schemas alone, so a controller or a job sends an email without loading the
 * template that renders it; every prop is plain JSON, so any of them can wait in a queue.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Schema } from "remix/data-schema";

import { email, emails } from "@sdxc/mail";
import * as s from "remix/data-schema";

import type { AlertEventSnapshot } from "~/database/schema";

/** The kinds of check an alert snapshot reports, one per monitor type. */
const SNAPSHOT_TYPES: readonly string[] = [
	"http",
	"dns",
	"tcp",
	"cron",
	"flow",
	"ssl",
	"registration",
];

/**
 * An instant as epoch milliseconds, which is how it travels, read by the template as a `Date`.
 *
 * @returns The schema of one instant.
 */
function instant() {
	return s.number().transform((ms) => new Date(ms));
}

/**
 * The snapshot an alert event stored, passed as the JSON it was written as. Its `type` picks
 * the fields the email reports, so a value naming no known check is refused.
 */
const ALERT_SNAPSHOT: Schema<unknown, AlertEventSnapshot> = s.createSchema((value, context) => {
	let type =
		typeof value === "object" && value !== null ? (value as { type?: unknown }).type : null;
	if (typeof type === "string" && SNAPSHOT_TYPES.includes(type)) {
		return { value: value as AlertEventSnapshot };
	}
	return s.fail("Expected an alert event snapshot", context.path);
});

/** One period of an uptime bar; `null` is a period no check covers. */
const SEGMENT = s.nullable(s.enum_(["up", "degraded", "down"]));

/** What one check on a watched trial URL found. */
const TRIAL_STATUS = s.enum_(["up", "degraded", "down"]);

/** The numbers a trial report shows under its bar. */
const TRIAL_STATS = s.object({
	checks: s.number(),
	uptime: s.nullable(s.string()),
	slowestResponseMs: s.nullable(s.number()),
});

/** One monitor's window, as either team digest lists it. */
const TEAM_DIGEST_MONITOR = s.object({
	id: s.string(),
	name: s.string(),
	type: s.enum_(["http", "dns", "tcp", "cron", "flow"]),
	status: SEGMENT,
	uptime: s.nullable(s.string()),
});

/** One yesterday flow run that still has a downloadable Performance trace (ADR-037). */
const TEAM_DIGEST_TRACE = s.object({
	monitorName: s.string(),
	downloadUrl: s.string(),
});

/** The links and the team every team digest carries. */
const TEAM_DIGEST = {
	teamName: s.string(),
	monitors: s.array(TEAM_DIGEST_MONITOR),
	dashboardUrl: s.string(),
	preferencesUrl: s.string(),
	unsubscribeUrl: s.string(),
};

/** The five funnel counters of one day or of a trailing window. */
const FUNNEL_COUNTERS = s.object({
	newLeads: s.number(),
	urlsChecked: s.number(),
	emailsSent: s.number(),
	freeSignups: s.number(),
	paidConversions: s.number(),
});

/** One account that came through the trial, as the funnel report itemises it. */
const FUNNEL_CONVERSION = s.object({
	urls: s.array(s.string()),
	watchCount: s.number(),
	emailsSent: s.number(),
	leadCreatedAt: instant(),
	signedUpAt: instant(),
	paidAt: s.nullable(instant()),
	attribution: s.nullable(s.string()),
});

/** The app's emails, grouped by who reads them: a team's members, or a trial's lead. */
export default emails({
	/** A monitor changed state, sent to the mailbox an alert names. */
	alert: email({
		props: s.object({
			subjectPrefix: s.string(),
			monitorName: s.string(),
			monitorType: s.enum_(["http", "dns", "tcp", "cron", "flow", "ssl", "registration"]),
			eventType: s.enum_(["down", "up", "degraded"]),
			snapshot: ALERT_SNAPSHOT,
			dashboardUrl: s.string(),
			occurredAt: instant(),
			incident: s.nullable(s.object({ sent: s.number(), suppressed: s.number() })),
		}),
	}),
	/** Confirms an account's deletion to the address it was requested from. */
	accountDeleted: email({ props: s.object({}) }),
	/** Yesterday's trial funnel, for whoever operates the deployment. */
	funnelReport: email({
		props: s.object({
			date: s.string(),
			counters: FUNNEL_COUNTERS,
			totals: FUNNEL_COUNTERS,
			totalDays: s.number(),
			paid: s.array(FUNNEL_CONVERSION),
			signups: s.array(FUNNEL_CONVERSION),
		}),
	}),
	teams: {
		invite: email({ props: s.object({ team: s.string(), url: s.string() }) }),
		/** Tells a former member that their team went with its owner's account. */
		deleted: email({ props: s.object({ team: s.string() }) }),
		dailyDigest: email({
			props: s.object({
				...TEAM_DIGEST,
				date: s.string(),
				/** Yesterday's flow runs with a still-stored Performance trace (ADR-037). */
				traces: s.array(TEAM_DIGEST_TRACE),
			}),
		}),
		weeklyDigest: email({
			props: s.object({
				...TEAM_DIGEST,
				since: s.string(),
				until: s.string(),
				segments: s.array(SEGMENT),
				uptime: s.nullable(s.string()),
			}),
		}),
	},
	trial: {
		/** The receipt for a free watch, sent the moment the address is handed over. */
		confirmation: email({
			props: s.object({
				url: s.string(),
				status: TRIAL_STATUS,
				responseStatus: s.nullable(s.number()),
				responseTimeMs: s.nullable(s.number()),
				checkedAt: instant(),
				watchUntil: instant(),
				unsubscribeToken: s.string(),
			}),
		}),
		/** A watched URL is doing something different from what it was. */
		change: email({
			props: s.object({
				url: s.string(),
				status: TRIAL_STATUS,
				previousStatus: TRIAL_STATUS,
				responseStatus: s.nullable(s.number()),
				responseTimeMs: s.nullable(s.number()),
				changedAt: instant(),
				unsubscribeToken: s.string(),
			}),
		}),
		/** What a URL's second submission earns in place of a second free week. */
		repeatReport: email({
			props: s.object({
				url: s.string(),
				watchingSince: instant(),
				segments: s.array(SEGMENT),
				stats: TRIAL_STATS,
				subscribeUrl: s.string(),
				reportToken: s.optional(s.string()),
				unsubscribeToken: s.string(),
			}),
		}),
		dailyDigest: email({
			props: s.object({
				targets: s.array(
					s.object({
						url: s.string(),
						status: TRIAL_STATUS,
						segments: s.array(SEGMENT),
						stats: TRIAL_STATS,
					}),
				),
				unsubscribeToken: s.string(),
			}),
		}),
		/** The seven-day wrap-up that closes one URL's free watch. */
		weeklyDigest: email({
			props: s.object({
				url: s.string(),
				segments: s.array(SEGMENT),
				stats: TRIAL_STATS,
				subscribeUrl: s.string(),
				reportToken: s.optional(s.string()),
				unsubscribeToken: s.string(),
			}),
		}),
	},
});
