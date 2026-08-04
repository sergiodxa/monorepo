/**
 * Turns the targets someone probed on the public trial page into real monitors, at the
 * moment they sign in with the address they left behind.
 *
 * An anonymous visitor hands over an email, we watch their URL hourly for a week, and for
 * thirty days from each attempt that URL is claimable. This is the claim: an address is the
 * only thing a lead and a signed-in subject are known to share, so sign-in looks for a lead
 * with the subject's address and creates a monitor for every attempt whose own window is
 * still open. The match is on the *person* behind the address — `Lead.findByEmail` reduces
 * both sides the same way — because an exact match on the stored string fails for precisely
 * the people careful enough to tag: tried as `hello+test@`, signed up as `hello@`, and their
 * targets would lapse unclaimed with nothing able to say why. What is convertible is
 * `~/app/data/trial-watch.ts`'s decision, not this module's — each watch carries its own
 * clock, so a lead who tried three URLs a few days apart can have two of them claimed and
 * the third already lapsed.
 *
 * It is also where the funnel's middle is recorded. Sign-in is the only moment at which a
 * lead and an account are known to be the same person, so it is the only moment at which
 * "this customer came from the free page" can ever be written down — and it has to be
 * written by copying, because every row it is copied from is deleted within thirty days or
 * the instant they unsubscribe. That snapshot is `~/app/data/trial-conversion.ts`.
 *
 * **Nothing here may block sign-in.** Auto-creating monitors is a nicety on the one path a
 * user cannot route around, so every failure is logged and swallowed, in the shape
 * `Customer.cancelSubscriptions` and `CheckHttpJob`'s alert dispatch already use. A lead
 * lookup that fails costs someone an empty dashboard; a lead lookup that throws would cost
 * them their account.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { logger } from "@pkg/logger";

import type { SelectLead, SelectTrialWatch } from "~/database/schema";

import Lead from "~/app/data/lead";
import Monitor from "~/app/data/monitor";
import MonitorDailyStats from "~/app/data/monitor-daily-stats";
import TrialConversion from "~/app/data/trial-conversion";
import TrialWatch from "~/app/data/trial-watch";
import { dailyStatsFromChecks } from "~/app/lib/trial-history";

/**
 * The cadence a converted monitor runs at.
 *
 * Ten minutes is `CreateMonitorSchema`'s default rather than the `monitors` table's own
 * sixty seconds, because the target of this rule is a monitor indistinguishable from one the
 * person would have made in the form, and the form is where a human's default comes from.
 * Every other setting — method, expected status, timeout, degraded threshold, region — is
 * left to the column defaults, which is exactly what the form's untouched fields do.
 *
 * Duplicated from the validator rather than imported, because a service reaching into
 * `~/app/http` would invert the dependency between the two layers for one integer.
 */
const CONVERTED_INTERVAL_SECONDS = 600;

/**
 * How many of a watch's checks the carried history reads.
 *
 * A watch runs hourly for seven days, so 168 is the whole of one and this is that with room
 * for the boundary check a claim can add. Stated as its own bound rather than left to
 * `listResults`'s default because the two are unrelated numbers that happen to be close: that
 * default sizes a digest's bar, and changing it must not silently start truncating somebody's
 * carried week.
 */
const CARRIED_RESULT_LIMIT = 200;

/** Who signed in, and where their claimed targets go. */
export interface TrialConversionSubject {
	/**
	 * The authenticated subject's address, matched against `leads.normalized_email` — the
	 * person behind the address rather than the string, so someone who tried the free page as
	 * `hello+test@` and signed up as `hello@` still has their targets claimed. `Lead.findByEmail`
	 * does the reduction, so this is passed in whatever spelling the identity provider gave.
	 */
	email: string;
	/** The team they were just provisioned into, which must already exist. */
	teamId: string;
	/** The subject, recorded as the created monitors' author. */
	authorId: string;
}

/**
 * Claims every trial target this address is still owed a monitor for, into `teamId`.
 *
 * **Runs on every sign-in, not only on first provisioning.** The tempting reading is that
 * conversion is part of onboarding, but the offer is attached to the attempt and not to the
 * account: someone can create an account in January, probe a URL on the trial page in
 * February, and sign in again the same afternoon — a first-provisioning-only rule would
 * never look, and that watch would lapse unclaimed thirty days later with nobody able to say
 * why. The weekly wrap-up email points its call to action at the app precisely so a reader
 * arrives through sign-in with their targets already converted, and that reader may well
 * already have an account. Running every time costs one indexed read of a unique column,
 * which returns nothing for the overwhelming majority of sign-ins.
 *
 * That is only affordable because it is **idempotent**, and idempotent on a recorded fact
 * rather than an inferred one: `TrialWatch.markConverted` stamps `converted_at`, and a watch
 * carrying it is no longer convertible. Matching on "a monitor with this URL already exists"
 * was the alternative and is wrong twice over — it would refuse to convert a target the
 * person happens to already monitor deliberately, and it would silently re-claim a watch
 * whose monitor they had since deleted.
 *
 * **Converted monitors arrive enabled**, which `Monitor.create` does by default and this
 * deliberately does not override. A disabled monitor has no status, no history and no next
 * check, so an account converted into one is an empty account with a chore attached: the
 * person has to find a toggle they were never told about to get the thing they had already
 * asked for. And they did ask — leaving an address on the trial page is a request to watch
 * that URL, which we have been honouring hourly for a week at our own cost, so continuing it
 * on their account is the same act and not a new commitment made on their behalf. The
 * metered-allowance objection is real but bounded and visible: one monitor at ten minutes,
 * on a row they can see and delete in a click, against a disabled one they would never
 * notice was there.
 *
 * **There is no per-team cap on HTTP monitors to respect.** `MAX_DNS_MONITORS_PER_TEAM`
 * bounds DNS monitors and nothing bounds these, so converting cannot push a team over a
 * limit that does not exist, and inventing one here would enforce a rule the create form
 * does not. The count is bounded anyway by what a lead can accumulate: a watch only exists
 * because someone completed a rate-limited probe on the public page.
 *
 * Awaited rather than deferred past the response: the promise is an account that is useful
 * on arrival, and a dashboard that fills in a second after it renders is a worse first
 * impression than one that was simply slower to open.
 *
 * Never throws.
 */
export async function convertTrialWatches(
	db: Database,
	subject: TrialConversionSubject,
): Promise<void> {
	try {
		let lead = await Lead.findByEmail(db, subject.email);
		if (!lead) return;

		let now = Date.now();
		let watches = await TrialWatch.listConvertibleByLead(db, lead.id, now);

		let converted = 0;
		for (let watch of watches) {
			if (await convertWatch(db, subject, watch)) converted += 1;
		}

		await recordSignup(db, subject, lead, now);

		if (watches.length === 0) return;

		logger.info("trial_conversion.completed", {
			leadId: lead.id,
			teamId: subject.teamId,
			claimable: watches.length,
			converted,
		});
	} catch (error) {
		logger.error("trial_conversion.failed", {
			teamId: subject.teamId,
			authorId: subject.authorId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/**
 * Writes the durable record that this account came from the free page.
 *
 * **Runs after the monitors, and cannot affect them.** Instrumentation must never be the
 * reason somebody's targets did not get claimed, so it goes last and catches its own
 * failures rather than sharing the caller's — a snapshot that failed to write is a hole in a
 * report, while a snapshot that threw before the loop would be a hole in someone's dashboard.
 *
 * **Runs even when nothing was claimable.** Someone whose attempts all lapsed before they got
 * around to signing up is still a customer the free page produced, and the count that leaves
 * them out is the count that understates the thing being measured. Repeat sign-ins are free:
 * `TrialConversion.recordSignup` ignores a subject it already has.
 *
 * **It reads every attempt, not the claimable ones the caller already has.** A watch that
 * lapsed before they signed up is still a URL they tried and an email they were sent, and the
 * snapshot is meant to describe how they got here rather than what they were owed on arrival.
 * That is one indexed read on a path that only reaches here for an address that left a lead.
 *
 * The URLs are de-duplicated because a person who tried the same address twice tried one URL,
 * while `watch_count` keeps counting attempts — the two columns answer "what did they try"
 * and "how many times did they use the form", which are different questions.
 */
async function recordSignup(
	db: Database,
	subject: TrialConversionSubject,
	lead: SelectLead,
	now: number,
): Promise<void> {
	try {
		/** Reversed to oldest first, which is the order they tried them and the order to read. */
		let watches = [...(await TrialWatch.listByLead(db, lead.id))].reverse();

		let created = await TrialConversion.recordSignup(db, {
			ownerId: subject.authorId,
			leadCreatedAt: lead.created_at,
			emailsSent: lead.emails_sent,
			urls: [...new Set(watches.map((watch) => watch.url))],
			watchCount: watches.length,
			signedUpAt: now,
		});

		if (created) {
			logger.info("trial_conversion.signup_recorded", {
				ownerId: subject.authorId,
				emailsSent: lead.emails_sent,
				watchCount: watches.length,
			});
		}
	} catch (error) {
		logger.error("trial_conversion.signup_record_failed", {
			ownerId: subject.authorId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/**
 * Converts one watch, reporting whether it became a monitor.
 *
 * Caught per watch and not only around the loop, so that one unconvertible target does not
 * take the other two down with it — a lead who asked for three URLs and got one is a bug
 * worth logging, but a lead who asked for three and got none because the first failed is the
 * same bug made three times worse.
 *
 * The monitor is created before the watch is stamped, and the order is deliberate. Nothing
 * spans the two writes, so one of them can land alone: this way a failure leaves a monitor
 * the person can see and delete, and the next sign-in creates a duplicate they can also see.
 * Stamping first would trade that for a claim silently consumed by a monitor that never
 * existed, which nothing downstream could detect or undo.
 *
 * No on-demand `Monitor.ping`, unlike the create form. The form pings because a visitor is
 * looking at the monitor they just made and a dash where a status goes reads as broken;
 * nobody is looking at these yet, `Monitor.create` leaves them due immediately, and the
 * every-minute sweep reaches them before the person finishes reading their dashboard. One
 * queue write per claimed target on the sign-in path buys nothing for that minute.
 */
async function convertWatch(
	db: Database,
	subject: TrialConversionSubject,
	watch: SelectTrialWatch,
): Promise<boolean> {
	try {
		let monitor = await Monitor.create(db, subject.teamId, subject.authorId, {
			name: monitorName(watch.url),
			url: watch.url,
			interval_seconds: CONVERTED_INTERVAL_SECONDS,
		});

		await carryHistory(db, watch, monitor.id);
		await TrialWatch.markConverted(db, watch.id, monitor.id);
		return true;
	} catch (error) {
		logger.error("trial_conversion.watch_failed", {
			watchId: watch.id,
			teamId: subject.teamId,
			error: error instanceof Error ? error.message : String(error),
		});
		return false;
	}
}

/**
 * Carries the week a watch already observed onto the monitor it just became: one
 * `monitor_daily_stats` row per day it covers, and the last check it ran as the monitor's
 * current status.
 *
 * **This is the difference between converting and starting over.** Everything else about a
 * conversion hands the person their configuration back; without this they still open a
 * dashboard with an empty graph and a monitor reading "pending", having just been mailed a
 * report about seven days of checks. The evidence is the reason they subscribed, so losing it
 * at the moment they pay is the worst possible time to lose it.
 *
 * **Its failures are not the conversion's.** A monitor with no carried history is a monitor;
 * a sign-in that threw here would cost somebody their account, and the caller's own catch
 * would abandon the remaining watches. So this swallows and logs in the shape the rest of
 * this module uses, and the `markConverted` stamp after it runs either way — a claim is spent
 * on the monitor existing, never on its history being complete.
 *
 * **Seeding the status is a separate write from the rows**, because they answer different
 * questions and the second is not derivable from the first. A day's rollup cannot say what
 * the last check reported, and the dashboard badge reads exactly that. `last_checked_at`
 * takes the watch's own instant rather than now, so the monitor does not claim to have run a
 * check it did not.
 */
async function carryHistory(
	db: Database,
	watch: SelectTrialWatch,
	monitorId: string,
): Promise<void> {
	try {
		let results = await TrialWatch.listResults(db, watch.id, CARRIED_RESULT_LIMIT);
		if (results.length === 0) return;

		for (let day of dailyStatsFromChecks(results, monitorId)) {
			await MonitorDailyStats.upsertDay(db, day);
		}

		// Newest first out of `listResults`, so the head is the watch's most recent check.
		let latest = results[0];
		if (latest) {
			await Monitor.updateById(db, monitorId, {
				last_status: latest.status,
				last_checked_at: latest.checked_at,
				last_response_time_ms: latest.response_time_ms,
			});
		}

		logger.info("trial_conversion.history_carried", {
			watchId: watch.id,
			monitorId,
			checks: results.length,
		});
	} catch (error) {
		logger.error("trial_conversion.history_failed", {
			watchId: watch.id,
			monitorId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/**
 * What to call a monitor nobody named. The host, without the `www.` a person would not have
 * typed into the name field, which is the name the create form's own users overwhelmingly
 * give theirs. The path is dropped: a target is one URL, but the row it becomes is read as
 * "is my site up", and `example.com` says that where `example.com/health` reads as a detail.
 *
 * Falls back to the stored URL if it will not parse, which the trial page's own validation
 * should already have made impossible — a monitor with an ugly name is still a monitor, and
 * throwing here would cost the person the conversion over cosmetics.
 */
function monitorName(url: string): string {
	try {
		return new URL(url).hostname.replace(/^www\./, "");
	} catch {
		return url;
	}
}
