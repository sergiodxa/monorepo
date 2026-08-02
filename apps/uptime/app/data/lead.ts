/**
 * Data-access model for leads: the people who probed a target on the public trial page and
 * left an email so it could be followed up on. A lead is not a user and not a Polar
 * customer — nothing they do is billed, and a billing customer is only ever provisioned
 * when they actually sign up.
 *
 * A lead is the *person*, not the attempt. What they tried, how long it is checked for and
 * how long a sign-up can still claim it all live on `trial_watches`, one row per attempt.
 * The one schedule that is genuinely per person is the daily digest — three watched URLs
 * are one reader and one inbox, so they are one email a day — which is why
 * {@link Lead.listDueForDigest} and {@link shouldSendDigest} are here and the weekly
 * wrap-up is not.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { toDayKey } from "@pkg/dates";
import { generateUUID } from "@pkg/uuid";
import { getTableName } from "remix/data-table";

import type { BatchedSweepResult } from "~/app/lib/retention";
import type { SelectLead, SupportedLanguage } from "~/database/schema";

import { RETENTION_BATCH_SIZE, RETENTION_MAX_BATCHES } from "~/app/lib/retention";
import { leads, trialWatchResults, trialWatches } from "~/database/schema";

/**
 * How long a lead with no watches left is kept before the cleanup sweep removes it.
 *
 * Not a retention window in the ADR-020 sense — by the time a lead is orphaned its last
 * watch is already 30 days past its own conversion deadline, so this is only a guard
 * against a race: a lead row is written before the watch that justifies it, and a sweep
 * landing in between would otherwise find a brand-new lead with no watches and delete it
 * out from under the request that just created it. An hour is several orders of magnitude
 * more than that gap and costs nothing, since the sweep is daily.
 */
export const ORPHANED_LEAD_GRACE_MS = 60 * 60 * 1000;

/**
 * The zone the once-per-day digest bound is counted in.
 *
 * UTC rather than the reader's own zone, which the trial page never asks for: the bound has
 * to be evaluated identically by every sweep run and by the SQL that selects the leads to
 * iterate, and a zone guessed from a locale would move the boundary under a lead who
 * switched language. The cost is that a digest can land in the small hours somewhere; the
 * alternative is a bound that is not a bound.
 */
const BOUND_ZONE = "UTC";

/** What the trial form knows about a visitor at the moment they hand over an email. */
export interface LeadInput {
	email: string;
	/** Optional: the form asks for a first name and does not require one. */
	/** The language they were browsing in, which every follow-up email goes out in. */
	locale: SupportedLanguage;
	/** Whether they ticked the marketing opt-in on this submission. */
	consented: boolean;
}

/** Every column, so the upsert's `RETURNING` hands back a whole row rather than a fragment. */
const COLUMNS = [
	"id",
	"created_at",
	"updated_at",
	"email",
	"unsubscribe_token",
	"locale",
	"consented_at",
	"last_digest_at",
	"emails_sent",
] as const;

/** What one window of the funnel report needs to know about the `leads` table. */
export interface LeadFunnelActivity {
	/** Addresses handed over for the first time in the window. */
	created: number;
	/** Daily digests sent in the window, one per lead by construction. */
	digestsSent: number;
}

/**
 * Whether the daily digest is owed to this lead: exactly one per UTC day, no matter how
 * often the job runs or how many targets they are watching.
 *
 * The day is counted from `last_digest_at`, falling back to `created_at` when none has been
 * sent — so the day they signed up never gets one (they watched the first result happen on
 * the page; a summary of it hours later is noise) and the first digest lands the following
 * day, covering a whole day of checks.
 *
 * The predicate and {@link Lead.listDueForDigest}'s `WHERE` clause say the same thing two
 * ways on purpose: the query is what the job iterates, and this is what a test and a
 * re-check just before sending can call without a round trip.
 */
export function shouldSendDigest(
	lead: Pick<SelectLead, "created_at" | "last_digest_at">,
	now: number,
) {
	let since = lead.last_digest_at ?? lead.created_at;
	return toDayKey(new Date(since), BOUND_ZONE) !== toDayKey(new Date(now), BOUND_ZONE);
}

/** Midnight UTC on the day `now` falls in, which is the digest bound as an instant. */
function startOfUtcDay(now: number) {
	let date = new Date(now);
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export default class Lead {
	/**
	 * Records a lead, or updates the one that address already has.
	 *
	 * One statement keyed on the unique `email`, not a read followed by a write: two trial
	 * submissions racing from the same person would otherwise both find nothing and both
	 * insert, and the second insert would fail on the constraint after the first had already
	 * created a watch pointing at a lead the caller no longer has.
	 *
	 * What a repeat submission does to each field is a separate decision, and none of them
	 * is "take the newest value":
	 *
	 * - `locale` always takes the new value: it is the language of the page they are on right
	 *   now, which is the best guess available for the language to write to them in.
	 * - `consented_at` only ever goes from null to a timestamp. An unticked box on a later
	 *   submission is not a withdrawal — withdrawal is the unsubscribe link, a different path
	 *   with a different audit trail — and treating it as one would silently revoke a consent
	 *   the person never revoked.
	 * - `last_digest_at` is untouched. Trying a second URL does not entitle them to a second
	 *   digest that day, and resetting it would do exactly that.
	 * - `unsubscribe_token` is untouched. Rotating it would silently break the unsubscribe
	 *   link in every email already in their inbox, which is the one link that must never
	 *   stop working.
	 */
	static async upsertByEmail(db: Database, input: LeadInput): Promise<SelectLead> {
		let now = Date.now();
		let table = getTableName(leads);

		let result = await db.exec(
			`INSERT INTO ${table}
			        (id, created_at, updated_at, email, unsubscribe_token, locale,
			         consented_at, last_digest_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
			 ON CONFLICT (email) DO UPDATE
			    SET updated_at = excluded.updated_at,
			        locale = excluded.locale,
			        consented_at = COALESCE(${table}.consented_at, excluded.consented_at)
			RETURNING ${COLUMNS.join(", ")}`,
			[
				generateUUID(),
				now,
				now,
				input.email,
				generateUUID(),
				input.locale,
				input.consented ? now : null,
			],
		);

		let [row] = (result.rows ?? []) as unknown as SelectLead[];
		// The upsert is unconditional, so every path through it writes a row and returns it.
		if (!row) throw new Error(`Failed to record lead for ${input.email}`);
		return row;
	}

	/**
	 * The lead for an email address, or `null`. This is the sign-in path's entry point: an
	 * address is the only thing a lead and a newly signed-in subject are known to share.
	 */
	static async findByEmail(db: Database, email: string) {
		return await db.findOne(leads, { where: { email } });
	}

	/** The lead a watch belongs to, for the emails a sweep sends. */
	static async findById(db: Database, leadId: string) {
		return await db.findOne(leads, { where: { id: leadId } });
	}

	/**
	 * The lead an unsubscribe link identifies, or `null` when the token is unknown — which
	 * includes the token of a lead who has already unsubscribed, since {@link Lead.forget}
	 * removes the row that holds it. A second click on the same link is therefore a no-op
	 * rather than an error, which is the right behaviour for a link that lives in an inbox
	 * forever.
	 */
	static async findByUnsubscribeToken(db: Database, token: string) {
		return await db.findOne(leads, { where: { unsubscribe_token: token } });
	}

	/**
	 * The leads the daily digest job iterates: those with at least one still-active watch who
	 * have not already had a digest today.
	 *
	 * Driven off `trial_watches` rather than off `leads`, because "has an active watch" is
	 * the selective half — most leads in the table are finished — and it is the half with an
	 * index (`trial_watches_next_due_at_idx`). `EXISTS` rather than a join so a lead with
	 * three active watches is returned once; the digest covers all three in one email.
	 *
	 * The date bound is `COALESCE(last_digest_at, created_at) < midnight UTC today`, which is
	 * {@link shouldSendDigest} expressed in SQL. Both forms have to agree, so the fallback to
	 * `created_at` — the rule that stops a digest going out on the day someone signed up —
	 * appears in both.
	 */
	static async listDueForDigest(db: Database, now: number): Promise<SelectLead[]> {
		let result = await db.exec(
			`SELECT ${COLUMNS.map((column) => `l.${column}`).join(", ")}
			   FROM ${getTableName(leads)} l
			  WHERE COALESCE(l.last_digest_at, l.created_at) < ?
			    AND EXISTS (SELECT 1
			                  FROM ${getTableName(trialWatches)} w
			                 WHERE w.lead_id = l.id AND w.next_due_at IS NOT NULL)
			  ORDER BY l.created_at ASC`,
			[startOfUtcDay(now)],
		);

		return (result.rows ?? []) as unknown as SelectLead[];
	}

	/** Stamps the digest, which is what moves the next one to the following day. */
	static async markDigestSent(db: Database, leadId: string, sentAt: number = Date.now()) {
		return await db.update(leads, leadId, { last_digest_at: sentAt }, { touch: true });
	}

	/**
	 * Counts one more email this address has received.
	 *
	 * **Call it only after a transport accepted the message**, alongside the stamp that send
	 * already writes — {@link Lead.markDigestSent}, `TrialWatch.markChangeNotified`,
	 * `TrialWatch.markSummarySent`. The number is copied onto a `trial_conversions` row at
	 * sign-up and read as "emails this person received before converting", so counting an
	 * attempt the provider rejected would answer a different question than the one asked.
	 *
	 * `emails_sent = emails_sent + 1` in SQL rather than a read, an add and a write, for the
	 * same reason {@link Lead.upsertByEmail} is one statement: the four sends are dispatched
	 * from three different places and two of them run concurrently over a batch of leads, so
	 * a read-modify-write would lose increments exactly when a lead is busiest.
	 *
	 * @param db - Database handle.
	 * @param leadId - The lead who received the email.
	 * @param sentAt - When it went out; also the row's new `updated_at`.
	 */
	static async recordEmailSent(db: Database, leadId: string, sentAt: number = Date.now()) {
		return await db.exec(
			`UPDATE ${getTableName(leads)}
			    SET emails_sent = emails_sent + 1, updated_at = ?
			  WHERE id = ?`,
			[sentAt, leadId],
		);
	}

	/**
	 * The two numbers the funnel report draws from this table for one UTC day.
	 *
	 * One statement with two conditional sums rather than two counts, and a scan rather than
	 * two index seeks. The table only ever holds the leads of the last thirty days — everything
	 * older has been swept — so it is small by construction, and `last_digest_at` has no index
	 * of its own to seek on. Adding one for a query that runs once a day would cost a written
	 * row on every digest to save a scan of a few thousand.
	 *
	 * @param db - Database handle.
	 * @param from - Start of the window, inclusive.
	 * @param to - End of the window, exclusive.
	 * @returns Leads created and digests sent inside the window.
	 */
	static async countFunnelActivity(
		db: Database,
		from: number,
		to: number,
	): Promise<LeadFunnelActivity> {
		let result = await db.exec(
			`SELECT SUM(CASE WHEN created_at >= ? AND created_at < ? THEN 1 ELSE 0 END) AS created,
			        SUM(CASE WHEN last_digest_at >= ? AND last_digest_at < ? THEN 1 ELSE 0 END)
			          AS digestsSent
			   FROM ${getTableName(leads)}`,
			[from, to, from, to],
		);

		// `SUM` over no rows is `NULL`, which is an empty table rather than an error.
		let [row] = (result.rows ?? []) as unknown as {
			created: number | null;
			digestsSent: number | null;
		}[];
		return { created: Number(row?.created ?? 0), digestsSent: Number(row?.digestsSent ?? 0) };
	}

	/**
	 * Whether a lead may be emailed about anything other than the targets they asked us to
	 * watch.
	 *
	 * The distinction `consented_at` exists to carry: giving an address so we can report on
	 * *those targets* is not consent to be marketed to. The digest and wrap-up emails are the
	 * service they requested and go out regardless; every other send reads this first.
	 */
	static hasMarketingConsent(lead: Pick<SelectLead, "consented_at">) {
		return lead.consented_at !== null;
	}

	/**
	 * Removes a lead and everything attached to it: every watch it started and every check
	 * recorded against those watches. This is what an unsubscribe click does.
	 *
	 * **A hard delete, not a suppression list**, which is the opposite of what most systems
	 * do and is the deliberate choice here. A suppression list keeps the address forever in
	 * order to know not to write to it, which means the answer to "do you still have my
	 * email?" is yes. These rows exist only to email someone about targets they asked us to
	 * watch, so once they ask us to stop there is nothing left for the row to be for, and the
	 * safe thing to keep is nothing. Handing the same address over again later starts a fresh
	 * lead with a fresh token, which is exactly what someone doing that intends.
	 *
	 * **It ignores conversion windows, unlike {@link Lead.deleteOrphaned}.** Unsubscribing on
	 * day 5 and signing up on day 20 auto-creates no monitor, because the watch that would
	 * have been converted is gone. That is surprising and it is correct: the conversion rule
	 * protects a lead from being forgotten *before they asked*, and this is them asking. The
	 * two paths are named apart so a call site cannot mean one and get the other.
	 *
	 * Unbatched, unlike the sweeps: one lead has a handful of watches and at most 168 rows
	 * each, so the whole cascade is a few hundred rows on a person-sized request that should
	 * finish before the response goes out.
	 */
	static async forget(db: Database, leadId: string): Promise<void> {
		await db.exec(
			`DELETE FROM ${getTableName(trialWatchResults)}
			  WHERE trial_watch_id IN (SELECT id FROM ${getTableName(trialWatches)} WHERE lead_id = ?)`,
			[leadId],
		);

		await db.exec(`DELETE FROM ${getTableName(trialWatches)} WHERE lead_id = ?`, [leadId]);
		await db.exec(`DELETE FROM ${getTableName(leads)} WHERE id = ?`, [leadId]);
	}

	/**
	 * Deletes leads that have no watches left, in bounded batches.
	 *
	 * **This must run after `TrialWatch.deleteExpired`, and the order is the whole design.**
	 * "Has no watches left" is the only condition here, and it is correct *because* watches
	 * are deleted on their own thirty-day clock first: a lead who tried URLs on days 0, 3 and
	 * 6 still owns two watch rows on day 32, so this query does not match them, and they
	 * survive with exactly the offers that are still open. Run in the other order, or with a
	 * date condition on the lead instead of an existence check on its watches, and a lead
	 * would be deleted while two of their three attempts were still claimable.
	 *
	 * The age cutoff is not a retention window — see {@link ORPHANED_LEAD_GRACE_MS} — it only
	 * stops the sweep from racing the request that is creating a lead's first watch.
	 *
	 * **Consent is not an exemption, and the alternative was considered and rejected.** The
	 * argument for keeping a lead with `consented_at` set is that the row *is* the record that
	 * consent was given, and deleting it while the address sits on a mailing list would leave
	 * the list with no basis for writing to it. That argument is sound, and it does not apply
	 * yet: there is no standing list. Every email this feature sends is driven by a watch —
	 * confirmation, on-change, the daily digest, the weekly wrap-up — and all of them stop by
	 * day seven, so once the last conversion window closes there is nothing left for the
	 * consent to authorise. Exempting these rows would keep an email address indefinitely for
	 * a purpose that has expired, and would quietly turn this sweep into a no-op for exactly
	 * the people most likely to have consented.
	 *
	 * The day a standing mailing list exists, that flips: whoever adds one must revisit this
	 * method, because at that point the consent record outlives the watches and a lead on the
	 * list must survive its last watch. Until then the rule is the simple one.
	 *
	 * Batched in the shape `~/app/lib/retention` uses — `id IN (SELECT id … LIMIT ?)`, stop
	 * on a short batch or at the ceiling — because the predicate is an existence check rather
	 * than a date range and `deleteOlderThan` cannot express it.
	 */
	static async deleteOrphaned(db: Database, now: number): Promise<BatchedSweepResult> {
		let table = getTableName(leads);
		let cutoff = now - ORPHANED_LEAD_GRACE_MS;

		let sql =
			`DELETE FROM ${table} WHERE \`id\` IN (` +
			`SELECT \`id\` FROM ${table} ` +
			`WHERE \`created_at\` < ? ` +
			`AND NOT EXISTS (SELECT 1 FROM ${getTableName(trialWatches)} ` +
			`WHERE \`lead_id\` = ${table}.\`id\`) LIMIT ?)`;

		let rowsAffected = 0;
		let batches = 0;

		while (batches < RETENTION_MAX_BATCHES) {
			let result = await db.exec(sql, [cutoff, RETENTION_BATCH_SIZE]);
			batches += 1;

			let affected = result.affectedRows ?? 0;
			rowsAffected += affected;

			if (affected < RETENTION_BATCH_SIZE) return { rowsAffected, batches, reachedCeiling: false };
		}

		return { rowsAffected, batches, reachedCeiling: true };
	}
}
