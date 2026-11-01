/**
 * The `sdxc-openapi check` handler: reads a document from a file, a URL or stdin and runs
 * `parse` over it, reporting each finding at its JSON Pointer. Exits 1 on any finding, so a
 * CI step or an agent can gate on a published contract.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { ExitError, Stdin } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure, wrap } from "@sdxc/result";

import { OPENAPI_COMMANDS } from "./cli-contract.js";
import {
	MEDIA_TYPE_JSON,
	MEDIA_TYPE_OPENAPI_JSON,
	MEDIA_TYPE_OPENAPI_YAML,
	MEDIA_TYPE_YAML,
	parse,
} from "./serialize.js";

/** The exit code for a document that was read and found invalid. */
const PROBLEMS_FOUND = 1;

/** The exit code for input that could not be read. */
const UNREADABLE = 2;

/** The `Accept` a URL is fetched with: the OpenAPI media types first, plain JSON and YAML after. */
const ACCEPT = [
	MEDIA_TYPE_OPENAPI_JSON,
	`${MEDIA_TYPE_OPENAPI_YAML};q=0.9`,
	`${MEDIA_TYPE_JSON};q=0.8`,
	`${MEDIA_TYPE_YAML};q=0.7`,
].join(", ");

/**
 * The document's text: the body of an `http:` or `https:` URL, the file at a path resolved
 * against the run's directory, or stdin when the argument is `-` or absent. A terminal on
 * stdin, a missing file, a network error or a non-2xx answer is an exit-2 failure.
 *
 * @param ctx - The run's directory, stdin and abort signal
 * @param source - The argument as typed
 */
async function readDocument(
	ctx: { cwd: string; stdin: Stdin; signal: AbortSignal },
	source: string | undefined,
): Promise<Result<string, ExitError>> {
	if (source === undefined || source === "-") {
		if (ctx.stdin.isTTY)
			return exit(UNREADABLE, "No input: pass a file or URL, or pipe one on stdin");
		return success(await ctx.stdin.text());
	}
	if (/^https?:\/\//i.test(source)) {
		let response = await wrap(() =>
			fetch(source, { headers: { accept: ACCEPT }, signal: ctx.signal }),
		);
		if (isFailure(response))
			return exit(UNREADABLE, `Cannot fetch ${source}: ${response.error.message}`);
		if (!response.data.ok)
			return exit(UNREADABLE, `Cannot fetch ${source}: HTTP ${response.data.status}`);
		return success(await response.data.text());
	}
	let read = await wrap(() => readFile(resolve(ctx.cwd, source), "utf8"));
	if (isFailure(read)) return exit(UNREADABLE, `Cannot read ${source}: ${read.error.message}`);
	return success(read.data);
}

/**
 * Reports a valid document with its version, title and API version, or lists each finding as
 * `pointer: message` (`(root)` for the whole document, as for text that is not JSON or YAML);
 * `--json` prints `{ valid, openapi, title, version, findings }`, with nulls when invalid.
 */
export default createCommand(OPENAPI_COMMANDS.check, async (ctx) => {
	let text = await readDocument(ctx, ctx.arguments.document);
	if (isFailure(text)) return text;
	let parsed = parse(text.data);

	if (isFailure(parsed)) {
		let { pointer, message } = parsed.error;
		if (ctx.flags.json) {
			let report = {
				valid: false,
				openapi: null,
				title: null,
				version: null,
				findings: [{ pointer, message }],
			};
			ctx.stdout(`${JSON.stringify(report, null, 2)}\n`);
		} else {
			ctx.stdout(`${pointer === "" ? "(root)" : pointer}: ${message}\n`);
		}
		return exit(PROBLEMS_FOUND);
	}

	let { openapi, info } = parsed.data;
	if (ctx.flags.json) {
		let report = { valid: true, openapi, title: info.title, version: info.version, findings: [] };
		ctx.stdout(`${JSON.stringify(report, null, 2)}\n`);
	} else {
		ctx.stdout(`Valid OpenAPI ${openapi} document: ${info.title} ${info.version}\n`);
	}
	return success();
});
