/**
 * Shared MCP tool body: runs a catalog operation from the tool's validated input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ToolError } from "@sdxc/mcp";
import { isFailure } from "@sdxc/result";

import { runOperation } from "~/app/services/run";

/**
 * Executes `id` with `input` and returns the result for MCP, or a {@link ToolError}.
 *
 * @param id - Catalog operation id
 * @param input - Tool arguments
 */
export async function runPaidTool(id: string, input: unknown): Promise<unknown> {
	let result = await runOperation(id, input);
	if (isFailure(result)) throw new ToolError(result.error.message);
	return result.data;
}
