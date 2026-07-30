/**
 * Data-access model for API keys: creation (returning the plaintext key exactly
 * once), team-scoped listing/lookup for the UI, and the hash-based lookup Phase 8's
 * `requireApiKey` middleware will use to authenticate requests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { generateUUID } from "@pkg/uuid";

import type { ApiKeyScope } from "~/database/schema";

import { generateApiKey } from "~/app/services/api-key";
import { apiKeys } from "~/database/schema";

/** Maximum number of API keys a team may have at once. */
export const MAX_API_KEYS_PER_TEAM = 10;

export default class ApiKey {
	/** Generates and stores a new API key for a team, returning the plaintext key once. */
	static async create(
		db: Database,
		teamId: string,
		input: { name: string; scopes: ApiKeyScope[]; expires_at: number | null },
	) {
		let generated = await generateApiKey();

		let record = await db.create(
			apiKeys,
			{
				id: generateUUID(),
				team_id: teamId,
				name: input.name,
				scopes: input.scopes,
				expires_at: input.expires_at,
				key_hash: generated.keyHash,
				key_prefix: generated.keyPrefix,
				last_used_at: null,
			},
			{ touch: true, returnRow: true },
		);

		return { record, key: generated.key };
	}

	/** Lists every API key for a team, most recently created first. */
	static async listByTeam(db: Database, teamId: string) {
		return await db.findMany(apiKeys, {
			where: { team_id: teamId },
			orderBy: ["created_at", "desc"],
		});
	}

	/** Finds an API key scoped to a team, or `null` when it doesn't belong to it. */
	static async findByIdForTeam(db: Database, teamId: string, apiKeyId: string) {
		return await db.findOne(apiKeys, { where: { id: apiKeyId, team_id: teamId } });
	}

	/** Finds an API key by its stored hash, for request authentication. */
	static async findByHash(db: Database, keyHash: string) {
		return await db.findOne(apiKeys, { where: { key_hash: keyHash } });
	}

	/** Counts how many API keys a team currently has. */
	static async countByTeam(db: Database, teamId: string) {
		return await db.count(apiKeys, { where: { team_id: teamId } });
	}

	/** Records that an API key was just used. */
	static async touchLastUsedAt(db: Database, apiKeyId: string) {
		await db.update(apiKeys, apiKeyId, { last_used_at: Date.now() }, { touch: true });
	}

	/** Deletes an API key. */
	static async deleteById(db: Database, apiKeyId: string) {
		await db.delete(apiKeys, apiKeyId);
	}
}
