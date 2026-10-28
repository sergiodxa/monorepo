/**
 * Rewrites modern `2026-07-28` result objects into shapes handshake-era agents accept:
 * strip wire `_meta`, `resultType`, and list-cache fields the agent dialect never defined.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	AGENT_PROTOCOL_VERSION,
	DEFAULT_BRIDGE_CAPABILITIES,
	DEFAULT_BRIDGE_SERVER_INFO,
} from "./agent-protocol.js";

/** Result keys that exist only on the `2026-07-28` wire and must not reach the agent. */
const MODERN_ONLY_RESULT_KEYS = new Set([
	"_meta",
	"resultType",
	"ttlMs",
	"cacheScope",
	"supportedVersions",
]);

/** Handshake revisions Cursor documents; anything else falls back to {@link AGENT_PROTOCOL_VERSION}. */
const HANDSHAKE_REVISIONS = new Set(["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"]);

/**
 * Removes modern-only fields from an upstream result before it is written to stdio.
 *
 * @param result A successful RPC result from `@sdxc/mcp/client` (or an equivalent double).
 * @returns A shallow copy without fields handshake-era agents reject or ignore incorrectly.
 */
export function stripModernResultFields(result: Record<string, unknown>): Record<string, unknown> {
	let cleaned: Record<string, unknown> = {};
	for (let [key, value] of Object.entries(result)) {
		if (MODERN_ONLY_RESULT_KEYS.has(key)) continue;
		cleaned[key] = value;
	}
	return cleaned;
}

/**
 * Builds the agent-facing `initialize` result from an upstream discover payload.
 *
 * Echoes the agent's requested handshake revision when it is known, otherwise
 * {@link AGENT_PROTOCOL_VERSION}, so the stdio client believes it negotiated a session while
 * the remote continues to speak only `2026-07-28`.
 *
 * @param discover Upstream discover fields, or `undefined` when discover failed.
 * @param requestedVersion The `protocolVersion` the agent sent in `initialize.params`.
 */
export function buildInitializeResult(
	discover:
		| {
				capabilities?: Record<string, unknown>;
				serverInfo?: { name: string; version: string; title?: string };
				instructions?: string;
		  }
		| undefined,
	requestedVersion: string | undefined,
): Record<string, unknown> {
	let protocolVersion =
		requestedVersion && HANDSHAKE_REVISIONS.has(requestedVersion)
			? requestedVersion
			: AGENT_PROTOCOL_VERSION;

	let result: Record<string, unknown> = {
		protocolVersion,
		capabilities: discover?.capabilities ?? DEFAULT_BRIDGE_CAPABILITIES,
		serverInfo: discover?.serverInfo ?? DEFAULT_BRIDGE_SERVER_INFO,
	};
	if (discover?.instructions !== undefined) {
		result.instructions = discover.instructions;
	}
	return result;
}
