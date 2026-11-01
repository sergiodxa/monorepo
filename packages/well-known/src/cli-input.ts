/**
 * Where `sdxc-well-known` reads a document from: a file, stdin, or an origin over HTTP. Every
 * command shares it, so an unreadable file and an unreachable origin both exit 2 with the same
 * kind of message, while a server's error status stays a finding the command reports.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { ChainContext, ExitError, UsageError } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { exit, usage } from "@sdxc/cli";
import { success } from "@sdxc/result";

import { WellKnownParseError } from "./parse-error.js";

/** How long one request may take before the command gives up on the origin. */
const FETCH_TIMEOUT_MS = 10_000;

/** A document as read, with `from` naming it in reports and `status` set when it was fetched. */
export interface Retrieved {
	from: string;
	text: string;
	/** The HTTP status for a fetched document, `null` for a file or stdin. */
	status: number | null;
}

/** The run's directory, stdin and abort signal, which every read needs. */
export type InputContext = Pick<ChainContext, "cwd" | "stdin" | "signal">;

/**
 * Whether text names a web origin rather than a file.
 *
 * @param text - An argument as typed
 */
export function isWebUrl(text: string): boolean {
	return /^https?:\/\//i.test(text);
}

/**
 * An `http(s)` URL from an argument, or a usage error naming what was expected.
 *
 * @param text - The argument as typed
 */
export function readWebUrl(text: string): Result<URL, UsageError> {
	if (isWebUrl(text) && URL.canParse(text)) return success(new URL(text));
	return usage(`Expected an http(s) URL such as https://example.com; got ${JSON.stringify(text)}`);
}

/**
 * Reads `file` against the run's directory, or stdin for `-`. A terminal on stdin is a usage
 * error, so a command run with no input answers at once with its help.
 *
 * @param file - The path as typed, or `-`
 * @param ctx - The running command
 */
export async function readLocal(
	file: string,
	ctx: InputContext,
): Promise<Result<Retrieved, ExitError | UsageError>> {
	if (file === "-") {
		if (ctx.stdin.isTTY) return usage("Pass an origin or a file, or pipe one on stdin");
		return success({ from: "<stdin>", text: await ctx.stdin.text(), status: null });
	}
	try {
		let text = await readFile(resolve(ctx.cwd, file), "utf8");
		return success({ from: file, text, status: null });
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return exit(2, `Cannot read ${file}: ${reason}`);
	}
}

/**
 * GETs `url`, following redirects, within a fixed deadline. Any answer the server gives is a
 * success carrying its status; only a request that gets no answer exits 2.
 *
 * @param url - The document's URL
 * @param accept - The media types the request asks for
 * @param ctx - The running command, whose signal cancels the request
 */
export async function fetchDocument(
	url: URL,
	accept: string,
	ctx: InputContext,
): Promise<Result<Retrieved, ExitError>> {
	try {
		let response = await fetch(url, {
			headers: { Accept: accept },
			redirect: "follow",
			signal: AbortSignal.any([ctx.signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)]),
		});
		return success({ from: url.href, text: await response.text(), status: response.status });
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return exit(2, `Cannot fetch ${url.href}: ${reason}`);
	}
}

/**
 * The issue a non-2xx answer becomes, so a missing document is reported like a malformed one.
 *
 * @param retrieved - A document as read
 * @returns The issue, or `null` for a file, stdin or a 2xx answer
 */
export function statusIssue(retrieved: Retrieved): WellKnownParseError.Issue | null {
	if (retrieved.status === null || (retrieved.status >= 200 && retrieved.status < 300)) {
		return null;
	}
	return { at: 0, message: `The server answered HTTP ${retrieved.status}.` };
}
