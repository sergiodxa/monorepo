/**
 * One URL from the public trial page each, re-checked hourly for seven days and claimable as a
 * real monitor for thirty. `expires_at` ends the checking and `converts_until` ends the offer
 * and the row, so a row's existence is itself the one-free-week-per-URL cap.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow, NotFound } from "@sdxc/data-model";
import type { Result } from "@sdxc/result";
import type { ValidationError } from "@sdxc/validate";

import { createModel } from "@sdxc/data-model";
import { toDayKey } from "@sdxc/dates";
import { DAY_MS } from "@sdxc/dates/zone";
import { generateUUID } from "@sdxc/uuid/v4";
import { getTableName, gte, inList } from "remix/data-table";

import type { BatchedSweepResult } from "~/app/lib/retention";
import type { MonitorStatus, SelectTrialWatch, SelectTrialWatchResult } from "~/database/schema";

import { FREE_TRIAL_DAYS } from "~/app/lib/pricing";
import { deleteOlderThan } from "~/app/lib/retention";
import { claimDue } from "~/app/lib/scheduling";
import { normalizeTrialUrl } from "~/app/lib/trial-identity";
import { trialWatchResults, trialWatches } from "~/database/schema";

/**
 * How long a target is re-checked for before the wrap-up goes out and checking stops, under
 * the name the scheduling reads it by; `~/app/lib/pricing` holds the one definition marketing
 * copy quotes.
 */
export const TRIAL_WATCH_DURATION_DAYS = FREE_TRIAL_DAYS;

/**
 * How long after an attempt that target can still be turned into a real monitor on sign-up.
 * Longer than the week of checking on purpose: the week is the demo, the offer is the point,
 * and each attempt carries its own window.
 */
export const TRIAL_WATCH_CONVERSION_WINDOW_DAYS = 30;

/**
 * The cadence, matching the `interval_seconds` column's default. Hourly gives a digest's
 * uptime bar the resolution to show an afternoon's outage, at 168 checks a week.
 */
export const TRIAL_WATCH_INTERVAL_SECONDS = 3600;

/**
 * The zone the once-per-day change-email bound is counted in. UTC so every sweep run evaluates
 * the bound identically, and the boundary holds still for a lead who switches language.
 */
const BOUND_ZONE = "UTC";

/**
 * Projected in the claim's `RETURNING` so a sweep reads each watch once: the check needs these,
 * and the notification predicates decide from the watch alone.
 */
const CLAIM_COLUMNS = [
	"id",
	"created_at",
	"lead_id",
	"url",
	"expires_at",
	"last_status",
	"change_notified_at",
	"summary_sent_at",
] as const;

/** A trial watch claimed for a check, projected to the columns the sweep reads. */
export type ClaimedTrialWatch = Pick<SelectTrialWatch, (typeof CLAIM_COLUMNS)[number]>;

/** One completed trial check, as the thing to record. */
export interface TrialCheckResult {
	status: MonitorStatus;
	/** `null` when the target never answered, so there is no timing to record. */
	responseTimeMs: number | null;
}

/** One target's section of a lead's daily digest: the row's totals plus the bar's data. */
export interface TrialWatchDigestEntry {
	watch: SelectTrialWatch;
	/** This target's checks over the digest's window, oldest first — the bar, left to right. */
	results: SelectTrialWatchResult[];
}

/** What one window of the funnel report needs to know about the `trial_watches` table. */
export interface TrialWatchFunnelActivity {
	/** Watches created in the window, each of which sent one confirmation email. */
	created: number;
	changeEmails: number;
	/** Seven-day wrap-ups sent in the window. */
	summaryEmails: number;
}

/**
 * Whether a status counts toward `checks_ok`. Only `up` does, so `checks_ok / checks_run`
 * reads as a genuine "fully healthy" ratio while every degraded hour still shows in the bar.
 */
export function isHealthyTrialStatus(status: MonitorStatus) {
	return status === "up";
}

/**
 * Whether this check warrants an immediate email about this target: a status differing from
 * `last_status`, at most once per UTC day per watch, so a flapping target costs seven emails a
 * week at worst.
 *
 * @param watch - Read before `recordCheck` overwrites the `last_status` this compares against.
 * @param status - The status this check produced.
 * @param now - When the check happened, against the last email's day.
 */
export function shouldNotifyChange(
	watch: Pick<SelectTrialWatch, "last_status" | "change_notified_at">,
	status: MonitorStatus,
	now: number,
) {
	if (watch.last_status === null) return false;
	if (watch.last_status === status) return false;
	if (watch.change_notified_at === null) return true;
	return !onSameDay(watch.change_notified_at, now);
}

/**
 * Whether this watch's seven-day wrap-up is owed: past `expires_at` with `summary_sent_at`
 * still unset, the one guard that makes the send idempotent against a redelivered sweep.
 */
export function shouldSendSummary(
	watch: Pick<SelectTrialWatch, "expires_at" | "summary_sent_at">,
	now: number,
) {
	return now >= watch.expires_at && watch.summary_sent_at === null;
}

/**
 * Whether this attempt can still become a real monitor: unconverted and inside its own
 * thirty-day window. The week of checking may be long over; that lead is exactly who the
 * offer is for.
 */
export function isConvertible(
	watch: Pick<SelectTrialWatch, "converts_until" | "converted_at">,
	now: number,
) {
	return watch.converted_at === null && now < watch.converts_until;
}

/** Whether two instants fall on the same UTC calendar day. */
function onSameDay(a: number, b: number) {
	return toDayKey(new Date(a), BOUND_ZONE) === toDayKey(new Date(b), BOUND_ZONE);
}

export const TrialWatches = createModel(trialWatches, {
	optional: [
		"id",
		"normalized_url",
		"report_token",
		"expires_at",
		"converts_until",
		"interval_seconds",
		"checks_run",
		"checks_ok",
		"max_response_time_ms",
	],

	scopes: {
		ofLead: (query, leadId: string) => query.where({ lead_id: leadId }),
	},

	methods: {
		/**
		 * The watch this lead already has on this URL, and the whole of the free-watch cap: a
		 * row lives only inside its thirty-day window, so finding one means this pair's free
		 * week is spent. The URL is normalized here, so every caller compares the same form.
		 */
		findByNormalizedUrl(leadId: string, url: string): Promise<SelectTrialWatch | null> {
			return this.findBy({ lead_id: leadId, normalized_url: normalizeTrialUrl(url) });
		},

		/**
		 * Claims every watch due as of `scheduledAt`, advancing each one's next due time in the
		 * same statement. Expired watches are claimed too, which is how the wrap-up gets sent and
		 * how `next_due_at` finally goes null.
		 */
		claimDue(scheduledAt: number): Promise<ClaimedTrialWatch[]> {
			return claimDue(this.db, trialWatches, CLAIM_COLUMNS, scheduledAt);
		},

		/** Every watch a lead started, newest first. */
		listByLead(leadId: string): Promise<SelectTrialWatch[]> {
			return this.ofLead(leadId).orderBy("created_at", "desc").all();
		},

		/**
		 * Everything one lead's daily digest renders: each watch still due, with its results
		 * since `since`, oldest first. Two statements for any number of targets, since a
		 * per-watch history read would make one email N+1 trips.
		 */
		async listDigestForLead(leadId: string, since: number): Promise<TrialWatchDigestEntry[]> {
			let watches = await this.ofLead(leadId).orderBy("created_at", "asc").all();

			let active = watches.filter((watch) => watch.next_due_at !== null);
			if (active.length === 0) return [];

			let rows = await this.db
				.query(trialWatchResults)
				.where(
					inList(
						"trial_watch_id",
						active.map((watch) => watch.id),
					),
				)
				.where(gte("checked_at", since))
				.orderBy("checked_at", "asc")
				.all();

			return active.map((watch) => ({
				watch,
				results: rows.filter((row) => row.trial_watch_id === watch.id),
			}));
		},

		/**
		 * Records one check: the history row a digest's bar is drawn from, plus the watch's
		 * cached fields folded into one `UPDATE` whose counters increment in SQL, so concurrent
		 * checks both land; `next_due_at` goes null once `expires_at` has passed.
		 *
		 * @returns The history row's id, the only already-persisted unique fact about the check.
		 */
		async recordCheck(
			watch: Pick<SelectTrialWatch, "id">,
			result: TrialCheckResult,
		): Promise<string> {
			let now = Date.now();
			let id = generateUUID();

			await this.db.create(
				trialWatchResults,
				{
					id,
					trial_watch_id: watch.id,
					status: result.status,
					response_time_ms: result.responseTimeMs,
					checked_at: now,
				},
				{ touch: true, returnRow: true },
			);

			await this.db.exec(
				`UPDATE ${getTableName(trialWatches)}
				    SET updated_at = ?,
				        last_status = ?,
				        checks_run = checks_run + 1,
				        checks_ok = checks_ok + ?,
				        max_response_time_ms = MAX(max_response_time_ms, ?),
				        next_due_at = CASE WHEN expires_at <= ? THEN NULL ELSE next_due_at END
				  WHERE id = ?`,
				[
					now,
					result.status,
					isHealthyTrialStatus(result.status) ? 1 : 0,
					result.responseTimeMs ?? 0,
					now,
					watch.id,
				],
			);

			return id;
		},

		/**
		 * Ends a watch a sweep finds already past `expires_at`, with no check to record. A null
		 * `next_due_at` is what "finished" means, here as in `recordCheck` and `markSummarySent`.
		 */
		finish(watchId: string): Promise<Result<SelectTrialWatch, ValidationError | NotFound>> {
			return this.update(watchId, { next_due_at: null });
		},

		/** Stamps the change email, which is what closes the day's bound of `shouldNotifyChange`. */
		markChangeNotified(
			watchId: string,
			sentAt: number = Date.now(),
		): Promise<Result<SelectTrialWatch, ValidationError | NotFound>> {
			return this.update(watchId, { change_notified_at: sentAt });
		},

		/**
		 * Stamps this watch's wrap-up and ends the watch in the same write: the wrap-up is only
		 * sent because checking is over, and a row left due after it went out would be claimed
		 * and wrapped up again.
		 */
		markSummarySent(
			watchId: string,
			sentAt: number = Date.now(),
		): Promise<Result<SelectTrialWatch, ValidationError | NotFound>> {
			return this.update(watchId, { summary_sent_at: sentAt, next_due_at: null });
		},

		/**
		 * The three numbers the funnel report draws from this table for one window, `from`
		 * inclusive and `to` exclusive. Each stamp is written at most once per watch per day, so
		 * counting stamps counts emails; an empty table reads as zeroes.
		 */
		async countFunnelActivity(from: number, to: number): Promise<TrialWatchFunnelActivity> {
			let result = await this.db.exec(
				`SELECT SUM(CASE WHEN created_at >= ? AND created_at < ? THEN 1 ELSE 0 END) AS created,
				        SUM(CASE WHEN change_notified_at >= ? AND change_notified_at < ? THEN 1 ELSE 0 END)
				          AS changeEmails,
				        SUM(CASE WHEN summary_sent_at >= ? AND summary_sent_at < ? THEN 1 ELSE 0 END)
				          AS summaryEmails
				   FROM ${getTableName(trialWatches)}`,
				[from, to, from, to, from, to],
			);

			let [row] = (result.rows ?? []) as unknown as {
				created: number | null;
				changeEmails: number | null;
				summaryEmails: number | null;
			}[];

			return {
				created: Number(row?.created ?? 0),
				changeEmails: Number(row?.changeEmails ?? 0),
				summaryEmails: Number(row?.summaryEmails ?? 0),
			};
		},

		/**
		 * The watches a signing-up lead is owed real monitors for, oldest first. Filtered per
		 * watch, so a lead who tried three URLs on different days gets every one whose own
		 * window is still open.
		 */
		async listConvertibleByLead(leadId: string, now: number): Promise<SelectTrialWatch[]> {
			let watches = await this.ofLead(leadId).orderBy("created_at", "asc").all();
			return watches.filter((watch) => isConvertible(watch, now));
		},

		/**
		 * Records which real monitor a trial target became, and with it the idempotency guard
		 * for the conversion: per watch, so a watch created after an earlier conversion is
		 * still converted on the next sign-in.
		 */
		markConverted(
			watchId: string,
			monitorId: string,
		): Promise<Result<SelectTrialWatch, ValidationError | NotFound>> {
			return this.update(watchId, { converted_monitor_id: monitorId, converted_at: Date.now() });
		},

		/**
		 * Deletes watches whose conversion window has closed, in bounded batches. Run it after
		 * their results are deleted and before orphaned leads are.
		 */
		deleteExpired(now: number): Promise<BatchedSweepResult> {
			return deleteOlderThan(this.db, "trial_watches", "converts_until", now);
		},
	},

	callbacks: {
		/**
		 * Starts the watch: derives `normalized_url` from the URL, mints the report token (a
		 * credential), and stamps both deadlines. The first check is due one interval out
		 * because the trial page already probed the target, which `last_status` seeds.
		 */
		async beforeCreate(values) {
			let now = Date.now();
			return {
				...values,
				id: values.id ?? generateUUID(),
				normalized_url: normalizeTrialUrl(values.url),
				report_token: generateUUID(),
				expires_at: now + TRIAL_WATCH_DURATION_DAYS * DAY_MS,
				converts_until: now + TRIAL_WATCH_CONVERSION_WINDOW_DAYS * DAY_MS,
				next_due_at: now + TRIAL_WATCH_INTERVAL_SECONDS * 1000,
			};
		},
	},
});

/** A trial watch, as reads return it. */
export type TrialWatch = ModelRow<typeof TrialWatches>;

export default TrialWatches;
