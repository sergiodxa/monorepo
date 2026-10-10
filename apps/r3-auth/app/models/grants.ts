/**
 * Consent grants, which record that a subject authorized a client: find-or-create for the
 * authorization flow, the per-subject listing the account area shows with client details, a
 * per-client count for administration, and the deletions that withdraw consent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";
import type { Result } from "@sdxc/result";
import type { ValidationError } from "@sdxc/validate";

import { createModel } from "@sdxc/data-model";
import { success } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";

import type { SelectClient, SelectGrant } from "~/database/schema";

import { grantClient, grants } from "~/database/schema";

/** A grant with the client it was given to, for the account area's consent list. */
export interface GrantWithClient extends SelectGrant {
	client: SelectClient | null;
}

export const Grants = createModel(grants, {
	optional: ["id"],

	scopes: {
		/** The consent one subject gave one client. */
		between: (query, subjectId: string, clientId: string) =>
			query.where({ subject_id: subjectId, client_id: clientId }),
	},

	methods: {
		/**
		 * The subject's grant for a client, recorded on first consent. Every authorization runs
		 * this, so it stays idempotent: the unique (subject, client) index collapses a second
		 * consent into the first.
		 */
		async findOrCreate(
			subjectId: string,
			clientId: string,
		): Promise<Result<SelectGrant, ValidationError>> {
			let existing = await this.between(subjectId, clientId).first();
			if (existing !== null) return success(existing);
			return await this.create({ subject_id: subjectId, client_id: clientId });
		},

		/**
		 * Whether the subject authorized the client and has not withdrawn it since, which
		 * entitles that client to read the subject's profile outside a sign-in.
		 */
		async hasConsented(subjectId: string, clientId: string): Promise<boolean> {
			return (await this.between(subjectId, clientId).first()) !== null;
		},

		/** A subject's grants with their clients, oldest consent first. */
		findBySubjectId(subjectId: string): Promise<GrantWithClient[]> {
			return this.query()
				.where({ subject_id: subjectId })
				.orderBy("created_at", "asc")
				.with({ client: grantClient })
				.all();
		},

		/** How many subjects authorized a client, for its admin detail page. */
		countByClientId(clientId: string) {
			return this.query().where({ client_id: clientId }).count();
		},

		/** Withdraws every consent a subject gave, answering how many. */
		async deleteBySubjectId(subjectId: string): Promise<number> {
			return (await this.query().where({ subject_id: subjectId }).delete()).affectedRows;
		},

		/** Withdraws every consent given to a client, as deleting the client does. */
		async deleteByClientId(clientId: string): Promise<number> {
			return (await this.query().where({ client_id: clientId }).delete()).affectedRows;
		},

		/** Withdraws one subject's consent for one client, answering how many rows went. */
		async deleteBySubjectAndClient(subjectId: string, clientId: string): Promise<number> {
			return (await this.between(subjectId, clientId).delete()).affectedRows;
		},
	},

	callbacks: {
		/** Gives every grant a generated id. */
		async beforeCreate(values) {
			return { ...values, id: values.id ?? generateUUID() };
		},
	},
});

/** A recorded consent, as reads return it. */
export type Grant = ModelRow<typeof Grants>;

export default Grants;
