/**
 * The stdio event loop: read agent JSON-RPC lines, dispatch through the session, write
 * responses to stdout, and keep diagnostics on stderr.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UpstreamClient } from "./upstream.js";

import { readJsonLines, writeJsonLine, writeLog } from "./framing.js";
import { createBridgeSession, handleAgentMessage } from "./session.js";

import type { Readable, Writable } from "node:stream";

/** Streams the bridge uses; defaults match a Node/Bun process. */
export interface BridgeIo {
	/** Agent → bridge (stdin). */
	stdin: Readable;
	/** Bridge → agent (stdout); MCP frames only. */
	stdout: Writable;
	/** Diagnostics (stderr). */
	stderr: Writable;
}

/**
 * Runs the bridge until stdin closes. Closes the upstream client on exit.
 *
 * @param upstream Client speaking `2026-07-28` Streamable HTTP.
 * @param io Process streams, or test doubles.
 */
export async function runBridge(upstream: UpstreamClient, io: BridgeIo): Promise<void> {
	let session = createBridgeSession();

	try {
		for await (let raw of readJsonLines(io.stdin)) {
			try {
				let outcome = await handleAgentMessage(session, upstream, raw);
				if (outcome.kind === "response") {
					writeJsonLine(io.stdout, outcome.response);
				}
			} catch (error) {
				writeLog(io.stderr, "mcp-bridge:", error);
				let id =
					typeof raw === "object" &&
					raw !== null &&
					"id" in raw &&
					(typeof (raw as { id: unknown }).id === "string" ||
						typeof (raw as { id: unknown }).id === "number")
						? (raw as { id: string | number }).id
						: null;
				writeJsonLine(io.stdout, {
					jsonrpc: "2.0",
					id,
					error: {
						code: -32_603,
						message: error instanceof Error ? error.message : "Internal bridge error",
					},
				});
			}
		}
	} finally {
		upstream.close();
	}
}
