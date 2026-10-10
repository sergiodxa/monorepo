/**
 * Social-login connections, which tie an external provider identity to a subject. Provider
 * login resolves an identity through `findByIdentity` and provisions one through `create`, so
 * the (provider, external id) pair is the only thing the login flow reasons about.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { generateUUID } from "@sdxc/uuid/v4";

import { connections } from "~/database/schema";

export const Connections = createModel(connections, {
	optional: ["id"],

	methods: {
		/**
		 * The connection for a provider identity, or `null` when it never signed in here. The
		 * pair is unique, so a match names exactly one subject.
		 */
		findByIdentity(provider: string, externalId: string) {
			return this.findBy({ provider, external_id: externalId });
		},

		/**
		 * Every provider identity linked to a subject, oldest link first, so administration sees
		 * which providers an account signs in with: a subject keeps a way in while one
		 * connection or credential remains.
		 */
		findBySubjectId(subjectId: string) {
			return this.query().where({ subject_id: subjectId }).orderBy("created_at", "asc").all();
		},
	},

	callbacks: {
		/** Gives every connection a generated id. */
		async beforeCreate(values) {
			return { ...values, id: values.id ?? generateUUID() };
		},
	},
});

/** A provider identity linked to a subject, as reads return it. */
export type Connection = ModelRow<typeof Connections>;

export default Connections;
