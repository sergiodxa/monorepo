/**
 * The people who probed a target on the public trial page and left an email to follow up on.
 * A lead is the person, keyed on `normalized_email` (lowercased, `+tag` removed); what they
 * tried lives on trial watches, and `email` holds the spelling to deliver to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow, NotFound } from "@sdxc/data-model";
import type { Result } from "@sdxc/result";
import type { ValidationError } from "@sdxc/validate";

import { createModel } from "@sdxc/data-model";
import { startOfDay, toDayKey } from "@sdxc/dates";
import { failure, success } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";
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
 * that selects the leads to iterate place the boundary identically, even for a lead who
 * switches language mid-trial.
 */
const BOUND_ZONE = "UTC";

/** Every column, so a raw statement's `RETURNING` or `SELECT` hands back a whole row. */
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

/** What the trial form knows about a visitor at the moment they hand over an email. */
export interface LeadInput {
	email: string;
	/** The language they were browsing in, which every follow-up email goes out in. */
	locale: SupportedLanguage;
	/** Whether they ticked the marketing opt-in on this submission. */
	consented: boolean;
}

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

/**
 * Whether a lead may be emailed beyond the targets they asked us to watch. The digest and
 * wrap-up are the service they requested and go out on their own, while every other send
 * reads this first.
 */
export function hasMarketingConsent(lead: Pick<SelectLead, "consented_at">) {
	return lead.consented_at !== null;
}

export const Leads = createModel(leads, {
	optional: ["id", "unsubscribe_token", "emails_sent"],

	methods: {
		/**
		 * Records a lead, or updates the one that person already has, in one statement keyed on
		 * the unique `normalized_email`, so concurrent submissions and every spelling of an
		 * address settle on one lead. A repeat refreshes `email` and `locale` and keeps the rest.
		 */
		async upsertByEmail(input: LeadInput): Promise<Result<SelectLead, Error>> {
			let now = Date.now();
			let table = getTableName(leads);

			let result = await this.db.exec(
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
			if (!row) return failure(new Error(`Failed to record lead for ${input.email}`));
			return success(row);
		},

		/**
		 * The lead for an email address, or `null`: the sign-in path's entry point. The lookup
		 * normalizes first, so signing up as `hello@x.com` claims what `hello+test@x.com` tried.
		 */
		findByEmail(email: string): Promise<SelectLead | null> {
			return this.findBy({ normalized_email: normalizeLeadEmail(email) });
		},

		/**
		 * The leads the daily digest job iterates: those with a still-active watch whose last
		 * digest predates today. Driven off `trial_watches` through `EXISTS`, so a lead with
		 * three active watches yields one row and one email.
		 */
		async listDueForDigest(now: number): Promise<SelectLead[]> {
			let result = await this.db.exec(
				`SELECT ${COLUMNS.map((column) => `l.${column}`).join(", ")}
				   FROM ${getTableName(leads)} l
				  WHERE COALESCE(l.last_digest_at, l.created_at) < ?
				    AND EXISTS (SELECT 1
				                  FROM ${getTableName(trialWatches)} w
				                 WHERE w.lead_id = l.id AND w.next_due_at IS NOT NULL)
				  ORDER BY l.created_at ASC`,
				[startOfDay(new Date(now), BOUND_ZONE).getTime()],
			);

			return (result.rows ?? []) as unknown as SelectLead[];
		},

		/** Stamps the digest, which is what moves the next one to the following day. */
		markDigestSent(
			leadId: string,
			sentAt: number = Date.now(),
		): Promise<Result<SelectLead, ValidationError | NotFound>> {
			return this.update(leadId, { last_digest_at: sentAt });
		},

		/**
		 * Counts one more email this address received, once a transport accepted it; the total
		 * lands on a trial conversion at sign-up. One `UPDATE … SET emails_sent = emails_sent + 1`
		 * statement, so concurrent sends all count.
		 */
		async recordEmailSent(leadId: string, sentAt: number = Date.now()): Promise<void> {
			await this.db.exec(
				`UPDATE ${getTableName(leads)}
				    SET emails_sent = emails_sent + 1, updated_at = ?
				  WHERE id = ?`,
				[sentAt, leadId],
			);
		},

		/**
		 * The two numbers the funnel report draws from this table for one window, `from`
		 * inclusive and `to` exclusive. `SUM` across an empty table yields `NULL`, which reads
		 * back as zero.
		 */
		async countFunnelActivity(from: number, to: number): Promise<LeadFunnelActivity> {
			let result = await this.db.exec(
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
		},

		/**
		 * Removes a lead with every watch it started and every check recorded against those
		 * watches, which is what an unsubscribe click does. Children go first, so a failure
		 * part-way leaves the lead in place for a retry to finish.
		 */
		async forget(leadId: string): Promise<void> {
			await this.db.exec(
				`DELETE FROM ${getTableName(trialWatchResults)}
				  WHERE trial_watch_id IN (SELECT id FROM ${getTableName(trialWatches)} WHERE lead_id = ?)`,
				[leadId],
			);

			await this.db.exec(`DELETE FROM ${getTableName(trialWatches)} WHERE lead_id = ?`, [leadId]);
			await this.db.exec(`DELETE FROM ${getTableName(leads)} WHERE id = ?`, [leadId]);
		},

		/**
		 * Deletes leads whose watches are all gone, in bounded batches. Run it after the expired
		 * watches are deleted: each watch goes on its own thirty-day clock, so a lead keeps every
		 * offer still open.
		 */
		async deleteOrphaned(now: number): Promise<BatchedSweepResult> {
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
				let result = await this.db.exec(sql, [cutoff, RETENTION_BATCH_SIZE]);
				batches += 1;

				let affected = result.affectedRows ?? 0;
				rowsAffected += affected;

				if (affected < RETENTION_BATCH_SIZE) {
					return { rowsAffected, batches, reachedCeiling: false };
				}
			}

			return { rowsAffected, batches, reachedCeiling: true };
		},
	},

	callbacks: {
		/** Mints the row's id and the unsubscribe token, a random credential no address derives. */
		async beforeCreate(values) {
			return {
				...values,
				id: values.id ?? generateUUID(),
				unsubscribe_token: values.unsubscribe_token ?? generateUUID(),
			};
		},
	},
});

/** A lead, as reads return it. */
export type Lead = ModelRow<typeof Leads>;

export default Leads;
