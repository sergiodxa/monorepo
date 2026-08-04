/**
 * Data-access model for trial watches: one URL from the public trial page, re-checked every
 * hour for seven days and claimable as a real monitor for thirty.
 *
 * HTTP only. The public page probes a URL and nothing else, so there is no watch type to
 * branch on here and `last_status` is the ordinary {@link MonitorStatus} an HTTP check
 * produces — the same vocabulary a real monitor uses, which is what lets a conversion carry
 * the history over without translating it. The authenticated ping API still offers DNS and
 * TCP; that is a different entry point with different tables.
 *
 * **Scheduling** is the same `next_due_at` claim the three monitor tables use, reused
 * verbatim from `~/app/lib/scheduling`: `null` means the watch is finished, any other value
 * is when the next hourly check is owed, and the claim advances the column in the same
 * statement that hands the row out. That is what stops two deliveries of the same sweep
 * from checking a watch twice, and it is why {@link TrialWatch.recordCheck} does *not*
 * advance anything — the claim already did.
 *
 * **Notification policy** is two predicates here, {@link shouldNotifyChange} and
 * {@link shouldSendSummary}, in the shape `~/app/services/alerts.ts` uses for monitor
 * alerts. The third schedule, the daily digest, is deliberately *not* here: it is one email
 * per reader per day covering every target they are watching, so it belongs to the lead and
 * lives in `~/app/data/lead.ts`. Hourly checks and the weekly wrap-up are about one target
 * and stay on the watch. That split is intentional, not an oversight.
 *
 * **Two deadlines, and neither implies the other.** `expires_at` ends the checking after
 * seven days; `converts_until` ends the offer after thirty. A finished watch is still a
 * convertible one, which is why {@link TrialWatch.deleteExpired} sweeps on the second column
 * and never on the first.
 *
 * **A third deadline falls out of the second and needs no column of its own.** One person
 * gets one free week per URL per thirty days, and because a row is deleted thirty days after
 * it is created, "a row exists for this lead and this URL" already says exactly that. That is
 * the whole of {@link TrialWatch.findByNormalizedUrl}, and it is why `normalized_url` is a
 * key rather than a date.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { toDayKey } from "@pkg/dates";
import { generateUUID } from "@pkg/uuid";
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
 * How long a target is re-checked for before the wrap-up goes out and checking stops.
 *
 * The number itself lives in `~/app/lib/pricing` — it is quoted by marketing copy that cannot
 * import a data model — and is re-exported here under the name the scheduling reads it by, so
 * every existing caller keeps one import and there is still only one definition.
 */
export const TRIAL_WATCH_DURATION_DAYS = FREE_TRIAL_DAYS;

/**
 * How long after an attempt that target can still be turned into a real monitor on sign-up.
 *
 * Thirty days against the seven it is checked for, and the mismatch is the point: the
 * checking is the demo, the conversion is the reason the demo exists. Someone who watched
 * their site for a week and came back three weeks later is exactly the person the offer is
 * for. Measured per attempt, so trying a second URL a week later does not inherit or extend
 * the first one's deadline.
 */
export const TRIAL_WATCH_CONVERSION_WINDOW_DAYS = 30;

/**
 * The cadence, matching the `interval_seconds` column's default. Hourly is what makes a
 * digest's uptime bar worth drawing — a daily check produces seven bars and cannot show an
 * outage that lasted an afternoon — and 168 checks over the whole watch is a rounding error
 * against a single paying monitor's monthly volume.
 */
export const TRIAL_WATCH_INTERVAL_SECONDS = 3600;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The zone the once-per-day change-email bound is counted in. UTC for the same reason the
 * digest's bound is: a bound has to be evaluated identically by every sweep run, and a zone
 * guessed from a locale would move the boundary under a lead who switched language.
 */
const BOUND_ZONE = "UTC";

/** Results a digest renders for one target: an hourly bar over a day, with room to spare. */
const RESULT_HISTORY_LIMIT = 200;

/**
 * What a claimed watch's check and its own notification decisions need to read, projected in
 * the claim's `RETURNING` so a sweep needs no follow-up read per watch.
 *
 * The notification columns are here because the predicates below take a watch, not a
 * database: deciding whether to email is pure, and the sweep should not have to re-read the
 * row it was just handed to make that decision.
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
 * What {@link TrialWatch.create} accepts: everything on the row a caller may set, with the
 * URL required and `normalized_url` absent.
 *
 * The key is derived from the URL rather than supplied, so removing it from the input is
 * what makes "a watch whose key does not match its own URL" unrepresentable rather than
 * merely discouraged. The URL is required for the same reason: it is the one field the key
 * is computed from, and every other column is optional or stamped by `create` itself.
 */
export type NewTrialWatch = Omit<InsertTrialWatch, "normalized_url" | "url"> & { url: string };

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
	/** URLs submitted in the window — one watch per submission, and one confirmation email. */
	created: number;
	/** On-change emails sent in the window. */
	changeEmails: number;
	/** Seven-day wrap-ups sent in the window. */
	summaryEmails: number;
}

/**
 * Whether a status counts toward `checks_ok`.
 *
 * `degraded` deliberately does not: a digest's headline is "your site was up N% of the
 * time", and a slow response is not an outage but is also not a clean check. Counting it as
 * ok would make the number flattering, counting it as down would make it alarming; leaving
 * it out of both makes `checks_ok / checks_run` a genuine "fully healthy" ratio, and the bar
 * still shows every degraded hour in its own colour.
 *
 * A named predicate rather than an inline `=== "up"` because that reasoning is the whole
 * content of the function, and a digest reading the ratio needs to be able to find it.
 */
export function isHealthyTrialStatus(status: MonitorStatus) {
	return status === "up";
}

/**
 * Whether this check's status should trigger an immediate email about this target.
 *
 * Three conditions, and the third is the one that matters:
 *
 * 1. A watch with no previous status is on its first check. There is nothing to have changed
 *    from, and "your target is up" an hour after they watched it be up on the page is not
 *    news.
 * 2. The status has to differ from the last one. This is the whole reason `last_status`
 *    lives on the row.
 * 3. **At most one change email per UTC day per watch.** At an hourly cadence a target that
 *    flaps every check would otherwise send 168 emails in a week, which is not a demo of the
 *    product but a reason to block the sender.
 *
 * One per day rather than one per watch, which was the other candidate. One per watch bounds
 * it hardest but makes a genuine outage on day five invisible — the single email was spent
 * on a blip on day one — and an alerting tool that stays quiet through an outage has
 * demonstrated the opposite of what it is for. One per day bounds the worst case at seven
 * change emails per target, matches the daily digest's own cadence so a reader's mental
 * model is "at most one of each a day", and loses nothing: every flap the bound suppresses
 * still appears in that day's digest bar, which is drawn from `trial_watch_results` and not
 * from what was emailed.
 *
 * Per watch and not per lead, unlike the digest, because each of these emails names one
 * target and one transition; collapsing three targets' outages into one email would make the
 * subject line a lie.
 *
 * Must be evaluated before {@link TrialWatch.recordCheck}, which overwrites the
 * `last_status` this compares against.
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
 * Whether this watch's seven-day wrap-up is owed: it has reached `expires_at` and has not
 * already sent one. `summary_sent_at` is the only guard needed, and it is what makes the
 * send idempotent against a redelivered sweep.
 *
 * Per watch, so a lead who tried URLs on days 0, 3 and 6 is wrapped up on days 7, 10 and 13
 * — three emails, each about the target whose week just ended. That is not a violation of
 * the one-digest-a-day rule; it is a different email on a different clock.
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
	 * Starts watching a target for a lead, stamping both of its deadlines.
	 *
	 * The first check is due one interval out, not immediately: the trial page has already
	 * probed the target and shown the visitor the answer, so a watch that checked again on the
	 * next cron tick would spend a check confirming what is on screen. Callers pass that first
	 * result as `last_status` in `input`, which gives change detection a baseline from the
	 * very first hour instead of burning one on establishing it.
	 *
	 * `normalized_url` is derived here rather than accepted, and derived *after* the spread so
	 * no caller can supply one. It is the key {@link TrialWatch.findByNormalizedUrl} caps on,
	 * and a row whose key does not match its own URL would be a free week nothing could ever
	 * find again.
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
				expires_at: now + TRIAL_WATCH_DURATION_DAYS * MS_PER_DAY,
				converts_until: now + TRIAL_WATCH_CONVERSION_WINDOW_DAYS * MS_PER_DAY,
				next_due_at: now + TRIAL_WATCH_INTERVAL_SECONDS * 1000,
			},
			{ touch: true, returnRow: true },
		);
	}

	/**
	 * The watch this lead already has on this URL, or `null` — the whole of the free-watch
	 * cap.
	 *
	 * **A row's existence is the thirty-day window**, so no date arithmetic happens here and
	 * none should be added. A watch is deleted by {@link TrialWatch.deleteExpired} thirty days
	 * after it was created, so a row can only be found while that window is open and finding
	 * one is exactly "this pair already had its free week". Adding a date condition would
	 * either duplicate the sweep's rule or quietly disagree with it.
	 *
	 * The lookup is on the normalized URL, which is what makes a trailing slash, a fragment or
	 * a reordered query string land on the watch that already exists instead of buying another
	 * one. `http://` and `https://` still do not collide — see `normalizeTrialUrl`.
	 *
	 * @param db - Database handle.
	 * @param leadId - The lead submitting the URL.
	 * @param url - The URL as typed; normalized here so callers cannot compare the wrong form.
	 * @returns The existing watch, or `null` when this pair is free to start one.
	 */
	static async findByNormalizedUrl(db: Database, leadId: string, url: string) {
		return await db.findOne(trialWatches, {
			where: { lead_id: leadId, normalized_url: normalizeTrialUrl(url) },
		});
	}

	/**
	 * Claims every watch whose next check is due as of `scheduledAt`, advancing each one's
	 * next due time as it does — the same statement, with the same guarantees, that the HTTP,
	 * DNS and TCP sweeps run. See `claimDue` in `~/app/lib/scheduling`.
	 *
	 * Expired watches are still claimed, deliberately: that is how the wrap-up gets sent at
	 * all. A watch past `expires_at` comes back from the claim like any other, the sweep sees
	 * {@link shouldSendSummary} and ends it with {@link TrialWatch.markSummarySent}, and it
	 * stops being claimed from then on because `next_due_at` is null. Filtering expiry out of
	 * the claim would leave those watches due forever with nothing ever looking at them.
	 */
	static async claimDue(db: Database, scheduledAt: number): Promise<ClaimedTrialWatch[]> {
		return await claimDue(db, trialWatches, CLAIM_COLUMNS, scheduledAt);
	}

	/** A single watch by id, for a job that needs the columns the claim does not project. */
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
	 * Everything one lead's daily digest renders: each of their still-active watches with its
	 * own results over the digest's window, oldest first.
	 *
	 * Two statements for any number of targets, not two per target. The digest job runs this
	 * once per lead and a lead can be watching several URLs, so a per-watch history read would
	 * turn one email into N+1 round trips against a database that charges by the row.
	 *
	 * "Active" is `next_due_at IS NOT NULL`, the same definition the claim and
	 * `Lead.listDueForDigest` use — a watch whose week ended has already had its own wrap-up
	 * and does not belong in tomorrow's digest.
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
	 * Records one check: appends the history row a digest's bar is drawn from, and folds the
	 * same check into the watch's own cached fields in one further statement.
	 *
	 * The counters are incremented in SQL rather than read, added to and written back, so a
	 * sweep that somehow ran two checks for one watch concurrently cannot lose one of them.
	 * `next_due_at` is not advanced here — the claim that handed this watch over already did
	 * that, and advancing it twice would silently halve the cadence — but it *is* nulled once
	 * `expires_at` has passed, which is the single act that ends a watch and takes it out of
	 * every future claim.
	 *
	 * @returns The history row's id, the only already-persisted unique fact about the check.
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
	 * Ends a watch without recording a check, for the sweep run that finds one already past
	 * `expires_at`. Nulling `next_due_at` is what "finished" means, so this, the expiry branch
	 * of {@link TrialWatch.recordCheck}, and {@link TrialWatch.markSummarySent} are the only
	 * ways a watch stops.
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
	 *
	 * One statement with three conditional sums, over a table bounded to the last thirty days
	 * of attempts, for the same reason `Lead.countFunnelActivity` scans rather than seeks: two
	 * of the three columns carry no index, and adding one for a once-a-day read would cost a
	 * written row on every send to save a scan of a few thousand.
	 *
	 * Each stamp is written at most once per watch per day — a wrap-up once ever, a change
	 * email once a day by `shouldNotifyChange` — so counting stamps inside a window counts
	 * emails and not watches. `created` doubles as the confirmation count, since a watch is
	 * created exactly when a confirmation goes out. It is not the submission count: a
	 * submission for a URL this lead already has a watch on creates nothing here and sends the
	 * repeat report instead, which is counted on the lead's `emails_sent` and nowhere else.
	 *
	 * @param db - Database handle.
	 * @param from - Start of the window, inclusive.
	 * @param to - End of the window, exclusive.
	 * @returns Watches created, change emails sent, and wrap-ups sent inside the window.
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

		// `SUM` over no rows is `NULL`, which is an empty table rather than an error.
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
	 * Whether this attempt can still become a real monitor: not already converted, and inside
	 * its own thirty-day window.
	 *
	 * Expiry of the *checking* is irrelevant here and is not consulted — a watch whose week
	 * ran out three weeks ago is exactly the one this offer is for.
	 */
	static isConvertible(
		watch: Pick<SelectTrialWatch, "converts_until" | "converted_at">,
		now: number,
	) {
		return watch.converted_at === null && now < watch.converts_until;
	}

	/**
	 * The watches a signing-up lead is owed real monitors for: theirs, unconverted, and still
	 * inside their own conversion windows.
	 *
	 * Per watch, which is what makes a partial conversion representable. A lead who tried URLs
	 * on days 0, 3 and 6 and signs up on day 32 gets the second and third — the first is past
	 * its own deadline and is skipped, not the whole set. Every remaining one is converted,
	 * not just the newest: they asked us to watch three things, and silently keeping one would
	 * be a worse first impression than the empty account they would otherwise have had.
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
	 * Records which real monitor a trial target became.
	 *
	 * This is the idempotency guard for the whole conversion, and it is per watch for a
	 * reason: a lead-level flag could not tell a watch created *after* the first conversion
	 * from the ones already handled, so a second sign-in would either duplicate all of them or
	 * skip the new one. With this set, signing in again finds nothing convertible and creates
	 * nothing.
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
	 * Deletes the per-check history of every watch whose own thirty days are up, in bounded
	 * batches — so a watch and its results go in the same sweep, and neither outlives the
	 * other.
	 *
	 * **The condition follows the watch and is not an age on `checked_at`.** The age was
	 * sound while nothing read a result after its watch's week ended, and both ways of
	 * writing it are wrong now that a repeat submission is answered with a report drawn from
	 * these rows. Seven days would leave a live watch with nothing to report the moment its
	 * first week's rows aged out; thirty would delete a result written on day six at *day
	 * thirty-six*, six days after {@link TrialWatch.deleteExpired} took the watch it belonged
	 * to, leaving rows nothing can ever reach or delete. Joining to the watch has neither
	 * failure: the results exist exactly as long as the row that explains them.
	 *
	 * **It must run before {@link TrialWatch.deleteExpired}**, and that is now load-bearing
	 * rather than incidental: the watch row is what identifies these results, so deleting the
	 * watches first would strand every one of them permanently.
	 *
	 * Batched in the shape `~/app/lib/retention` uses, hand-written for the same reason
	 * `Lead.deleteOrphaned` is: the predicate is a join rather than a date range, which
	 * `deleteOlderThan` cannot express.
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
	 * Deletes watches whose conversion window has closed, in bounded batches.
	 *
	 * On `converts_until` and never on `expires_at`: a watch whose week is over is still
	 * claimable for another three, and sweeping the wrong column would take the offer away
	 * without anyone noticing. A converted watch goes too — its monitor exists and owns the
	 * target now.
	 *
	 * **Must run after {@link TrialWatch.deleteExpiredResults} and before
	 * `Lead.deleteOrphaned`.** The results sweep identifies its rows by joining to these
	 * watches, so running it second would strand every one of them; and `Lead.deleteOrphaned`
	 * deletes leads with no watches left, which is only the right condition once the watches
	 * have already been reduced to the ones still worth keeping. Run that one first and a lead
	 * would be deleted while two of their three attempts were still claimable.
	 */
	static async deleteExpired(db: Database, now: number): Promise<BatchedSweepResult> {
		return await deleteOlderThan(db, "trial_watches", "converts_until", now);
	}
}
