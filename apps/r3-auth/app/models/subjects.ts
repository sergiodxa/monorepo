/**
 * The people who can sign in: lookup by email, the oldest-first listing the admin screens
 * page through, and the writes login flows and administration share, so both read one
 * description of who a subject is and how a new one gets its id.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { generateUUID } from "@sdxc/uuid/v4";

import { subjects } from "~/database/schema";

/** One page of a listing, as the admin screens request it. */
export interface PageWindow {
	limit: number;
	offset: number;
}

export const Subjects = createModel(subjects, {
	optional: ["id", "role"],

	methods: {
		/** The subject registered under an address, or `null` when nobody registered it. */
		findByEmail(emailAddress: string) {
			return this.findBy({ email_address: emailAddress });
		},

		/** One page of subjects oldest first, so a page number keeps pointing at the same people. */
		page(window: PageWindow) {
			return this.query()
				.orderBy("created_at", "asc")
				.limit(window.limit)
				.offset(window.offset)
				.all();
		},
	},

	callbacks: {
		/**
		 * Gives a new subject a generated id unless the caller picked one. The address stays
		 * unverified unless the caller stamps `email_verified_at`, as provider logins do.
		 */
		async beforeCreate(values) {
			return { ...values, id: values.id ?? generateUUID() };
		},
	},
});

/** A registered subject, as reads return it. */
export type Subject = ModelRow<typeof Subjects>;

export default Subjects;
