#!/usr/bin/env bun
/**
 * `mcp-bridge` binary entry: presents a stdio handshake-era MCP face to agents
 * and posts Streamable HTTP revision `2026-07-28` upstream through this package's
 * client. Stub so the package can declare the bin before the bridge lands.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

if (import.meta.main) {
	throw new Error(
		"mcp-bridge is not implemented yet. Use @sdxc/mcp/client for Streamable HTTP until the bridge ships.",
	);
}
