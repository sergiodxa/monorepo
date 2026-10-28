#!/usr/bin/env bun
/**
 * Programmatic surface and `mcp-bridge` bin entry: agent-facing handshake-era stdio with a
 * modern Streamable HTTP upstream. Exports support tests and embedding; as the bin, runs the loop.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { runBridgeCli } from "./cli.js";

export { AGENT_PROTOCOL_VERSION } from "./agent-protocol.js";
export { runBridgeCli } from "./cli.js";
export type { BridgeCliOptions, BridgeConnect, BridgeConnectOptions } from "./cli.js";
export { readJsonLines, writeJsonLine, writeLog } from "./framing.js";
export { handlerUpstream } from "./handler-upstream.js";
export { BRIDGE_USAGE, isBridgeArgvError, parseBridgeArgv } from "./parse-argv.js";
export type { BridgeArgv, BridgeArgvError } from "./parse-argv.js";
export { runBridge } from "./run.js";
export type { BridgeIo } from "./run.js";
export { createBridgeSession, handleAgentMessage } from "./session.js";
export type { BridgeSession, SessionOutcome } from "./session.js";
export { buildInitializeResult, stripModernResultFields } from "./translate.js";
export { UpstreamError } from "./upstream.js";
export type {
	CallToolResult,
	DiscoverResult,
	ReadResourceResult,
	ResourcesListResult,
	TemplatesListResult,
	ToolsListResult,
	UpstreamClient,
} from "./upstream.js";

if (import.meta.main) {
	process.exitCode = await runBridgeCli(process.argv.slice(2));
}
