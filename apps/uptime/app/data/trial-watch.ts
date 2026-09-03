/**
 * Data-access model for trial watches: one URL from the public trial page,
 * re-checked hourly for seven days and claimable as a real monitor for thirty.
 * `expires_at` ends the checking, `converts_until` ends the offer and the row,
 * so a row's existence is itself the one-free-week-per-URL cap. Scheduling is
 * the shared `next_due_at` claim, advancing the column as it hands a row out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { toDayKey } from "@sdxc/dates";
import { generateUUID } from "@sdxc/uuid";
import { getTableName } from "remix/data-table";

import type { BatchedSweepResult } from "~/app/lib/retention";
import type {
	InsertTrialWatch,
	MonitorStatus,
	SelectTrialWatch,
	SelectTrialWatchResult,
} from "~/database/schema";

import { FREE_TRIAL_DAYS } from "~/app/lib/pricing";
import { RETENTION_BATCH_SIZE, RETENTION_MAX_BATCHES, deleteOlderThan } from "~/app/lib/retention";
import { claimDue } from "~/app/lib/scheduling";
import { normalizeTrialUrl } from "~/app/lib/trial-identity";
import { trialWatchResults, trialWatches } from "~/database/schema";

/**
 * How long a target is re-checked for before the wrap-up goes out and checking
 * stops. Re-exported under the name the scheduling reads it by from
 * `~/app/lib/pricing`, where marketing copy quotes the same one definition.
 */
export const TRIAL_WATCH_DURATION_DAYS = FREE_TRIAL_DAYS;

/**
 * How long after an attempt that target can still be turned into a real monitor
 * on sign-up. Longer than the week of checking on purpose — the week is the
 * demo, the offer is the point — and measured per attempt, each with its own.
 */
export const TRIAL_WATCH_CONVERSION_WINDOW_DAYS = 30;

/**
 * The cadence, matching the `interval_seconds` column's default. Hourly gives a
 * digest's uptime bar the resolution to show an outage that lasted an
 * afternoon, at 168 checks a week — a rounding error against a paying monitor.
 */
export const TRIAL_WATCH_INTERVAL_SECONDS = 3600;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The zone the once-per-day change-email bound is counted in. UTC so every
 * sweep run evaluates the bound identically, and the boundary holds still for a
 * lead who switches language.
 */
const BOUND_ZONE = "UTC";

/** Results a digest renders for one target: an hourly bar over a day, with room to spare. */
const RESULT_HISTORY_LIMIT = 200;

/**
 * Projected in the claim's `RETURNING` so a sweep reads each watch once: the
 * check needs these, and the notification predicates decide from the watch
 * alone, so their columns come along too.
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

/**
 * What {@link TrialWatch.create} accepts. `normalized_url` is derived from the
 * required URL, making a key that disagrees with its own URL unrepresentable;
 * `report_token` is a credential, minted inside `create` alone.
 */
export type NewTrialWatch = Omit<InsertTrialWatch, "normalized_url" | "report_token" | "url"> & {
	url: string;
};

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
 * Whether a status counts toward `checks_ok`. Only `up` does, so
 * `checks_ok / checks_run` reads as a genuine "fully healthy" ratio while every
 * degraded hour still shows in the bar's own colour.
 */
export function isHealthyTrialStatus(status: MonitorStatus) {
	return status === "up";
}

/**
 * Whether this check warrants an immediate email about this target: a status
 * differing from `last_status`, at most once per UTC day per watch, so a target
 * that flaps every hour costs seven emails a week at worst.
 *
 * @param watch - Read before {@link TrialWatch.recordCheck} overwrites the
 * `last_status` this compares against.
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
 * Whether this watch's seven-day wrap-up is owed: past `expires_at` with
 * `summary_sent_at` still unset, the one guard that makes the send idempotent
 * against a redelivered sweep. Per watch, each on its own target's clock.
 */
export function shouldSendSummary(
	watch: Pick<SelectTrialWatch, "expires_at" | "summary_sent_at">,
	now: number,
) {
	return now >= watch.expires_at && watch.summary_sent_at === null;
}

/** Whether two instants fall on the same UTC calendar day. */
function onSameDay(a: number, b: number) {
	return toDayKey(new Date(a), BOUND_ZONE) === toDayKey(new Date(b), BOUND_ZONE);
}

export default class TrialWatch {
	/**
	 * Starts watching a target for a lead, stamping both deadlines. The first
	 * check is due one interval out because the trial page already probed the
	 * target; callers pass that answer as `last_status` to seed change detection.
	 */
	static async create(db: Database, leadId: string, input: NewTrialWatch) {
		let now = Date.now();

		return await db.create(
			trialWatches,
			{
				id: generateUUID(),
				lead_id: leadId,
				...input,
				normalized_url: normalizeTrialUrl(input.url),
				report_token: generateUUID(),
				expires_at: now + TRIAL_WATCH_DURATION_DAYS * MS_PER_DAY,
				converts_until: now + TRIAL_WATCH_CONVERSION_WINDOW_DAYS * MS_PER_DAY,
				next_due_at: now + TRIAL_WATCH_INTERVAL_SECONDS * 1000,
			},
			{ touch: true, returnRow: true },
		);
	}

	/**
	 * The watch this lead already has on this URL, and the whole of the free-watch
	 * cap: a row lives only inside the thirty-day window the expiry sweep
	 * enforces, so finding one means this pair's free week is already spent.
	 *
	 * @param db - Database handle.
	 * @param leadId - The lead submitting the URL.
	 * @param url - The URL as typed; normalized here so every caller compares the
	 * same form.
	 * @returns The existing watch, or `null` when this pair is free to start one.
	 */
	static async findByNormalizedUrl(db: Database, leadId: string, url: string) {
		return await db.findOne(trialWatches, {
			where: { lead_id: leadId, normalized_url: normalizeTrialUrl(url) },
		});
	}

	/**
	 * The watch a report link identifies. Holding the token is the whole
	 * authorization — a trial has no account behind it — so a reader arriving from
	 * an email weeks later needs the token and nothing else.
	 *
	 * @param db - Database handle.
	 * @param token - The token straight out of the URL, matched as an opaque string.
	 * @returns The watch, or `null` for a token this database has never issued or
	 * has since swept.
	 */
	static async findByReportToken(db: Database, token: string) {
		return await db.findOne(trialWatches, { where: { report_token: token } });
	}

	/**
	 * Claims every watch due as of `scheduledAt`, advancing each one's next due
	 * time in the same statement. Expired watches are claimed too, which is how
	 * the wrap-up gets sent and how `next_due_at` finally goes null.
	 */
	static async claimDue(db: Database, scheduledAt: number): Promise<ClaimedTrialWatch[]> {
		return await claimDue(db, trialWatches, CLAIM_COLUMNS, scheduledAt);
	}

	/** A single watch by id, for a job needing columns beyond the claim's projection. */
	static async findById(db: Database, watchId: string) {
		return await db.findOne(trialWatches, { where: { id: watchId } });
	}

	/** Every watch a lead started, newest first. */
	static async listByLead(db: Database, leadId: string) {
		return await db.findMany(trialWatches, {
			where: { lead_id: leadId },
			orderBy: ["created_at", "desc"],
		});
	}

	/**
	 * Everything one lead's daily digest renders: each watch still due, with its
	 * results over the window, oldest first. Two statements for any number of
	 * targets, since a per-watch history read would make one email N+1 trips.
	 */
	static async listDigestForLead(
		db: Database,
		leadId: string,
		since: number,
	): Promise<TrialWatchDigestEntry[]> {
		let watches = await db.findMany(trialWatches, {
			where: { lead_id: leadId },
			orderBy: ["created_at", "asc"],
		});

		let active = watches.filter((watch) => watch.next_due_at !== null);
		if (active.length === 0) return [];

		let placeholders = active.map(() => "?").join(", ");
		let history = await db.exec(
			`SELECT id, trial_watch_id, status, response_time_ms, checked_at
			   FROM ${getTableName(trialWatchResults)}
			  WHERE trial_watch_id IN (${placeholders}) AND checked_at >= ?
			  ORDER BY checked_at ASC`,
			[...active.map((watch) => watch.id), since],
		);

		let rows = (history.rows ?? []) as unknown as SelectTrialWatchResult[];

		return active.map((watch) => ({
			watch,
			results: rows.filter((row) => row.trial_watch_id === watch.id),
		}));
	}

	/**
	 * Records one check: the history row a digest's bar is drawn from, plus the
	 * watch's cached fields folded in. Counters increment in SQL so two concurrent
	 * checks both land, and `next_due_at` goes null once `expires_at` has passed.
	 *
	 * @returns The history row's id, the only already-persisted unique fact about
	 * the check.
	 */
	static async recordCheck(
		db: Database,
		watch: Pick<SelectTrialWatch, "id">,
		result: TrialCheckResult,
	): Promise<string> {
		let now = Date.now();
		let id = generateUUID();

		await db.create(
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

		await db.exec(
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
	}

	/**
	 * Ends a watch that a sweep finds already past `expires_at`, with no check to
	 * record. Nulling `next_due_at` is what "finished" means, here as in
	 * {@link TrialWatch.recordCheck} and {@link TrialWatch.markSummarySent}.
	 */
	static async finish(db: Database, watchId: string) {
		return await db.update(trialWatches, watchId, { next_due_at: null }, { touch: true });
	}

	/** One target's results, newest first. */
	static async listResults(db: Database, watchId: string, limit: number = RESULT_HISTORY_LIMIT) {
		return await db.findMany(trialWatchResults, {
			where: { trial_watch_id: watchId },
			orderBy: ["checked_at", "desc"],
			limit,
		});
	}

	/**
	 * One target's results between two instants, oldest first — the day a digest covers, or
	 * the whole week for the wrap-up. Ascending because a bar is drawn left to right in time
	 * order, and reversing 168 rows in the renderer is work the index does for free.
	 */
	static async listResultsBetween(
		db: Database,
		watchId: string,
		from: number,
		to: number,
	): Promise<SelectTrialWatchResult[]> {
		let result = await db.exec(
			`SELECT id, trial_watch_id, status, response_time_ms, checked_at
			   FROM ${getTableName(trialWatchResults)}
			  WHERE trial_watch_id = ? AND checked_at >= ? AND checked_at < ?
			  ORDER BY checked_at ASC`,
			[watchId, from, to],
		);

		return (result.rows ?? []) as unknown as SelectTrialWatchResult[];
	}

	/** Stamps the change email, which is what closes the day's bound — see {@link shouldNotifyChange}. */
	static async markChangeNotified(db: Database, watchId: string, sentAt: number = Date.now()) {
		return await db.update(trialWatches, watchId, { change_notified_at: sentAt }, { touch: true });
	}

	/**
	 * Stamps this watch's wrap-up and ends the watch in the same write. The two are one event:
	 * the wrap-up is only ever sent because checking is over, and a row left due after its
	 * wrap-up went out would be claimed again and wrapped up again.
	 */
	static async markSummarySent(db: Database, watchId: string, sentAt: number = Date.now()) {
		return await db.update(
			trialWatches,
			watchId,
			{ summary_sent_at: sentAt, next_due_at: null },
			{ touch: true },
		);
	}

	/**
	 * The three numbers the funnel report draws from this table for one UTC day.
	 * Each stamp is written at most once per watch per day, so counting stamps
	 * inside a window counts emails; `created` doubles as the confirmation count.
	 *
	 * @param db - Database handle.
	 * @param from - Start of the window, inclusive.
	 * @param to - End of the window, exclusive.
	 * @returns Watches created, change emails sent, and wrap-ups sent inside the
	 * window; an empty table sums to `NULL` and reads as zeroes.
	 */
	static async countFunnelActivity(
		db: Database,
		from: number,
		to: number,
	): Promise<TrialWatchFunnelActivity> {
		let result = await db.exec(
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
	}

	/**
	 * Whether this attempt can still become a real monitor: unconverted and inside
	 * its own thirty-day window. The week of checking may be long over — that lead
	 * is exactly who the offer is for.
	 */
	static isConvertible(
		watch: Pick<SelectTrialWatch, "converts_until" | "converted_at">,
		now: number,
	) {
		return watch.converted_at === null && now < watch.converts_until;
	}

	/**
	 * The watches a signing-up lead is owed real monitors for. Filtered per watch,
	 * so a lead who tried three URLs on different days gets every one whose own
	 * window is still open — a partial conversion is representable.
	 */
	static async listConvertibleByLead(
		db: Database,
		leadId: string,
		now: number,
	): Promise<SelectTrialWatch[]> {
		let watches = await db.findMany(trialWatches, {
			where: { lead_id: leadId },
			orderBy: ["created_at", "asc"],
		});

		return watches.filter((watch) => TrialWatch.isConvertible(watch, now));
	}

	/**
	 * Records which real monitor a trial target became, and with it the
	 * idempotency guard for the whole conversion: per watch, so a watch created
	 * after an earlier conversion is still converted on the next sign-in.
	 */
	static async markConverted(db: Database, watchId: string, monitorId: string) {
		return await db.update(
			trialWatches,
			watchId,
			{ converted_monitor_id: monitorId, converted_at: Date.now() },
			{ touch: true },
		);
	}

	/**
	 * Deletes the per-check history of watches whose thirty days are up, in
	 * bounded batches. The condition joins to the watch, so results live exactly
	 * as long as the row naming them; run before {@link TrialWatch.deleteExpired}.
	 */
	static async deleteExpiredResults(db: Database, now: number): Promise<BatchedSweepResult> {
		let results = getTableName(trialWatchResults);
		let watches = getTableName(trialWatches);

		let sql =
			`DELETE FROM ${results} WHERE \`id\` IN (` +
			`SELECT r.\`id\` FROM ${results} r ` +
			`JOIN ${watches} w ON w.\`id\` = r.\`trial_watch_id\` ` +
			`WHERE w.\`converts_until\` < ? LIMIT ?)`;

		let rowsAffected = 0;
		let batches = 0;

		while (batches < RETENTION_MAX_BATCHES) {
			let result = await db.exec(sql, [now, RETENTION_BATCH_SIZE]);
			batches += 1;

			let affected = result.affectedRows ?? 0;
			rowsAffected += affected;

			if (affected < RETENTION_BATCH_SIZE) return { rowsAffected, batches, reachedCeiling: false };
		}

		return { rowsAffected, batches, reachedCeiling: true };
	}

	/**
	 * Deletes watches whose conversion window has closed, in bounded batches. On
	 * `converts_until`, the deadline that ends the offer, and ordered between
	 * {@link TrialWatch.deleteExpiredResults} and `Lead.deleteOrphaned`.
	 */
	static async deleteExpired(db: Database, now: number): Promise<BatchedSweepResult> {
		return await deleteOlderThan(db, "trial_watches", "converts_until", now);
	}
}
