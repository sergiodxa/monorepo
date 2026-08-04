/**
 * Data-access model for `trial_conversions`: one durable row per account that arrived
 * through the public trial, carrying what the trial cost to produce it and the two instants
 * that make the funnel measurable — when they signed up, and when they first paid.
 *
 * **This is the table that outlives everything else in the trial.** Leads, watches and their
 * results are all swept, and an unsubscribe deletes a lead's entire history the moment it is
 * clicked, so by the time anyone asks how long a customer took to convert there is nothing
 * left to derive it from. A row here is written by *copying* those facts out at sign-up, not
 * by pointing at them, which is why it holds a URL list and an email count instead of a
 * lead id. Nothing may sweep it.
 *
 * **It is keyed on the OIDC subject.** That is deliberate and it is what lets the unsubscribe
 * promise keep holding: no address is stored here, so deleting a lead really does delete
 * every trace of the lead. Somebody who signed up is a customer rather than a lead in any
 * case, and the subject is `teams.owner_id`, which is what a Polar subscription carries as
 * its external customer id — so this joins to billing with no expiring hop in between.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@pkg/uuid";
import { getTableName } from "remix/data-table";

import type { SelectTrialConversion } from "~/database/schema";

import { trialConversions } from "~/database/schema";

/** Every column, so a `SELECT` hands back a whole row rather than a fragment. */
const COLUMNS = [
	"id",
	"created_at",
	"updated_at",
	"owner_id",
	"lead_created_at",
	"emails_sent",
	"watch_count",
	"urls",
	"landing_path",
	"campaign_source",
	"campaign_name",
	"signed_up_at",
	"paid_at",
] as const;

/** The snapshot of a lead taken at the moment their account first claimed a trial target. */
export interface TrialSignup {
	/** The OIDC subject, which is also `teams.owner_id`. */
	ownerId: string;
	/** When the lead was created — the start of "days from first try to paying". */
	leadCreatedAt: number;
	/** How many trial emails that address had received by now. */
	emailsSent: number;
	/** Every URL they had tried, oldest first; duplicates collapsed. */
	urls: string[];
	/** How many watches those URLs came from, which is how many times they used the form. */
	watchCount: number;
	/** When this sign-in happened. */
	signedUpAt: number;
	/**
	 * Where they first arrived, when the session still carried it.
	 *
	 * Absent is the expected case rather than a fault: first touch rides in a session cookie,
	 * so anyone who blocks it or signs in from a new session has none, and it must be recorded
	 * as unknown rather than defaulted to anything.
	 */
	attribution?: TrialSignupAttribution;
}

/** The first-touch fields a signup can carry, as they are stored. */
export interface TrialSignupAttribution {
	landingPath: string | null;
	source: string | null;
	campaign: string | null;
}

/**
 * The URLs a conversion recorded, back out of the JSON they are stored as.
 *
 * Tolerates anything that is not an array of strings by answering with an empty list. The
 * column is only ever written by {@link TrialConversion.recordSignup}, so a malformed value
 * should be impossible — and a report that throws while rendering one row would take the
 * whole day's email down over a field that is decoration.
 *
 * @param row - The conversion row.
 * @returns The URLs, or an empty list when the column cannot be read.
 */
export function trialConversionUrls(row: Pick<SelectTrialConversion, "urls">): string[] {
	try {
		let parsed: unknown = JSON.parse(row.urls);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((entry): entry is string => typeof entry === "string");
	} catch {
		return [];
	}
}

export default class TrialConversion {
	/**
	 * Records that an account came through the trial, once and only once.
	 *
	 * **Insert-or-ignore, not insert-or-update, and the difference is the whole contract.**
	 * Conversion runs on every sign-in, not only the first, so this is called repeatedly for
	 * the same subject over months. Every field on the row is a measurement taken *at the
	 * moment of first conversion* — how long they had been a lead, how many emails they had
	 * received by then, what they had tried — and all of them keep moving afterwards: claiming
	 * a target does not stop its hourly checks, so a converted lead goes on receiving digests
	 * for the rest of their seven days. Updating on conflict would answer "emails received so
	 * far" where the funnel asked "emails received before they converted", and would quietly
	 * change the answer every time they signed in.
	 *
	 * Ignoring the conflict also settles the two rules that matter on their own: `signed_up_at`
	 * cannot be moved later because it is never rewritten, and `paid_at` cannot be clobbered
	 * because it never appears in a statement this method issues.
	 *
	 * @param db - Database handle.
	 * @param signup - The snapshot to record; see {@link TrialSignup}.
	 * @returns Whether this call was the one that created the row.
	 */
	static async recordSignup(db: Database, signup: TrialSignup): Promise<boolean> {
		let now = Date.now();

		let result = await db.exec(
			`INSERT INTO ${getTableName(trialConversions)}
			        (id, created_at, updated_at, owner_id, lead_created_at, emails_sent,
			         watch_count, urls, landing_path, campaign_source, campaign_name,
			         signed_up_at, paid_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
			 ON CONFLICT (owner_id) DO NOTHING`,
			[
				generateUUID(),
				now,
				now,
				signup.ownerId,
				signup.leadCreatedAt,
				signup.emailsSent,
				signup.watchCount,
				JSON.stringify(signup.urls),
				signup.attribution?.landingPath ?? null,
				signup.attribution?.source ?? null,
				signup.attribution?.campaign ?? null,
				signup.signedUpAt,
			],
		);

		return (result.affectedRows ?? 0) > 0;
	}

	/**
	 * Stamps the first payment for an account, if it has one to stamp.
	 *
	 * `WHERE paid_at IS NULL` is what makes the first payment the recorded one: entitlement is
	 * re-asserted on every renewal, every plan change and every repair of a missed webhook, and
	 * a stamp that moved with them would report a conversion time that grew for as long as the
	 * customer stayed. The predicate is in the statement rather than in a read-then-write so two
	 * events arriving together cannot both find it null.
	 *
	 * A subject with no row here never came through the trial, which is the ordinary case and
	 * not an error: this answers `false` and the caller carries on.
	 *
	 * @param db - Database handle.
	 * @param ownerId - The OIDC subject that just became entitled.
	 * @param paidAt - When the payment landed.
	 * @returns Whether this call was the one that recorded the payment.
	 */
	static async markPaid(
		db: Database,
		ownerId: string,
		paidAt: number = Date.now(),
	): Promise<boolean> {
		let result = await db.exec(
			`UPDATE ${getTableName(trialConversions)}
			    SET paid_at = ?, updated_at = ?
			  WHERE owner_id = ? AND paid_at IS NULL`,
			[paidAt, paidAt, ownerId],
		);

		return (result.affectedRows ?? 0) > 0;
	}

	/** One account's conversion record, or `null` when it never came through the trial. */
	static async findByOwner(db: Database, ownerId: string) {
		return await db.findOne(trialConversions, { where: { owner_id: ownerId } });
	}

	/**
	 * The accounts that signed up inside a window, oldest first.
	 *
	 * @param db - Database handle.
	 * @param from - Start of the window, inclusive.
	 * @param to - End of the window, exclusive.
	 */
	static async listSignedUpBetween(
		db: Database,
		from: number,
		to: number,
	): Promise<SelectTrialConversion[]> {
		return await TrialConversion.listBetween(db, "signed_up_at", from, to);
	}

	/**
	 * The accounts whose first payment landed inside a window, oldest first.
	 *
	 * @param db - Database handle.
	 * @param from - Start of the window, inclusive.
	 * @param to - End of the window, exclusive.
	 */
	static async listPaidBetween(
		db: Database,
		from: number,
		to: number,
	): Promise<SelectTrialConversion[]> {
		return await TrialConversion.listBetween(db, "paid_at", from, to);
	}

	/**
	 * Rows whose `column` falls in a window. Private and given a column name rather than
	 * exposed, because the only two callers are the pair above and the column is theirs to
	 * choose — a `NULL` `paid_at` is excluded by the range comparison itself.
	 */
	private static async listBetween(
		db: Database,
		column: "signed_up_at" | "paid_at",
		from: number,
		to: number,
	): Promise<SelectTrialConversion[]> {
		let result = await db.exec(
			`SELECT ${COLUMNS.join(", ")}
			   FROM ${getTableName(trialConversions)}
			  WHERE ${column} >= ? AND ${column} < ?
			  ORDER BY ${column} ASC`,
			[from, to],
		);

		return (result.rows ?? []) as unknown as SelectTrialConversion[];
	}
}
