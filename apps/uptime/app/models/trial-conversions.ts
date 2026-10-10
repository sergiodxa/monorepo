/**
 * One durable row per account that arrived through the public trial: what the trial cost and
 * the two instants that make the funnel measurable, copied in at sign-up and kept forever. It
 * is keyed on the OIDC subject, which stores no address and is the customer id billing carries.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { generateUUID } from "@sdxc/uuid/v4";
import { getTableName, gte, lt } from "remix/data-table";

import type { SelectTrialConversion } from "~/database/schema";

import { trialConversions } from "~/database/schema";

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
	 * Where they first arrived, when the session still carried it. First touch rides in a
	 * session cookie, so a blocked cookie or a fresh session records it as unknown.
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
 * The URLs a conversion recorded, back out of the JSON they are stored as. A malformed value
 * answers with an empty list, so a report rendering one bad row still sends the whole day's
 * email over a field that is decoration.
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

export const TrialConversions = createModel(trialConversions, {
	optional: ["id", "emails_sent", "watch_count"],

	scopes: {
		signedUpBetween: (query, from: number, to: number) =>
			query.where(gte("signed_up_at", from)).where(lt("signed_up_at", to)),
		paidBetween: (query, from: number, to: number) =>
			query.where(gte("paid_at", from)).where(lt("paid_at", to)),
	},

	methods: {
		/**
		 * Records that an account came through the trial, once and only once: every field
		 * measures the moment of first conversion, so the insert ignores a conflict on
		 * `owner_id` and the first answer stands.
		 *
		 * @returns Whether this call was the one that created the row.
		 */
		async recordSignup(signup: TrialSignup): Promise<boolean> {
			let now = Date.now();

			let result = await this.db.exec(
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
		},

		/**
		 * Stamps the first payment for an account, if it has one to stamp. Entitlement is
		 * re-asserted on every renewal and repair, so `WHERE paid_at IS NULL` lives in the one
		 * statement and keeps the first payment the recorded one.
		 *
		 * @returns Whether this call was the one that recorded the payment.
		 */
		async markPaid(ownerId: string, paidAt: number = Date.now()): Promise<boolean> {
			let result = await this.db.exec(
				`UPDATE ${getTableName(trialConversions)}
				    SET paid_at = ?, updated_at = ?
				  WHERE owner_id = ? AND paid_at IS NULL`,
				[paidAt, paidAt, ownerId],
			);

			return (result.affectedRows ?? 0) > 0;
		},

		/** The accounts that signed up from `from` (inclusive) to `to` (exclusive), oldest first. */
		listSignedUpBetween(from: number, to: number): Promise<SelectTrialConversion[]> {
			return this.signedUpBetween(from, to).orderBy("signed_up_at", "asc").all();
		},

		/**
		 * The accounts whose first payment landed from `from` (inclusive) to `to` (exclusive),
		 * oldest first. The range leaves out every account still unpaid.
		 */
		listPaidBetween(from: number, to: number): Promise<SelectTrialConversion[]> {
			return this.paidBetween(from, to).orderBy("paid_at", "asc").all();
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return { ...values, id: values.id ?? generateUUID() };
		},
	},
});

/** An account's trial conversion, as reads return it. */
export type TrialConversion = ModelRow<typeof TrialConversions>;

export default TrialConversions;
