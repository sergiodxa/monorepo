/**
 * CLI entry for `mcp-bridge`: parse argv, open an upstream client, and run the stdio loop.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Readable, Writable } from "node:stream";

import { connect as defaultConnect } from "../client.js";

import type { BridgeIo } from "./run.js";
import type { UpstreamClient } from "./upstream.js";

import { writeLog } from "./framing.js";
import { isBridgeArgvError, parseBridgeArgv } from "./parse-argv.js";
import { runBridge } from "./run.js";

/** Options for connecting to a remote MCP endpoint (matches `@sdxc/mcp/client` `connect`). */
export interface BridgeConnectOptions {
	url: string;
	client: { name: string; version: string };
	headers?: Record<string, string>;
}

/** Factory the bin supplies from `@sdxc/mcp/client`; tests inject a double. */
export type BridgeConnect = (options: BridgeConnectOptions) => UpstreamClient;

/** Process streams and the connect factory the CLI needs. */
export interface BridgeCliOptions {
	/** Builds the upstream session; defaults to `connect` from `@sdxc/mcp/client`. */
	connect?: BridgeConnect;
	stdin?: Readable;
	stdout?: Writable;
	stderr?: Writable;
}

/** Client identity the bridge advertises on every upstream request. */
const BRIDGE_CLIENT_INFO = { name: "mcp-bridge", version: "0.0.1" } as const;

/**
 * Runs the bridge CLI. Exit codes: 0 clean stdin EOF, 1 runtime failure, 2 usage.
 *
 * @param argv Arguments after the program name (`process.argv.slice(2)`).
 * @param options Streams and an optional `connect` override for tests.
 */
export async function runBridgeCli(
	argv: readonly string[],
	options: BridgeCliOptions = {},
): Promise<number> {
	let stderr = options.stderr ?? process.stderr;
	let parsed = parseBridgeArgv(argv);

	if (isBridgeArgvError(parsed)) {
		writeLog(stderr, parsed.message.trimEnd());
		return parsed.showHelp === true ? 0 : 2;
	}

	let connect = options.connect ?? defaultConnect;
	let upstream = connect({
		url: parsed.url,
		client: BRIDGE_CLIENT_INFO,
		headers: parsed.headers,
	});

	let io: BridgeIo = {
		stdin: options.stdin ?? process.stdin,
		stdout: options.stdout ?? process.stdout,
		stderr,
	};

	try {
		await runBridge(upstream, io);
		return 0;
	} catch (error) {
		writeLog(stderr, "mcp-bridge:", error);
		upstream.close();
		return 1;
	}
}
