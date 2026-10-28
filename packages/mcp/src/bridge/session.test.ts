/**
 * Unit tests for the agent-facing session: local initialize shim, notification swallow, and
 * method translation with modern-only fields stripped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { failure, success } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { UpstreamClient } from "./upstream.js";

import { createBridgeSession, handleAgentMessage } from "./session.js";
import { UpstreamError } from "./upstream.js";

/** Builds a controllable upstream double for one test. */
function fakeUpstream(overrides: Partial<UpstreamClient> = {}): UpstreamClient {
	return {
		discover: async () =>
			success({
				capabilities: { tools: {} },
				serverInfo: { name: "demo", version: "1.0.0" },
			}),
		list: async () =>
			success({
				resultType: "complete",
				tools: [{ name: "ping" }],
				ttlMs: 60_000,
				_meta: { x: 1 },
			}),
		call: async () =>
			success({
				resultType: "complete",
				content: [{ type: "text", text: "pong" }],
				_meta: { x: 1 },
			}),
		resources: async () => success({ resultType: "complete", resources: [], _meta: {} }),
		templates: async () => success({ resultType: "complete", resourceTemplates: [], _meta: {} }),
		read: async () =>
			success({
				resultType: "complete",
				contents: [{ uri: "note://a", text: "hi" }],
				_meta: {},
			}),
		close() {},
		...overrides,
	};
}

describe("handleAgentMessage", () => {
	test("answers initialize locally without forwarding a handshake upstream", async () => {
		let calls: string[] = [];
		let upstream = fakeUpstream({
			async discover() {
				calls.push("discover");
				return success({
					capabilities: { tools: {}, resources: {} },
					serverInfo: { name: "demo", version: "1.0.0" },
				});
			},
			async list() {
				calls.push("list");
				return success({ tools: [] });
			},
		});

		let session = createBridgeSession();
		let outcome = await handleAgentMessage(session, upstream, {
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2025-11-25",
				capabilities: {},
				clientInfo: { name: "cursor", version: "1" },
			},
		});

		expect(calls).toEqual(["discover"]);
		expect(outcome.kind).toBe("response");
		if (outcome.kind !== "response") return;
		expect(outcome.response).toMatchObject({
			id: 1,
			result: {
				protocolVersion: "2025-11-25",
				serverInfo: { name: "demo", version: "1.0.0" },
			},
		});
		expect(outcome.response).not.toHaveProperty("result.resultType");
		expect(outcome.response).not.toHaveProperty("result._meta");
	});

	test("swallows notifications/initialized and marks the session ready", async () => {
		let session = createBridgeSession();
		let outcome = await handleAgentMessage(session, fakeUpstream(), {
			jsonrpc: "2.0",
			method: "notifications/initialized",
		});
		expect(outcome).toEqual({ kind: "silent" });
		expect(session.initialized).toBe(true);
	});

	test("strips modern-only fields from tools/list", async () => {
		let session = createBridgeSession();
		let outcome = await handleAgentMessage(session, fakeUpstream(), {
			jsonrpc: "2.0",
			id: 2,
			method: "tools/list",
		});
		expect(outcome.kind).toBe("response");
		if (outcome.kind !== "response" || !("result" in outcome.response)) return;
		expect(outcome.response.result).toEqual({ tools: [{ name: "ping" }] });
	});

	test("maps upstream failures to JSON-RPC errors", async () => {
		let session = createBridgeSession();
		let outcome = await handleAgentMessage(
			session,
			fakeUpstream({
				list: async () => failure(new UpstreamError("boom", { code: -32_000 })),
			}),
			{ jsonrpc: "2.0", id: 3, method: "tools/list" },
		);
		expect(outcome.kind).toBe("response");
		if (outcome.kind !== "response") return;
		expect(outcome.response).toMatchObject({
			id: 3,
			error: { code: -32_000, message: "boom" },
		});
	});

	test("requires tools/call params.name", async () => {
		let session = createBridgeSession();
		let outcome = await handleAgentMessage(session, fakeUpstream(), {
			jsonrpc: "2.0",
			id: 4,
			method: "tools/call",
			params: {},
		});
		expect(outcome.kind).toBe("response");
		if (outcome.kind !== "response") return;
		expect(outcome.response).toMatchObject({
			error: { code: -32_602 },
		});
	});
});
