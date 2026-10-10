/**
 * Turns the targets someone probed on the public trial page into real monitors, at the
 * moment they sign in with the address they left behind. Matches the person behind the
 * address rather than the stored string, so a tagged sign-up still claims its attempts, and
 * separately records the durable snapshot of the free-page-to-account funnel. Every failure
 * here is logged and swallowed, because this sits on the one path nobody can route around.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { currentLog } from "@sdxc/logger";
import { unwrap } from "@sdxc/result";

import type { UptimeModels } from "~/app/models";
import type { TrialSignupAttribution } from "~/app/models/trial-conversions";
import type { SelectLead, SelectTrialWatch } from "~/database/schema";

import { dailyStatsFromChecks } from "~/app/lib/trial-history";
import { attributionProperties, trackAccountCreated } from "~/app/services/funnel-events";

/**
 * The cadence a converted monitor runs at: `CreateMonitorSchema`'s default of ten minutes
 * rather than the `monitors` table's own sixty seconds, since the goal is a monitor
 * indistinguishable from one made by hand in the create form.
 */
const CONVERTED_INTERVAL_SECONDS = 600;

/**
 * How many of a watch's checks the carried history reads: 168 covers a full week of hourly
 * checks with room for the boundary check a claim can add, kept as its own bound so a change
 * to `listByWatch`'s unrelated default cannot silently truncate somebody's carried week.
 */
const CARRIED_RESULT_LIMIT = 200;

/** Who signed in, and where their claimed targets go. */
export interface TrialConversionSubject {
	/**
	 * The authenticated subject's address, matched against `leads.normalized_email` — the person
	 * behind the address rather than the string, so a tagged sign-up (`hello+test@`) still
	 * matches a lead who signed up as `hello@`.
	 */
	email: string;
	/** The team they were just provisioned into, which must already exist. */
	teamId: string;
	/** The subject, recorded as the created monitors' author. */
	authorId: string;
	/**
	 * Where they first arrived, off the anonymous session the sign-in still has in hand. Passed
	 * in here because this is the last request that still holds it — the post-sign-in redirect
	 * lands on a page with a different session. Absent when that session never captured it.
	 */
	attribution?: TrialSignupAttribution;
}

/**
 * Claims every trial target this address is still owed a monitor for, into `teamId`. Runs on
 * every sign-in and is idempotent on `trialWatches.markConverted`'s stamp, so a repeat sign-in
 * costs one indexed read and claims nothing twice.
 *
 * @returns Resolves once every claimable target has been converted or logged and skipped;
 * never rejects, so a failure here cannot block sign-in.
 */
export async function convertTrialWatches(
	models: UptimeModels,
	subject: TrialConversionSubject,
): Promise<void> {
	try {
		let lead = await models.leads.findByEmail(subject.email);
		if (!lead) return;

		let now = Date.now();
		let watches = await models.trialWatches.listConvertibleByLead(lead.id, now);

		let converted = 0;
		for (let watch of watches) {
			if (await convertWatch(models, subject, watch)) converted += 1;
		}

		await recordSignup(models, subject, lead, now);

		if (watches.length === 0) return;

		currentLog()?.set({
			team: { id: subject.teamId },
			trial: { lead_id: lead.id, claimable: watches.length, converted },
		});
	} catch (error) {
		currentLog()?.fail(error, { trial: { conversion_failed: true } });
	}
}

/**
 * Writes the durable record that this account came from the free page. Runs after the
 * monitors and swallows its own failures so a broken snapshot never costs anyone a claimed
 * target, and runs even when nothing was claimable, since a lapsed trial is still a signup.
 */
async function recordSignup(
	models: UptimeModels,
	subject: TrialConversionSubject,
	lead: SelectLead,
	now: number,
): Promise<void> {
	try {
		/** Reversed to oldest first, which is the order they tried them and the order to read. */
		let watches = [...(await models.trialWatches.listByLead(lead.id))].reverse();

		let created = await models.trialConversions.recordSignup({
			ownerId: subject.authorId,
			leadCreatedAt: lead.created_at,
			emailsSent: lead.emails_sent,
			urls: [...new Set(watches.map((watch) => watch.url))],
			watchCount: watches.length,
			signedUpAt: now,
			attribution: subject.attribution,
		});

		if (created) {
			currentLog()?.set({
				user: { id: subject.authorId },
				trial: {
					signup_recorded: true,
					emails_sent: lead.emails_sent,
					watch_count: watches.length,
				},
			});

			/**
			 * The funnel's account-created step, emitted on the same `created` flag that guards the
			 * snapshot, so a repeat sign-in cannot double-count an account. Attribution goes in here
			 * because this is the last request that still holds the anonymous session's copy of it.
			 */
			trackAccountCreated(currentLog(), {
				ownerId: subject.authorId,
				fromTrial: true,
				watchCount: watches.length,
				emailsSent: lead.emails_sent,
				...attributionProperties(subject.attribution),
			});
		}
	} catch (error) {
		currentLog()?.warn("trial.signup_record_failed", {
			owner_id: subject.authorId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/**
 * Converts one watch, reporting whether it became a monitor. Caught per watch so one
 * unconvertible target cannot take the others down with it, and the monitor is created before
 * the watch is stamped so a failure between the two leaves a visible monitor, not a lost claim.
 */
async function convertWatch(
	models: UptimeModels,
	subject: TrialConversionSubject,
	watch: SelectTrialWatch,
): Promise<boolean> {
	try {
		let monitor = unwrap(
			await models.monitors.create({
				team_id: subject.teamId,
				author_id: subject.authorId,
				name: monitorName(watch.url),
				url: watch.url,
				interval_seconds: CONVERTED_INTERVAL_SECONDS,
			}),
		);

		await carryHistory(models, watch, monitor.id);
		unwrap(await models.trialWatches.markConverted(watch.id, monitor.id));
		return true;
	} catch (error) {
		currentLog()?.warn("trial.watch_conversion_failed", {
			watch_id: watch.id,
			team_id: subject.teamId,
			error: error instanceof Error ? error.message : String(error),
		});
		return false;
	}
}

/**
 * Carries the week a watch already observed onto the monitor it just became — one daily-stats
 * row per day plus the last check as its current status. Failures are logged and swallowed
 * here, since a monitor with no carried history is still a monitor.
 */
async function carryHistory(
	models: UptimeModels,
	watch: SelectTrialWatch,
	monitorId: string,
): Promise<void> {
	try {
		let results = await models.trialWatchResults.listByWatch(watch.id, CARRIED_RESULT_LIMIT);
		if (results.length === 0) return;

		for (let day of dailyStatsFromChecks(results, monitorId)) {
			unwrap(await models.monitorDailyStats.upsertDay(day));
		}

		/** Newest first out of `listByWatch`, so the head is the watch's most recent check. */
		let latest = results[0];
		if (latest) {
			unwrap(
				await models.monitors.update(monitorId, {
					last_status: latest.status,
					last_checked_at: latest.checked_at,
					last_response_time_ms: latest.response_time_ms,
				}),
			);
		}

		currentLog()?.note("trial.history_carried", {
			watch_id: watch.id,
			monitor_id: monitorId,
			checks: results.length,
		});
	} catch (error) {
		currentLog()?.warn("trial.history_carry_failed", {
			watch_id: watch.id,
			monitor_id: monitorId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/**
 * What to call a monitor nobody named: the host without a `www.` prefix and without the path,
 * matching what the create form's own users overwhelmingly type by hand. Falls back to the
 * raw URL when it will not parse, so a cosmetic edge case cannot cost the conversion.
 */
function monitorName(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}
