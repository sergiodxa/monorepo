/**
 * Structured `funnel.*` records for each step between an anonymous URL probe
 * and a paying subscription, written onto the invocation's log as `funnel.*`
 * fields — so a question about one property, a campaign or a check result, is
 * a query — and as a note carrying the same properties. Every property type
 * carries hostnames and opaque ids only; {@link scrub} redacts any string
 * that looks like an address, URL, or token before it ships.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Log } from "@sdxc/logger";

import type { TrialAttribution } from "~/app/http/middleware/attribution";
import type { MonitorStatus } from "~/database/schema";

/** Prefix every event name carries, so one filter selects the whole funnel. */
const EVENT_PREFIX = "funnel";

/**
 * Sized for legitimate values here — a hostname, a UUID, a strategy name — comfortably
 * under anything that could be a token or JWT; an oversized value is redacted, since a
 * truncated secret is still a secret.
 */
const MAX_STRING_LENGTH = 100;

/**
 * What makes a string value unsafe to record: an `@` (an address), a `://` (a full URL), a
 * `?` or `#` (a query string or fragment, which is where identifiers and tokens travel), or
 * any whitespace (free text, which is never one of this module's typed values).
 */
const UNSAFE_STRING = /[@\s?#]|:\/\//;

/** What a redacted value reads as, so a leak shows up as a visible hole in the log. */
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
 * The two methods this module needs from the invocation's log, so any caller can pass the
 * `ctx.log` or `currentLog()` it already holds, `undefined` included: an unrecorded event
 * costs only a missing report line, while the caller's own request completes regardless.
 */
export type FunnelEventSink = Pick<Log, "set" | "note">;

/** What a funnel step may say about itself: scalars only, so every property is a field. */
type FunnelProperties = Record<string, Log.Value | undefined>;

/** The three campaign fields every event may carry, as they are named in an event. */
export interface FunnelAttribution {
	/** Campaign source, e.g. `outreach`; `null` when the visit carried none. */
	source: string | null;
	/** Campaign name, e.g. `agencies-august`; `null` when the visit carried none. */
	campaign: string | null;
	/** Path of the first page the visitor landed on, as just the pathname. */
	landingPath: string | null;
}

/** What kind of check an event is about, matching the monitor types this app sells. */
export type FunnelMonitorType = "http" | "dns" | "tcp" | "cron";

/**
 * What {@link attributionProperties} accepts: the first-touch record as the session carries
 * it, or the same three fields copied onto a stored conversion, differing only in whether a
 * landing path can be absent — so both callers pass the record they already hold.
 */
export type FunnelAttributionInput = Pick<TrialAttribution, "source" | "campaign"> & {
	landingPath: string | null;
};

/**
 * The campaign fields off a first-touch record, with every one nulled when there is no
 * record at all — so an event's shape stays the same whether attribution was captured, and
 * a query can group by `source` without a missing-key case.
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
 * The host behind a URL, which is the most an event may say about somebody's target: the
 * path and query are what carry identifiers, tokens, and a customer's own naming.
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
 * Replaces every value that could carry personal data with {@link REDACTED}, dropping
 * `undefined` so an absent property stays absent. A backstop behind the property
 * interfaces, for a `string` field added in a hurry; numbers and booleans pass through.
 */
function scrub(properties: FunnelProperties): Record<string, Log.Value> {
	let safe: Record<string, Log.Value> = {};

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
 * Records one step as `funnel.step` plus one `funnel.*` field per property, so the record
 * is queryable by any of them, and as a note so a record carrying two steps keeps both.
 * Swallows anything that goes wrong doing so: every caller sits on a path a person is
 * waiting on, so measuring a step always leaves that step to succeed or fail on its own.
 */
function emit(
	sink: FunnelEventSink | undefined,
	event: FunnelEventName,
	properties: FunnelProperties,
): void {
	try {
		let safe = scrub(properties);
		sink?.set({ [EVENT_PREFIX]: { step: event, ...safe } });
		sink?.note(`${EVENT_PREFIX}.${event}`, safe);
	} catch {}
}

/** A visitor asked the public page to check a target. */
export interface UrlCheckStartedProperties {
	/** The target's host, e.g. `example.com`. */
	hostname: string | null;
	/** Path the check was asked for from, which is the only page that offers one. */
	sourcePage: string;
	/** Whether the viewer asking was already signed in, and so already has an account. */
	signedIn: boolean;
}

/**
 * The top of the funnel: a check was requested. Paired with
 * {@link trackUrlCheckCompleted}, so a probe that never answered shows up as the gap
 * between the two counts.
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
	/** Whether they ticked the optional marketing opt-in. */
	consented: boolean;
}

/**
 * The funnel's first commitment: an address was handed over and a week of free checks
 * started. The event fires only for a watch that was actually created, since a submission
 * capped by the one-week-per-URL rule starts no watch at all.
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
 * The trial's moment of proof, and the strongest single predictor in this funnel: a lead
 * has seen the product do the one thing it is for. Emitted only for the first such email
 * per watch — a later one marks a target that is simply flapping.
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
 * Continued engagement, counted per send: the number somebody received before they signed
 * up is the one measure of how much of the trial they actually saw, worth capturing here
 * since the lead row itself is deleted within thirty days.
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
 * Activation: the first monitor can be the one sign-up converted for them, or one made
 * just to see whether the product works, while the second is somebody who decided to keep
 * using it — the one signal in this funnel that tells a curious visitor from a user.
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
	/** The name of the channel a notification goes through — the address itself is redacted. */
	strategy: string;
	/** Whether it is scoped to one monitor, or applies to every monitor on the team. */
	monitorScoped: boolean;
	/** The team's alert count immediately after this one, so the first is `1`. */
	alertCount: number;
}

/**
 * The other half of activation: a team that has told us where to reach them expects to be
 * reached. Only the strategy name is recorded, since every strategy's configuration is a
 * destination and three of the four are a secret URL.
 */
export function trackAlertConfigured(
	sink: FunnelEventSink | undefined,
	properties: AlertConfiguredProperties,
): void {
	emit(sink, "alert_configured", { ...properties });
}
