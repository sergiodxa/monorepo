/**
 * The tokens a reader minted for agents. A row holds the id and a digest of the signed value
 * the Worker minted, never the value itself, and stays after a revocation so the reader can
 * still see what they revoked and when.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createModel } from "@sdxc/data-model";
import { isNull } from "remix/data-table";

import { tokens } from "~/database/schema";

/** The rows describing a reader's agent tokens; a revoked one stays listed. */
export const AgentTokens = createModel(tokens, {
	scopes: {
		/** Tokens the reader has not revoked, which is what the cap counts. */
		live: (query) => query.where(isNull("revoked_at")),
	},

	methods: {
		/** Every token, newest first, which is the order the settings list draws them in. */
		newestFirst() {
			return this.query().orderBy("created_at", "desc").orderBy("id", "desc").all();
		},
	},
});

export default AgentTokens;
