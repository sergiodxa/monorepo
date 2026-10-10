/**
 * The filter rules a reader writes: a field, a term and what to do with a post that matches,
 * optionally scoped to one subscription. A rule scoped to a feed goes when the reader stops
 * following it, so following it again never revives a rule they can no longer see.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createModel } from "@sdxc/data-model";
import { TypeID } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v4";

import { rules } from "~/database/schema";

/** A reader's filter rules, listed in the order they were written. */
export const Rules = createModel(rules, {
	optional: ["id", "matches"],

	scopes: {
		/** The rules scoped to one subscription. */
		ofSubscription: (query, subscriptionId: string) => query.where({ feed_id: subscriptionId }),
	},

	methods: {
		/** Every rule, in the order the reader wrote them, which is the list they reason about. */
		inOrder() {
			return this.query().orderBy("created_at", "asc").orderBy("id", "asc").all();
		},
	},

	callbacks: {
		/** Mints the id the rule's page and its counters are addressed by. */
		async beforeCreate(values) {
			return { ...values, id: values.id ?? TypeID.fromUUID("rule", generateUUID()).toString() };
		},
	},
});

export default Rules;
