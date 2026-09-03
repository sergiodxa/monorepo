/**
 * Data-access model for `trial_conversions`: one durable row per account that arrived through
 * the public trial, holding what the trial cost and the two instants that make the funnel
 * measurable. Leads and watches are swept and an unsubscribe erases a lead's whole history, so
 * every fact is copied in at sign-up and this row is kept forever. It is keyed on the OIDC
 * subject, which stores no address and is the external customer id billing carries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@sdxc/uuid";
import { getTableName } from "remix/data-table";

import type { SelectTrialConversion } from "~/database/schema";

import { trialConversions } from "~/database/schema";

/** Every column, so a `SELECT` hands back a whole row. */
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
	 * First touch rides in a session cookie, so a blocked cookie or a fresh session leaves it
	 * absent, and absent is recorded as unknown.
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
 * A malformed value answers with an empty list, so a report rendering one bad row still sends
 * the whole day's email over a field that is decoration.
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
	 * Every field measures the moment of first conversion while the underlying counts keep
	 * moving, so the insert ignores a conflict and the first answer is the one that stands.
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
	 * Entitlement is re-asserted on every renewal, plan change and repair, so `WHERE paid_at IS
	 * NULL` lives in the statement and keeps the first payment the recorded one.
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
	 * Rows whose `column` falls in a window, shared by the two public ranges that pick it. The
	 * range comparison excludes a `NULL` `paid_at` on its own.
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
