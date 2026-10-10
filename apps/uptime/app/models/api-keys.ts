/**
 * API keys: a team's credentials for the public API. Only the key's hash is stored, so issuing
 * one hands back the plaintext exactly once, and a request authenticates by looking its hash
 * up with `findBy({ key_hash })`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { isFailure, success } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v4";

import type { ApiKeyScope } from "~/database/schema";

import { generateApiKey } from "~/app/services/api-key";
import { apiKeys } from "~/database/schema";

/** Maximum number of API keys a team may have at once. */
export const MAX_API_KEYS_PER_TEAM = 10;

/** What a team names and allows when it issues a key; the secret itself is generated. */
export interface ApiKeyInput {
	name: string;
	scopes: ApiKeyScope[];
	expires_at: number | null;
}

export const ApiKeys = createModel(apiKeys, {
	optional: ["id"],

	scopes: {
		inTeam: (query, teamId: string) => query.where({ team_id: teamId }),
	},

	methods: {
		/**
		 * Generates and stores a new key for a team. The answer carries the plaintext `key`
		 * beside the stored `record`, and this is the only time it exists: the table keeps its
		 * hash and display prefix.
		 */
		async issue(teamId: string, input: ApiKeyInput) {
			let generated = await generateApiKey();

			let record = await this.create({
				team_id: teamId,
				name: input.name,
				scopes: input.scopes,
				expires_at: input.expires_at,
				key_hash: generated.keyHash,
				key_prefix: generated.keyPrefix,
				last_used_at: null,
			});
			if (isFailure(record)) return record;

			return success({ record: record.data, key: generated.key });
		},

		/** Records that a key was just used, which the keys page shows beside each one. */
		async markUsed(apiKeyId: string): Promise<void> {
			await this.query().where({ id: apiKeyId }).update({ last_used_at: Date.now() });
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return { ...values, id: values.id ?? generateUUID() };
		},
	},
});

/** An API key's stored row, as reads return it. */
export type ApiKey = ModelRow<typeof ApiKeys>;

export default ApiKeys;
