/**
 * Password credentials. A subject has at most one, so the model is a lookup by subject plus
 * the writes password login, registration and reset need, kept away from the hashing itself:
 * every hash arrives already derived by the caller.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";
import type { Result } from "@sdxc/result";
import type { ValidationError } from "@sdxc/validate";

import { createModel } from "@sdxc/data-model";
import { isFailure, success } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";

import { credentials } from "~/database/schema";

export const Credentials = createModel(credentials, {
	optional: ["id"],

	methods: {
		/**
		 * A subject's password credential, or `null` when it signs in another way. Sign-in
		 * accepts it only once `verified_at` is stamped.
		 */
		findBySubjectId(subjectId: string) {
			return this.findBy({ subject_id: subjectId });
		},

		/**
		 * Replaces the stored hash for a subject that already has a credential, retiring a hash
		 * written under an older scheme once it verified. A subject who set no password stays
		 * passwordless.
		 *
		 * @returns How many credentials were rewritten — zero when the subject has none.
		 */
		async updatePasswordHash(subjectId: string, passwordHash: string): Promise<number> {
			let result = await this.query()
				.where({ subject_id: subjectId })
				.update({ password_hash: passwordHash });
			return result.affectedRows;
		},

		/**
		 * Sets a subject's password and marks the credential usable, creating it when the subject
		 * has none. `verified_at` is stamped because the caller proved inbox control;
		 * update-then-insert keeps the row whole without a transaction.
		 *
		 * @param passwordHash - An already-derived scrypt hash.
		 * @param verifiedAt - Epoch milliseconds the credential became usable at.
		 */
		async setVerifiedPassword(
			subjectId: string,
			passwordHash: string,
			verifiedAt: number,
		): Promise<Result<void, ValidationError>> {
			let result = await this.query()
				.where({ subject_id: subjectId })
				.update({ password_hash: passwordHash, verified_at: verifiedAt });
			if (result.affectedRows > 0) return success(undefined);

			let created = await this.create({
				subject_id: subjectId,
				password_hash: passwordHash,
				verified_at: verifiedAt,
			});
			return isFailure(created) ? created : success(undefined);
		},
	},

	callbacks: {
		/** Gives every credential a generated id. */
		async beforeCreate(values) {
			return { ...values, id: values.id ?? generateUUID() };
		},
	},
});

/** A stored password credential, as reads return it. */
export type Credential = ModelRow<typeof Credentials>;

export default Credentials;
