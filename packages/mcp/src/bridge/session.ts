/**
 * In-process agent session: answers `initialize` / `notifications/initialized` locally and
 * translates tools/resources RPCs through an {@link UpstreamClient}.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure } from "@sdxc/result";

import type { JsonRpcFailure, JsonRpcMessage, JsonRpcResponse, RequestId } from "../jsonrpc.js";

import { ErrorCode, isJsonRpcMessage, isRequest, JSONRPC_VERSION, replyError } from "../jsonrpc.js";

import type { UpstreamClient } from "./upstream.js";

import { buildInitializeResult, stripModernResultFields } from "./translate.js";
import { UpstreamError } from "./upstream.js";

/** Alias kept for call sites that import the error class from this module historically. */
type SessionUpstreamError = InstanceType<typeof UpstreamError>;

/** Outcome of handling one inbound stdio message. */
export type SessionOutcome = { kind: "response"; response: JsonRpcResponse } | { kind: "silent" };

/** Mutable state for one agent ↔ bridge process lifetime. */
export interface BridgeSession {
	/** Whether the agent has completed the handshake (`notifications/initialized`). */
	initialized: boolean;
	/** Cached discover payload used to answer (or re-answer) `initialize`. */
	discover:
		| {
				capabilities?: Record<string, unknown>;
				serverInfo?: { name: string; version: string; title?: string };
				instructions?: string;
		  }
		| undefined;
}

/**
 * Creates the in-process session illusion. Upstream never sees `initialize` or a session id.
 *
 * @returns Fresh session state for one stdio process.
 */
export function createBridgeSession(): BridgeSession {
	return { initialized: false, discover: undefined };
}

/**
 * Dispatches one parsed agent message.
 *
 * @param session Process-lifetime state.
 * @param upstream Client speaking `2026-07-28` Streamable HTTP.
 * @param raw Value parsed from one stdin line.
 */
export async function handleAgentMessage(
	session: BridgeSession,
	upstream: UpstreamClient,
	raw: unknown,
): Promise<SessionOutcome> {
	if (!isJsonRpcMessage(raw)) {
		return {
			kind: "response",
			response: replyError(null, ErrorCode.InvalidRequest, "Invalid JSON-RPC message"),
		};
	}

	let message = raw;

	if (message.method === "notifications/initialized") {
		session.initialized = true;
		return { kind: "silent" };
	}

	if (message.method === "initialize") {
		return handleInitialize(session, upstream, message);
	}

	if (!isRequest(message)) {
		return { kind: "silent" };
	}

	switch (message.method) {
		case "ping": {
			return { kind: "response", response: agentReply(message.id, {}) };
		}
		case "tools/list": {
			return forwardResult(message.id, await upstream.list());
		}
		case "tools/call": {
			return handleToolsCall(upstream, message);
		}
		case "resources/list": {
			return forwardResult(message.id, await upstream.resources());
		}
		case "resources/templates/list": {
			return forwardResult(message.id, await upstream.templates());
		}
		case "resources/read": {
			return handleResourcesRead(upstream, message);
		}
		case "prompts/list": {
			return { kind: "response", response: agentReply(message.id, { prompts: [] }) };
		}
		default: {
			return {
				kind: "response",
				response: replyError(
					message.id,
					ErrorCode.MethodNotFound,
					`Method not supported by mcp-bridge: ${message.method}`,
				),
			};
		}
	}
}

/**
 * Answers `initialize` locally after optionally refreshing upstream discover data.
 *
 * @param session Process-lifetime state.
 * @param upstream Client used only for `discover`.
 * @param message The agent's initialize request.
 */
async function handleInitialize(
	session: BridgeSession,
	upstream: UpstreamClient,
	message: JsonRpcMessage,
): Promise<SessionOutcome> {
	if (!isRequest(message)) return { kind: "silent" };

	let discovered = await upstream.discover();
	if (!isFailure(discovered)) {
		session.discover = {
			capabilities: discovered.data.capabilities,
			serverInfo: discovered.data.serverInfo,
			instructions: discovered.data.instructions,
		};
	}

	let params = message.params ?? {};
	let requested = typeof params.protocolVersion === "string" ? params.protocolVersion : undefined;

	return {
		kind: "response",
		response: agentReply(message.id, buildInitializeResult(session.discover, requested)),
	};
}

/**
 * Forwards a Result, stripping modern-only fields on success.
 *
 * @param id Agent request id.
 * @param outcome Upstream Result.
 */
function forwardResult(
	id: RequestId,
	outcome: Result<Record<string, unknown>, SessionUpstreamError>,
): SessionOutcome {
	if (isFailure(outcome)) {
		return { kind: "response", response: upstreamFailure(id, outcome.error) };
	}
	return {
		kind: "response",
		response: agentReply(id, stripModernResultFields(outcome.data)),
	};
}

/**
 * Forwards `tools/call`, requiring a string `params.name`.
 *
 * @param upstream Client for the call.
 * @param message Agent request.
 */
async function handleToolsCall(
	upstream: UpstreamClient,
	message: JsonRpcMessage & { id: RequestId },
): Promise<SessionOutcome> {
	let name = message.params?.name;
	if (typeof name !== "string" || name.length === 0) {
		return {
			kind: "response",
			response: replyError(message.id, ErrorCode.InvalidParams, "tools/call requires params.name"),
		};
	}
	let args = message.params?.arguments;
	let argumentRecord =
		typeof args === "object" && args !== null && !Array.isArray(args)
			? (args as Record<string, unknown>)
			: undefined;
	return forwardResult(message.id, await upstream.call(name, argumentRecord));
}

/**
 * Forwards `resources/read`, requiring a string `params.uri`.
 *
 * @param upstream Client for the read.
 * @param message Agent request.
 */
async function handleResourcesRead(
	upstream: UpstreamClient,
	message: JsonRpcMessage & { id: RequestId },
): Promise<SessionOutcome> {
	let uri = message.params?.uri;
	if (typeof uri !== "string" || uri.length === 0) {
		return {
			kind: "response",
			response: replyError(
				message.id,
				ErrorCode.InvalidParams,
				"resources/read requires params.uri",
			),
		};
	}
	return forwardResult(message.id, await upstream.read(uri));
}

/**
 * Builds a success response without modern-only `resultType`, which handshake agents omit.
 *
 * @param id Agent request id.
 * @param result Agent-facing result object.
 */
function agentReply(id: RequestId, result: Record<string, unknown>): JsonRpcResponse {
	return {
		jsonrpc: JSONRPC_VERSION,
		id,
		result: result as { resultType: string; [key: string]: unknown },
	};
}

/**
 * Maps an upstream failure onto a JSON-RPC error response.
 *
 * @param id Agent request id.
 * @param error Upstream error.
 */
function upstreamFailure(id: RequestId, error: SessionUpstreamError): JsonRpcFailure {
	let code = typeof error.code === "number" ? error.code : ErrorCode.InternalError;
	return replyError(id, code as typeof ErrorCode.InternalError, error.message, error.data);
}
