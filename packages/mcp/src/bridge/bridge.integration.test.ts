/**
 * Integration tests: agent-facing stdio session against an in-process `@sdxc/mcp` handler
 * via {@link handlerUpstream}, proving initialize shim + tools/resources translation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Readable, Writable } from "node:stream";

import * as s from "@sdxc/json-schema";
import { describe, expect, test } from "vitest";

import { createHandler } from "../handler.js";
import { resource, resources } from "../resources.js";
import { tool, tools } from "../tools.js";

import { handlerUpstream } from "./handler-upstream.js";
import { runBridge } from "./run.js";

/** Collects writes to a stream as a string. */
class MemoryWritable extends Writable {
	chunks: Buffer[] = [];

	override _write(
		chunk: Buffer,
		_encoding: BufferEncoding,
		callback: (error?: Error | null) => void,
	): void {
		this.chunks.push(Buffer.from(chunk));
		callback();
	}

	text(): string {
		return Buffer.concat(this.chunks).toString("utf8");
	}
}

/** Declares the tools and resources the fixture server exposes. */
let toolset = tools({
	echo: tool("echo", {
		description: "Echoes the message.",
		input: s.object({ message: s.string() }),
	}),
});

let resourceset = resources({
	note: resource("note://notes/:id", {
		name: "Note",
		description: "A note.",
		mimeType: "text/plain",
	}),
});

/** Builds a handler with one tool and one templated resource. */
function buildServer() {
	let mcp = createHandler({
		name: "fixture",
		version: "1.2.3",
		instructions: "Echo and read notes.",
	});
	mcp.tools.map(toolset.echo, (ctx) => ctx.input.message);
	mcp.resources.map(resourceset.note, {
		list: async () => [{ uri: "note://notes/1", name: "One" }],
		read: async (ctx) => `note-${ctx.variables.id}`,
	});
	return mcp;
}

/**
 * Drives the bridge with a scripted stdin and returns parsed stdout JSON-RPC messages.
 *
 * @param messages Agent-facing requests/notifications, in order.
 */
async function script(messages: unknown[]): Promise<unknown[]> {
	let mcp = buildServer();
	let upstream = handlerUpstream((request) => mcp.fetch(request));
	let stdin = Readable.from(messages.map((message) => `${JSON.stringify(message)}\n`));
	let stdout = new MemoryWritable();
	let stderr = new MemoryWritable();

	await runBridge(upstream, { stdin, stdout, stderr });

	return stdout
		.text()
		.split("\n")
		.filter((line) => line.length > 0)
		.map((line) => JSON.parse(line) as unknown);
}

describe("bridge against createHandler", () => {
	test("initialize, list tools, call a tool, and list resources", async () => {
		let responses = await script([
			{
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {
					protocolVersion: "2025-11-25",
					capabilities: {},
					clientInfo: { name: "test", version: "0" },
				},
			},
			{ jsonrpc: "2.0", method: "notifications/initialized" },
			{ jsonrpc: "2.0", id: 2, method: "tools/list" },
			{
				jsonrpc: "2.0",
				id: 3,
				method: "tools/call",
				params: { name: "echo", arguments: { message: "hi" } },
			},
			{ jsonrpc: "2.0", id: 4, method: "resources/list" },
			{
				jsonrpc: "2.0",
				id: 5,
				method: "resources/read",
				params: { uri: "note://notes/9" },
			},
		]);

		expect(responses).toHaveLength(5);

		expect(responses[0]).toMatchObject({
			id: 1,
			result: {
				protocolVersion: "2025-11-25",
				serverInfo: { name: "fixture", version: "1.2.3" },
				instructions: "Echo and read notes.",
			},
		});
		expect(responses[0]).not.toHaveProperty("result.resultType");
		expect(responses[0]).not.toHaveProperty("result._meta");

		expect(responses[1]).toMatchObject({
			id: 2,
			result: { tools: [{ name: "echo" }] },
		});
		expect(responses[1]).not.toHaveProperty("result.ttlMs");
		expect(responses[1]).not.toHaveProperty("result._meta");

		expect(responses[2]).toMatchObject({
			id: 3,
			result: {
				content: [{ type: "text", text: "hi" }],
			},
		});
		expect(responses[2]).not.toHaveProperty("result.resultType");

		expect(responses[3]).toMatchObject({
			id: 4,
			result: { resources: [{ uri: "note://notes/1", name: "One" }] },
		});

		expect(responses[4]).toMatchObject({
			id: 5,
			result: {
				contents: [{ uri: "note://notes/9", text: "note-9" }],
			},
		});
	});
});
