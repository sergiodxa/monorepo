/**
 * Product-funnel instrumentation: one typed function per step between "a stranger probed a
 * URL" and "an account started paying", each emitted as a `funnel.*` structured log line.
 * It exists because the durable counters only know how many of each thing happened per day,
 * and the questions that decide what to build next — which CTA, which campaign, whether the
 * first check succeeded, whether a trial saw an incident — are properties of one event.
 *
 * ## Why the logger and not a new table or a new dataset
 *
 * Workers Logs is queryable per field, retained long enough to answer a question about last
 * week, and already carries every other structured event this app emits — so a funnel event
 * lands next to the `job.*` and `trial_conversion.*` lines that explain it. The durable
 * aggregates the operator reads every morning are `trial_daily_stats`, which is written from
 * the rows themselves and is therefore correct even for a day whose logs have rolled off;
 * these events are the *detail* under those totals, not a second source of truth for them.
 * A table would need a migration and a retention sweep to answer questions asked once, and
 * the ping Analytics Engine dataset is per-team by construction: every query against it
 * filters a team id and a monitor id, neither of which most of these events has.
 *
 * ## What is deliberately not here
 *
 * There is no `email_verification_sent` and no `email_verified`. The trial has no
 * verification step by design — an address is asked for once, and the confirmation email
 * *is* the proof it works — so those two events could only ever be emitted as fictions, and
 * a funnel with an invented 100%-passing step in it is worse than one with an honest gap.
 *
 * ## Nothing personal is ever in an event
 *
 * The property types carry no field for a full URL, an address, a token or a response body:
 * targets are described by hostname, people by opaque id. {@link scrub} is the backstop
 * behind that, not the rule — any string value that looks like an address, a URL, a query
 * string or an oversized blob is replaced before it leaves this module, so a future property
 * added carelessly degrades to `[redacted]` rather than to a leak.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TrialAttribution } from "~/app/http/middleware/attribution";
import type { MonitorStatus } from "~/database/schema";

/** Prefix every event name carries, so one filter selects the whole funnel. */
const EVENT_PREFIX = "funnel";

/**
 * Longest string value an event property may carry.
 *
 * Sized for the values that are legitimate here — a hostname, a UUID, a strategy name — and
 * well under anything that could be a token, a JWT or a response fragment. A value over the
 * bound is redacted rather than truncated, because a truncated secret is still a secret.
 */
const MAX_STRING_LENGTH = 100;

/**
 * What makes a string value unsafe to record: an `@` (an address), a `://` (a full URL), a
 * `?` or `#` (a query string or fragment, which is where identifiers and tokens travel), or
 * any whitespace (free text, which is never one of this module's typed values).
 */
const UNSAFE_STRING = /[@\s?#]|:\/\//;

/** What a redacted value reads as, so a leak shows up as a hole rather than as silence. */
const REDACTED = "[redacted]";

/** Every funnel event this app emits, as the suffix after `funnel.`. */
export type FunnelEventName =
	| "url_check_started"
	| "url_check_completed"
	| "trial_monitor_started"
	| "first_trial_check_completed"
	| "first_trial_alert_sent"
	| "trial_progress_email_sent"
	| "account_created"
	| "subscription_started"
	| "second_monitor_created"
	| "alert_configured";

/**
 * The one method this module needs from a logger, so a fetch handler can pass its
 * `RequestLogger`, a job its batched one, and a service the immediate singleton, without any
 * of them being converted to the others.
 *
 * Accepting `undefined` is deliberate rather than lax: a surface with no logger installed
 * must still be able to call these, since an event that cannot be recorded is a missing line
 * in a report and never a failed request.
 */
export interface FunnelEventSink {
	info(event: string, payload?: Record<string, unknown>): void;
}

/** The three campaign fields every event may carry, as they are named in an event. */
export interface FunnelAttribution {
	/** Campaign source, e.g. `outreach`; `null` when the visit carried none. */
	source: string | null;
	/** Campaign name, e.g. `agencies-august`; `null` when the visit carried none. */
	campaign: string | null;
	/** Path of the first page the visitor landed on. Never a query string. */
	landingPath: string | null;
}

/** What kind of check an event is about, matching the monitor types this app sells. */
export type FunnelMonitorType = "http" | "dns" | "tcp" | "cron";

/**
 * What {@link attributionProperties} accepts: the first-touch record as the session carries
 * it, or the same three fields as they were copied onto a stored conversion. The two differ
 * only in whether a landing path can be absent, so widening that one field is what lets both
 * callers pass the record they happen to hold instead of rebuilding it.
 */
export type FunnelAttributionInput = Pick<TrialAttribution, "source" | "campaign"> & {
	landingPath: string | null;
};

/**
 * The campaign fields off a first-touch record, with every one nulled when there is no
 * record at all — so an event's shape does not change with whether attribution was captured,
 * and a query can group by `source` without a missing-key case.
 *
 * @param attribution - The first-touch record, when the caller has one.
 */
export function attributionProperties(attribution?: FunnelAttributionInput): FunnelAttribution {
	return {
		source: attribution?.source ?? null,
		campaign: attribution?.campaign ?? null,
		landingPath: attribution?.landingPath ?? null,
	};
}

/**
 * The host behind a URL, which is the most an event may say about somebody's target.
 *
 * A hostname is what makes an event readable — "the check that failed was against a `.local`
 * address" is worth knowing — while the path and query are the parts that carry identifiers,
 * tokens and, on a status endpoint, the customer's own naming.
 *
 * @param url - A URL string, already resolved by whatever validated it.
 * @returns The hostname, or `null` when the string will not parse as a URL.
 * @example hostnameOf("https://example.com/health?token=abc") // "example.com"
 */
export function hostnameOf(url: string): string | null {
	try {
		return new URL(url).hostname;
	} catch {
		return null;
	}
}

/**
 * Replaces every value that could carry personal data with {@link REDACTED}, and drops
 * `undefined` so an absent property is absent rather than a `null` that means "we looked".
 *
 * This is a backstop and not the rule — the property interfaces are what keep addresses and
 * URLs out — but it is the part that still holds when somebody adds a field in a hurry.
 * Numbers and booleans pass through untouched: neither can be an address, and both are what
 * the counts in these events are made of.
 */
function scrub(properties: Record<string, unknown>): Record<string, unknown> {
	let safe: Record<string, unknown> = {};

	for (let [key, value] of Object.entries(properties)) {
		if (value === undefined) continue;

		if (typeof value !== "string") {
			safe[key] = value;
			continue;
		}

		safe[key] = value.length > MAX_STRING_LENGTH || UNSAFE_STRING.test(value) ? REDACTED : value;
	}

	return safe;
}

/**
 * Emits one event, and swallows anything that goes wrong doing so.
 *
 * Every caller here sits on a path a person is waiting on — a form submission, a sign-in, an
 * email send — so the guarantee this module makes is that measuring a step can never be the
 * reason the step failed. The same swallow-and-carry-on discipline the trial conversion
 * service applies to its own writes, one level stricter: there is not even a failure to log,
 * because the thing that failed was the logging.
 */
function emit(
	sink: FunnelEventSink | undefined,
	event: FunnelEventName,
	properties: Record<string, unknown>,
): void {
	try {
		sink?.info(`${EVENT_PREFIX}.${event}`, scrub(properties));
	} catch {
		// Nothing to report the failed report to, and nothing worth failing a request over.
	}
}

/** A visitor asked the public page to check a target. */
export interface UrlCheckStartedProperties {
	/** The target's host. Never the full URL. */
	hostname: string | null;
	/** Path the check was asked for from, which is the only page that offers one. */
	sourcePage: string;
	/** Whether a signed-in viewer asked, who is shown no email capture and so cannot convert. */
	signedIn: boolean;
}

/**
 * The top of the funnel: a check was requested. Paired with
 * {@link trackUrlCheckCompleted}, so a probe that never answered is visible as the gap
 * between the two counts rather than as nothing at all.
 */
export function trackUrlCheckStarted(
	sink: FunnelEventSink | undefined,
	properties: UrlCheckStartedProperties,
): void {
	emit(sink, "url_check_started", { ...properties });
}

/** The public page's check answered. */
export interface UrlCheckCompletedProperties {
	hostname: string | null;
	sourcePage: string;
	signedIn: boolean;
	/** How the check classified, in the monitor status vocabulary a paid check uses. */
	status: MonitorStatus;
	/** Whether the target answered as expected, which is what decides the page's headline. */
	succeeded: boolean;
	/** Round trip in milliseconds, or `null` when nothing answered. */
	responseTimeMs: number | null;
}

/**
 * A completed check, and the first point in the funnel where the *quality* of what a visitor
 * saw is recorded — a page whose checks mostly fail converts differently from one whose
 * checks mostly pass, and that difference is invisible in a bare count of probes.
 */
export function trackUrlCheckCompleted(
	sink: FunnelEventSink | undefined,
	properties: UrlCheckCompletedProperties,
): void {
	emit(sink, "url_check_completed", { ...properties });
}

/** A stranger left an address and a target became a watched one. */
export interface TrialMonitorStartedProperties {
	/** The lead the watch belongs to, as its opaque id. */
	leadId: string;
	/** The watch just created. */
	watchId: string;
	hostname: string | null;
	monitorType: FunnelMonitorType;
	/** Whether the probe they had just watched run succeeded. */
	immediateCheckSucceeded: boolean;
	/** Whether they ticked the optional marketing opt-in, which is not required to be here. */
	consented: boolean;
}

/**
 * The funnel's first commitment: an address was handed over and a week of free checks
 * started. The event fires only for a watch that was actually created — a submission capped
 * by the one-week-per-URL rule started nothing and is not one of these.
 */
export function trackTrialMonitorStarted(
	sink: FunnelEventSink | undefined,
	properties: TrialMonitorStartedProperties,
): void {
	emit(sink, "trial_monitor_started", { ...properties });
}

/** The hourly sweep ran a watch's very first check. */
export interface FirstTrialCheckCompletedProperties {
	leadId: string;
	watchId: string;
	hostname: string | null;
	monitorType: FunnelMonitorType;
	status: MonitorStatus;
	/** Whether that first unattended check succeeded. */
	succeeded: boolean;
}

/**
 * The step that turns a promise into a service: the first check nobody was watching. A watch
 * whose first check never happens is a lead who was told we would watch their site and then
 * was not, which no aggregate count of checks would surface.
 */
export function trackFirstTrialCheckCompleted(
	sink: FunnelEventSink | undefined,
	properties: FirstTrialCheckCompletedProperties,
): void {
	emit(sink, "first_trial_check_completed", { ...properties });
}

/** A watch's first "your target changed" email went out. */
export interface FirstTrialAlertSentProperties {
	leadId: string;
	watchId: string;
	hostname: string | null;
	monitorType: FunnelMonitorType;
	/** What it changed to. */
	status: MonitorStatus;
	/** What it was before, which is what makes the message worth sending. */
	previousStatus: MonitorStatus;
}

/**
 * The trial's moment of proof, and the strongest single predictor in this funnel: a lead who
 * has been told their site went down has seen the product do the one thing it is for.
 * Emitted only for the first such email per watch, since the second one is a flapping target
 * rather than a new step.
 */
export function trackFirstTrialAlertSent(
	sink: FunnelEventSink | undefined,
	properties: FirstTrialAlertSentProperties,
): void {
	emit(sink, "first_trial_alert_sent", { ...properties });
}

/** A lead was sent their progress report. */
export interface TrialProgressEmailSentProperties {
	leadId: string;
	/** Which recurring report this was. */
	period: "daily" | "weekly";
	/** How many watched targets the email covered. */
	targets: number;
	/** Whether any of those targets was unhealthy in the window the email reports. */
	hadIncident: boolean;
}

/**
 * Continued engagement, per send rather than per lead: the number of these somebody received
 * before they signed up is the one measure of how much of the trial they actually saw, and
 * it cannot be recovered afterwards because the lead row is deleted within thirty days.
 */
export function trackTrialProgressEmailSent(
	sink: FunnelEventSink | undefined,
	properties: TrialProgressEmailSentProperties,
): void {
	emit(sink, "trial_progress_email_sent", { ...properties });
}

/** An account came into being. */
export interface AccountCreatedProperties extends FunnelAttribution {
	/** The subject who owns it. */
	ownerId: string;
	/** Whether this account was traced back to a lead on the public page. */
	fromTrial: boolean;
	/** How many targets they had tried before signing up; `0` for an account with no lead. */
	watchCount: number;
	/** How many trial emails they had received by then; `0` for an account with no lead. */
	emailsSent: number;
}

/**
 * The middle of the funnel. Carries the campaign fields because sign-in is the only moment
 * at which an anonymous first touch and an identified account are known to be the same
 * person — after the redirect the session that captured the campaign is gone.
 */
export function trackAccountCreated(
	sink: FunnelEventSink | undefined,
	properties: AccountCreatedProperties,
): void {
	emit(sink, "account_created", { ...properties });
}

/** An account started paying. */
export interface SubscriptionStartedProperties extends FunnelAttribution {
	ownerId: string;
	/** Whether this customer was traced back to a lead on the public page. */
	fromTrial: boolean;
	/** How many monitors the account held at the moment it converted. */
	monitorCount: number;
	/** Days between the lead being created and the first payment; `null` with no lead. */
	daysToConvert: number | null;
}

/**
 * The bottom of the funnel. Emitted for the *first* payment only, so the renewals and plan
 * changes that re-assert entitlement every month cannot inflate a conversion count.
 */
export function trackSubscriptionStarted(
	sink: FunnelEventSink | undefined,
	properties: SubscriptionStartedProperties,
): void {
	emit(sink, "subscription_started", { ...properties });
}

/** A team created the monitor that took it from one to two. */
export interface SecondMonitorCreatedProperties {
	teamId: string;
	/** The member who created it. */
	authorId: string;
	monitorType: FunnelMonitorType;
	/** The team's monitor count immediately after the creation, which is `2` for this event. */
	monitorCount: number;
}

/**
 * Activation, and the reason it is the second monitor and not the first: the first can be the
 * one the sign-up flow converted for them or the one they made to see whether the product
 * works, while the second is somebody who decided to keep using it. Nothing else in this
 * funnel distinguishes a curious visitor from a user.
 */
export function trackSecondMonitorCreated(
	sink: FunnelEventSink | undefined,
	properties: SecondMonitorCreatedProperties,
): void {
	emit(sink, "second_monitor_created", { ...properties });
}

/** A team configured somewhere for its alerts to go. */
export interface AlertConfiguredProperties {
	teamId: string;
	/** The alert row, as its opaque id. */
	alertId: string;
	/** Where the notification goes. Never the destination itself. */
	strategy: string;
	/** Whether it is scoped to one monitor rather than to every monitor on the team. */
	monitorScoped: boolean;
	/** The team's alert count immediately after this one, so the first is `1`. */
	alertCount: number;
}

/**
 * The other half of activation: a team that has told us where to reach them is a team that
 * expects to be reached. The strategy name is recorded and its configuration never is —
 * every strategy's config is a destination, and three of the four are a secret URL.
 */
export function trackAlertConfigured(
	sink: FunnelEventSink | undefined,
	properties: AlertConfiguredProperties,
): void {
	emit(sink, "alert_configured", { ...properties });
}
