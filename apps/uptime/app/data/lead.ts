/**
 * Data-access model for leads: the people who probed a target on the public trial page and
 * left an email to follow up on. A lead is the person, so what they tried and how long it
 * stays claimable live on `trial_watches`, one row per attempt. The person is keyed on
 * `normalized_email` — lowercased, `+tag` removed — which is the unique column and the
 * upsert's conflict target, while `email` holds the spelling to deliver to.
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
import { normalizeLeadEmail } from "~/app/lib/trial-identity";
import { leads, trialWatchResults, trialWatches } from "~/database/schema";

/**
 * How long a lead with no watches left is kept before the cleanup sweep removes it. A race
 * guard: a lead row is written before the watch that justifies it, and an hour is orders of
 * magnitude more than that gap while costing nothing against a daily sweep.
 */
export const ORPHANED_LEAD_GRACE_MS = 60 * 60 * 1000;

/**
 * The zone the once-per-day digest bound is counted in. UTC, so every sweep run and the SQL
 * that selects the leads to iterate place the boundary identically — even for a lead who
 * switches language mid-trial — at the cost of a digest landing overnight somewhere.
 */
const BOUND_ZONE = "UTC";

/** What the trial form knows about a visitor at the moment they hand over an email. */
export interface LeadInput {
	email: string;
	/** The language they were browsing in, which every follow-up email goes out in. */
	locale: SupportedLanguage;
	/** Whether they ticked the marketing opt-in on this submission. */
	consented: boolean;
}

/** Every column, so the upsert's `RETURNING` hands back a whole row. */
const COLUMNS = [
	"id",
	"created_at",
	"updated_at",
	"email",
	"normalized_email",
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
 * Whether the daily digest is owed to this lead: exactly one per UTC day, however often the
 * job runs and however many targets they watch. The day is counted from `last_digest_at`,
 * falling back to `created_at`, so the first digest lands the day after sign-up.
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
	 * Records a lead, or updates the one that person already has. One statement keyed on the
	 * unique `normalized_email`, so concurrent submissions and every spelling of an address
	 * settle on one lead; a repeat refreshes `email` and `locale`, and preserves the rest.
	 */
	static async upsertByEmail(db: Database, input: LeadInput): Promise<SelectLead> {
		let now = Date.now();
		let table = getTableName(leads);

		let result = await db.exec(
			`INSERT INTO ${table}
			        (id, created_at, updated_at, email, normalized_email, unsubscribe_token,
			         locale, consented_at, last_digest_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
			 ON CONFLICT (normalized_email) DO UPDATE
			    SET updated_at = excluded.updated_at,
			        email = excluded.email,
			        locale = excluded.locale,
			        consented_at = COALESCE(${table}.consented_at, excluded.consented_at)
			RETURNING ${COLUMNS.join(", ")}`,
			[
				generateUUID(),
				now,
				now,
				input.email,
				normalizeLeadEmail(input.email),
				generateUUID(),
				input.locale,
				input.consented ? now : null,
			],
		);

		let [row] = (result.rows ?? []) as unknown as SelectLead[];
		if (!row) throw new Error(`Failed to record lead for ${input.email}`);
		return row;
	}

	/**
	 * The lead for an email address, or `null`. The sign-in path's entry point: an address is
	 * the only thing a lead and a newly signed-in subject are known to share. The lookup
	 * normalizes first, so signing up as `hello@x.com` claims what `hello+test@x.com` tried.
	 */
	static async findByEmail(db: Database, email: string) {
		return await db.findOne(leads, { where: { normalized_email: normalizeLeadEmail(email) } });
	}

	/** The lead a watch belongs to, for the emails a sweep sends. */
	static async findById(db: Database, leadId: string) {
		return await db.findOne(leads, { where: { id: leadId } });
	}

	/**
	 * The lead an unsubscribe link identifies, or `null` for an unknown token. Since
	 * {@link Lead.forget} removes the row holding the token, a second click on the same link
	 * settles quietly — the right behaviour for a link that lives in an inbox forever.
	 */
	static async findByUnsubscribeToken(db: Database, token: string) {
		return await db.findOne(leads, { where: { unsubscribe_token: token } });
	}

	/**
	 * The leads the daily digest job iterates: those with a still-active watch whose last
	 * digest predates today. Driven off `trial_watches`, the selective and indexed half,
	 * through `EXISTS` so a lead with three active watches yields one row and one email.
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
	 * Counts one more email this address has received. Call it once a transport has accepted
	 * the message: the number lands on a `trial_conversions` row at sign-up, read as "emails
	 * received before converting". The `+ 1` runs in SQL, so concurrent sends all count.
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
	 * The two numbers the funnel report draws from this table for one UTC day. One statement
	 * with two conditional sums over a scan, since the table only ever holds the last thirty
	 * days of leads; `SUM` across an empty table yields `NULL`, which reads back as zero.
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

		let [row] = (result.rows ?? []) as unknown as {
			created: number | null;
			digestsSent: number | null;
		}[];
		return { created: Number(row?.created ?? 0), digestsSent: Number(row?.digestsSent ?? 0) };
	}

	/**
	 * Whether a lead may be emailed beyond the targets they asked us to watch. That is the
	 * distinction `consented_at` carries: the digest and wrap-up are the service they
	 * requested and go out on their own, while every other send reads this first.
	 */
	static hasMarketingConsent(lead: Pick<SelectLead, "consented_at">) {
		return lead.consented_at !== null;
	}

	/**
	 * Removes a lead and everything attached to it — every watch it started and every check
	 * recorded against those watches — which is what an unsubscribe click does. A hard delete,
	 * so afterwards we hold nothing; handing the address over again starts a fresh lead.
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
	 * Deletes leads whose watches are all gone, in bounded batches. Run it after
	 * `TrialWatch.deleteExpired`: the existence check is correct precisely because each watch
	 * has already gone on its own thirty-day clock, so a lead keeps every offer still open.
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
