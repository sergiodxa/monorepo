/**
 * The people who sign in to the blog: lookups by the identifiers a login carries, and the
 * reconciliation of an auth provider's profile into a local account, which links an
 * existing account by email only when the provider verified that address.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";
import type { Result } from "@sdxc/result";

import { createModel } from "@sdxc/data-model";
import { failure, isFailure, success } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v7";

import type { SelectUser } from "~/database/schema";

import { users } from "~/database/schema";

/** The profile fields a login reads from the auth provider. */
export interface AuthProfile {
	/** The provider's stable identifier for the person, which links every later login. */
	subjectId: string;
	email: string;
	/** Whether the provider vouches the person controls `email`, which linking requires. */
	emailVerified: boolean;
	avatar: string;
	username: string;
	displayName: string;
}

/**
 * A first login refused because its email names an existing account and the provider has
 * not verified the person controls that address, so the account stays with its owner.
 */
export class UnverifiedEmailError extends Error {
	override name = "UnverifiedEmailError";
}

/** A login whose account could not be written, with the write's failure as `cause`. */
export class UserSaveError extends Error {
	override name = "UserSaveError";
}

export const Users = createModel(users, {
	optional: ["id", "role"],

	methods: {
		findByEmail(email: string) {
			return this.findBy({ email });
		},

		findBySubjectId(subjectId: string) {
			return this.findBy({ subject_id: subjectId });
		},

		findByUsername(username: string) {
			return this.findBy({ username });
		},

		/**
		 * Links a login to its account: by subject id first, then by email for a first login,
		 * which claims an existing account only when the provider verified the address. A
		 * person matching no account becomes a guest; a known one gets the profile's fields.
		 */
		async findOrCreateFromAuthProfile(
			profile: AuthProfile,
		): Promise<Result<SelectUser, UnverifiedEmailError | UserSaveError>> {
			let existing = await this.findBy({ subject_id: profile.subjectId });

			if (existing === null) {
				existing = await this.findBy({ email: profile.email });
				if (existing !== null && !profile.emailVerified) {
					return failure(new UnverifiedEmailError("The email names an account it cannot claim"));
				}
			}

			let fields = {
				subject_id: profile.subjectId,
				email: profile.email,
				avatar: profile.avatar,
				username: profile.username,
				display_name: profile.displayName,
			};

			let saved =
				existing === null
					? await this.create({ ...fields, role: "guest" })
					: await this.update(existing.id, fields);

			if (isFailure(saved)) {
				return failure(new UserSaveError("The account could not be saved", { cause: saved.error }));
			}
			return success(saved.data);
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return { ...values, id: values.id ?? generateUUID() };
		},
	},
});

/** A signed-in person, as reads return them. */
export type User = ModelRow<typeof Users>;

export default Users;
