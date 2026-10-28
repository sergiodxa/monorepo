/**
 * Answers `create_api_key`: creates an API key; plaintext returned once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp/server";
import { unwrap } from "@sdxc/result";

import { forAbility } from "~/app/mcp/ability";
import { serializeApiKey } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import { MAX_API_KEYS_PER_TEAM } from "~/app/models/api-keys";
import abilities from "~/app/policies/abilities";

/** Creates an API key whose scopes are a subset of the calling key's. */
export default createTool(toolset.createApiKey, {
	...forAbility(abilities.apiKeys.write),
	handler: async (ctx) => {
		let existingCount = await ctx.models.apiKeys.inTeam(ctx.apiTeam.id).count();
		if (existingCount >= MAX_API_KEYS_PER_TEAM) {
			throw new ToolError("API key limit reached for this team");
		}

		let held = new Set<string>(ctx.apiKey.scopes);
		let ungranted = ctx.input.scopes.filter((scope) => !held.has(scope));
		if (ungranted.length > 0) {
			throw new ToolError(`API key cannot grant scopes it does not hold: ${ungranted.join(", ")}`);
		}

		let { record, key } = unwrap(
			await ctx.models.apiKeys.issue(ctx.apiTeam.id, {
				name: ctx.input.name,
				scopes: ctx.input.scopes,
				expires_at: ctx.input.expiresAt ?? null,
			}),
		);
		return { apiKey: serializeApiKey(record), key };
	},
});
