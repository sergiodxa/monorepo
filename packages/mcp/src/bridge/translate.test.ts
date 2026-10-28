/**
 * Unit tests for agent-facing result rewriting: modern-only field stripping and the local
 * `initialize` capability reply.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { AGENT_PROTOCOL_VERSION } from "./agent-protocol.js";
import { buildInitializeResult, stripModernResultFields } from "./translate.js";

describe("stripModernResultFields", () => {
	test("removes _meta, resultType, and list-cache fields", () => {
		expect(
			stripModernResultFields({
				resultType: "complete",
				tools: [{ name: "search" }],
				ttlMs: 60_000,
				cacheScope: "public",
				supportedVersions: ["2026-07-28"],
				_meta: { "io.modelcontextprotocol/serverInfo": { name: "x", version: "1" } },
			}),
		).toEqual({ tools: [{ name: "search" }] });
	});

	test("leaves handshake-era fields untouched", () => {
		expect(
			stripModernResultFields({
				content: [{ type: "text", text: "ok" }],
				isError: false,
			}),
		).toEqual({
			content: [{ type: "text", text: "ok" }],
			isError: false,
		});
	});
});

describe("buildInitializeResult", () => {
	test("echoes a known handshake revision the agent requested", () => {
		let result = buildInitializeResult(
			{
				capabilities: { tools: { listChanged: false } },
				serverInfo: { name: "uptime", version: "2.0.0" },
				instructions: "List monitors.",
			},
			"2025-11-25",
		);

		expect(result).toEqual({
			protocolVersion: "2025-11-25",
			capabilities: { tools: { listChanged: false } },
			serverInfo: { name: "uptime", version: "2.0.0" },
			instructions: "List monitors.",
		});
	});

	test("falls back to the bridge default revision and identity", () => {
		let result = buildInitializeResult(undefined, "2099-01-01");
		expect(result.protocolVersion).toBe(AGENT_PROTOCOL_VERSION);
		expect(result.serverInfo).toEqual({ name: "mcp-bridge", version: "0.0.1" });
		expect(result.capabilities).toEqual({ tools: {}, resources: {} });
	});
});
