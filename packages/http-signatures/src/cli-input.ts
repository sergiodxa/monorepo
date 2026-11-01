/**
 * Input both `sdxc-http-signatures` commands share: a file or stdin read whole, a key from a
 * file or an environment variable, `name:value` headers, a component list and a raw HTTP/1.1
 * request. Input that cannot be read or parsed answers an exit-2 failure naming its source.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Env, ExitError, Stdin } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { EXIT_CODES, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import type { Component } from "./types.js";

import { parseSignatureInput } from "./fields.js";

/** What a command reads its input through. */
export interface InputContext {
	cwd: string;
	env: Env;
	stdin: Stdin;
}

/** A raw request read into its parts, ready to become a `Request`. */
export interface RawRequest {
	method: string;
	url: string;
	headers: Headers;
	body: Uint8Array<ArrayBuffer>;
}

/** One component identifier: a quoted String with its parameters, or a bare name. */
const IDENTIFIER_PATTERN = /(?:"[^"]*"|[^\s,])+/g;

/** The blank line that ends a request's head, with CRLF or LF line endings. */
const HEAD_END_PATTERN = /\r?\n\r?\n/;

/**
 * The message of anything thrown, for a diagnostic line.
 *
 * @param error - What was caught.
 */
export function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * Reads a file whole as bytes, or stdin when `source` is `-`. A terminal on stdin is
 * refused, so a command run with nothing piped exits at once instead of waiting.
 *
 * @param source - A path relative to the run's directory, or `-`.
 * @param ctx - The run's directory and stdin.
 */
export async function readBytes(
	source: string,
	ctx: InputContext,
): Promise<Result<Uint8Array<ArrayBuffer>, ExitError>> {
	if (source === "-") {
		if (ctx.stdin.isTTY) return exit(EXIT_CODES.usage, "Nothing piped on stdin");
		return success(new TextEncoder().encode(await ctx.stdin.text()));
	}
	try {
		return success(new Uint8Array(await readFile(resolve(ctx.cwd, source))));
	} catch (error) {
		return exit(EXIT_CODES.usage, `Cannot read ${source}: ${messageOf(error)}`);
	}
}

/**
 * The text of the key named by exactly one of `--key-file` and `--key-env`.
 *
 * @param flags - The two flags as given.
 * @param ctx - The run's directory, environment and stdin.
 * @returns The text and where it came from, for diagnostics.
 */
export async function readKeyText(
	flags: { keyFile?: string; keyEnv?: string },
	ctx: InputContext,
): Promise<Result<{ text: string; source: string }, ExitError>> {
	if (flags.keyFile !== undefined) {
		let bytes = await readBytes(flags.keyFile, ctx);
		if (isFailure(bytes)) return bytes;
		return success({ text: new TextDecoder().decode(bytes.data), source: flags.keyFile });
	}
	let value = ctx.env[flags.keyEnv ?? ""];
	if (!value) return exit(EXIT_CODES.usage, `$${flags.keyEnv} is not set`);
	return success({ text: value, source: `$${flags.keyEnv}` });
}

/**
 * Headers from `name:value` arguments, a repeated name appending another value.
 *
 * @param lines - The `--header` values as typed.
 */
export function parseHeaders(lines: string[]): Result<Headers, ExitError> {
	let headers = new Headers();
	for (let line of lines) {
		let colon = line.indexOf(":");
		if (colon <= 0) return exit(EXIT_CODES.usage, `--header expects name:value; got ${line}`);
		try {
			headers.append(line.slice(0, colon).trim(), line.slice(colon + 1).trim());
		} catch (error) {
			return exit(EXIT_CODES.usage, `Invalid header ${line}: ${messageOf(error)}`);
		}
	}
	return success(headers);
}

/**
 * The components `--components` lists. A bare name such as `@method` or `content-type` is
 * taken as written; a name with parameters is read as RFC 9421 writes it inside
 * `Signature-Input`, so `@query-param;name="q"` and `"signature";key="sig1"` both work.
 *
 * @param values - The `--components` values, each holding one or more identifiers.
 */
export function parseComponents(values: string[]): Result<Component[], ExitError> {
	let identifiers = values.flatMap((value) => value.match(IDENTIFIER_PATTERN) ?? []);
	let items = identifiers.map((identifier) => {
		if (identifier.startsWith('"')) return identifier;
		let semicolon = identifier.indexOf(";");
		if (semicolon === -1) return `"${identifier}"`;
		return `"${identifier.slice(0, semicolon)}"${identifier.slice(semicolon)}`;
	});
	let parsed = parseSignatureInput(`c=(${items.join(" ")})`);
	if (isFailure(parsed) || !parsed.data.c) {
		return exit(EXIT_CODES.usage, `Cannot read --components ${values.join(" ")}`);
	}
	return success(parsed.data.c.components);
}

/**
 * Reads a raw HTTP/1.1 request: the request line, header lines, a blank line and the body,
 * which `Content-Length` bounds when present. An origin-form target is resolved against
 * `Host` under `scheme`; an absolute-form target is taken as it is.
 *
 * @param bytes - The request as received.
 * @param scheme - `https` or `http`, for an origin-form target.
 * @param source - Where it came from, for the diagnostic.
 */
export function parseRequest(
	bytes: Uint8Array,
	scheme: "http" | "https",
	source: string,
): Result<RawRequest, ExitError> {
	let latin1 = new TextDecoder("latin1").decode(bytes);
	let end = HEAD_END_PATTERN.exec(latin1);
	let head = end ? latin1.slice(0, end.index) : latin1.trimEnd();
	let body = end ? bytes.slice(end.index + end[0].length) : new Uint8Array();

	let [requestLine = "", ...lines] = head.replace(/^(?:\r?\n)+/, "").split(/\r?\n/);
	let [method, target, version = ""] = requestLine.split(" ");
	if (!method || !target || !version.startsWith("HTTP/")) {
		return exit(EXIT_CODES.usage, `${source} does not start with a request line`);
	}

	let headers = new Headers();
	for (let line of lines) {
		let colon = line.indexOf(":");
		if (colon <= 0) return exit(EXIT_CODES.usage, `${source} has a malformed header: ${line}`);
		try {
			headers.append(line.slice(0, colon).trim(), line.slice(colon + 1).trim());
		} catch (error) {
			return exit(EXIT_CODES.usage, `${source} has an invalid header: ${messageOf(error)}`);
		}
	}

	let length = Number(headers.get("content-length") ?? Number.NaN);
	if (Number.isInteger(length) && length >= 0) body = body.slice(0, length);

	let host = headers.get("host");
	let url = URL.parse(target) ?? (host ? URL.parse(`${scheme}://${host}${target}`) : null);
	if (!url) return exit(EXIT_CODES.usage, `${source} has no absolute target or Host header`);
	return success({ method, url: url.href, headers, body });
}
