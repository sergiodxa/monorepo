/**
 * Constants and shapes for the agent-facing half of the bridge: handshake-era MCP over
 * stdio at revision `2025-11-25`, the newest Cursor documents supporting for remote clients.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Protocol revision the bridge advertises on stdio toward the agent. */
export const AGENT_PROTOCOL_VERSION = "2025-11-25";

/** Default identity when upstream `discover` has not returned `serverInfo` yet. */
export const DEFAULT_BRIDGE_SERVER_INFO = {
	name: "mcp-bridge",
	version: "0.0.1",
} as const;

/**
 * Capabilities the bridge always advertises on `initialize` when discover has not run, so
 * a slow or failing upstream still lets the agent proceed to list/call.
 */
export const DEFAULT_BRIDGE_CAPABILITIES: Record<string, unknown> = {
	tools: {},
	resources: {},
};
