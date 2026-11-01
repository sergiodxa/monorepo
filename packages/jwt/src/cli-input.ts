/**
 * Input every `sdxc-jwt` command shares: a token from an argument or stdin, a file or stdin
 * read whole, and a key pair from a file or an environment variable. Input that cannot be read
 * or parsed answers an exit-2 failure naming its source, so a handler returns it as it is.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Env, ExitError, Stdin } from "@sdxc/cli";
import type { Result } from "@sdxc/result";
import type { ProtectedHeaderParameters } from "jose";

import { EXIT_CODES, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";
import { decodeProtectedHeader } from "jose";
import * as s from "remix/data-schema";

import * as Algorithm from "./algorithm.js";
import { JWK, LEGACY_EDDSA } from "./jwk.js";
import { JWT } from "./jwt.js";

/** What a command reads its input through. */
export interface InputContext {
	cwd: string;
	env: Env;
	stdin: Stdin;
}

/** A decoded token: its protected header and its claims, both as the token presents them. */
export interface DecodedToken {
	header: ProtectedHeaderParameters;
	payload: JWT.Payload;
}

/** The JSON `sdxc-jwt keygen` writes and `JWK.generateKeyPair` answers. */
const SERIALIZED_KEY_PAIR = s.object({
	id: s.string(),
	alg: s.enum_([Algorithm.ES256, Algorithm.RS256, Algorithm.Ed25519, LEGACY_EDDSA]),
	publicKey: s.string(),
	privateKey: s.string(),
	created: s.number(),
});

/**
 * The message of anything thrown, for a diagnostic line.
 *
 * @param error - What was caught.
 */
export function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * Reads a file whole, or stdin when `source` is `-`. A terminal on stdin is refused, so a
 * command run with nothing piped exits at once instead of waiting.
 *
 * @param source - A path relative to the run's directory, or `-`.
 * @param ctx - The run's directory and stdin.
 */
export async function readSource(
	source: string,
	ctx: InputContext,
): Promise<Result<string, ExitError>> {
	if (source === "-") {
		if (ctx.stdin.isTTY) return exit(EXIT_CODES.usage, "Nothing piped on stdin");
		return success(await ctx.stdin.text());
	}
	try {
		return success(await readFile(resolve(ctx.cwd, source), "utf8"));
	} catch (error) {
		return exit(EXIT_CODES.usage, `Cannot read ${source}: ${messageOf(error)}`);
	}
}

/**
 * The token a command was given, trimmed, so a file with a trailing newline reads as the
 * token it holds.
 *
 * @param token - The argument as typed, `-` for stdin.
 * @param ctx - The run's stdin.
 */
export async function readToken(
	token: string,
	ctx: InputContext,
): Promise<Result<string, ExitError>> {
	let text = token === "-" ? await readSource(token, ctx) : success(token);
	if (isFailure(text)) return text;
	let trimmed = text.data.trim();
	if (trimmed === "") return exit(EXIT_CODES.usage, "No token given");
	return success(trimmed);
}

/**
 * Parses JSON read from `source`.
 *
 * @param text - The text read.
 * @param source - Where it came from, for the diagnostic.
 */
export function parseJSON(text: string, source: string): Result<unknown, ExitError> {
	try {
		return success(JSON.parse(text) as unknown);
	} catch (error) {
		return exit(EXIT_CODES.usage, `${source} is not valid JSON: ${messageOf(error)}`);
	}
}

/**
 * A token's header and claims, read without verifying the signature.
 *
 * @param token - The compact token.
 */
export function decodeToken(token: string): Result<DecodedToken, ExitError> {
	try {
		return success({ header: decodeProtectedHeader(token), payload: JWT.decode(token).payload });
	} catch (error) {
		return exit(EXIT_CODES.usage, `Not a JWT: ${messageOf(error)}`);
	}
}

/**
 * A decoded token for people: the header and the claims as indented JSON, and when the
 * token expires.
 *
 * @param decoded - The decoded token.
 */
export function formatToken(decoded: DecodedToken): string {
	let lines = [
		"Header",
		JSON.stringify(decoded.header, null, 2),
		"",
		"Payload",
		JSON.stringify(decoded.payload, null, 2),
	];
	let token = new JWT(decoded.payload);
	if (token.expiresAt) {
		let state = token.expired ? "expired" : "expires";
		lines.push("", `Token ${state} at ${token.expiresAt.toISOString()}`);
	}
	return `${lines.join("\n")}\n`;
}

/**
 * Imports a key pair in the shape `sdxc-jwt keygen` writes.
 *
 * @param value - The parsed JSON.
 * @param source - Where it came from, for the diagnostic.
 */
export async function importKeyPair(
	value: unknown,
	source: string,
): Promise<Result<JWK.KeyPair, ExitError>> {
	let parsed = s.parseSafe(SERIALIZED_KEY_PAIR, value);
	if (!parsed.success) {
		return exit(EXIT_CODES.usage, `${source} is not a key pair from sdxc-jwt keygen`);
	}
	try {
		return success(await JWK.importKeyPair(parsed.value as JWK.SerializedKeyPair));
	} catch (error) {
		return exit(EXIT_CODES.usage, `${source} holds an unusable key pair: ${messageOf(error)}`);
	}
}

/**
 * The text of the key pair named by `--key-file` or `--key-env`.
 *
 * @param flags - The two flags as given; `keyFile` wins when both are.
 * @param ctx - The run's directory, environment and stdin.
 */
async function readKeyText(
	flags: { keyFile?: string; keyEnv?: string },
	ctx: InputContext,
): Promise<Result<string, ExitError>> {
	if (flags.keyFile !== undefined) return readSource(flags.keyFile, ctx);
	let value = ctx.env[flags.keyEnv ?? ""];
	if (!value) return exit(EXIT_CODES.usage, `$${flags.keyEnv} is not set`);
	return success(value);
}

/**
 * The key pair named by exactly one of `--key-file` and `--key-env`.
 *
 * @param flags - The two flags as given.
 * @param ctx - The run's directory, environment and stdin.
 */
export async function readKeyPair(
	flags: { keyFile?: string; keyEnv?: string },
	ctx: InputContext,
): Promise<Result<JWK.KeyPair, ExitError>> {
	if ((flags.keyFile === undefined) === (flags.keyEnv === undefined)) {
		return exit(EXIT_CODES.usage, "Pass exactly one of --key-file <path> or --key-env <name>");
	}
	let source = flags.keyFile ?? `$${flags.keyEnv}`;
	let text = await readKeyText(flags, ctx);
	if (isFailure(text)) return text;
	let json = parseJSON(text.data, source);
	if (isFailure(json)) return json;
	return importKeyPair(json.data, source);
}
