/**
 * Input every `sdxc-openpgp` command shares: a file or stdin read as text or bytes, a secret
 * from a file or an environment variable, and keys read from them. Input that cannot be read
 * or parsed answers an exit-2 failure naming its source, so a handler returns it as it is.
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

import type { OpenPgpError } from "./errors.js";
import type { PrivateKey, PublicKey } from "./keys.js";

import { readPrivateKey, readPublicKey } from "./keys.js";

/** What a command reads its input through. */
export interface InputContext {
	cwd: string;
	env: Env;
	stdin: Stdin;
}

/** A secret named by a `--<name>-file` or a `--<name>-env` flag. */
export interface SecretSource {
	file: string | undefined;
	env: string | undefined;
}

/**
 * The message of anything thrown, for a diagnostic line.
 *
 * @param error - What was caught.
 */
function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * Where an input came from, as a diagnostic names it.
 *
 * @param source - A path, or `-` for stdin.
 */
export function sourceName(source: string): string {
	return source === "-" ? "stdin" : source;
}

/**
 * Fails with exit 2 when more than one input is `-`, since stdin can be read only once.
 *
 * @param sources - Every path the command was given, `undefined` for one left out.
 */
export function oneStdin(sources: Array<string | undefined>): Result<void, ExitError> {
	if (sources.filter((source) => source === "-").length > 1) {
		return exit(EXIT_CODES.usage, "Only one input can come from stdin");
	}
	return success(undefined);
}

/**
 * Reads stdin whole, refusing a terminal so a run with nothing piped exits at once instead
 * of waiting.
 *
 * @param ctx - The run's stdin.
 */
async function readStdin(ctx: InputContext): Promise<Result<string, ExitError>> {
	if (ctx.stdin.isTTY) return exit(EXIT_CODES.usage, "Nothing piped on stdin");
	return success(await ctx.stdin.text());
}

/**
 * Reads a file whole as UTF-8, or stdin when `source` is `-`.
 *
 * @param source - A path relative to the run's directory, or `-`.
 * @param ctx - The run's directory and stdin.
 */
export async function readText(
	source: string,
	ctx: InputContext,
): Promise<Result<string, ExitError>> {
	if (source === "-") return readStdin(ctx);
	try {
		return success(await readFile(resolve(ctx.cwd, source), "utf8"));
	} catch (error) {
		return exit(EXIT_CODES.usage, `Cannot read ${source}: ${messageOf(error)}`);
	}
}

/**
 * Reads a file's octets exactly, or stdin's text as UTF-8 when `source` is `-`; binary data
 * signs and verifies byte for byte only from a file.
 *
 * @param source - A path relative to the run's directory, or `-`.
 * @param ctx - The run's directory and stdin.
 */
export async function readBytes(
	source: string,
	ctx: InputContext,
): Promise<Result<Uint8Array, ExitError>> {
	if (source === "-") {
		let text = await readStdin(ctx);
		return isFailure(text) ? text : success(new TextEncoder().encode(text.data));
	}
	try {
		return success(new Uint8Array(await readFile(resolve(ctx.cwd, source))));
	} catch (error) {
		return exit(EXIT_CODES.usage, `Cannot read ${source}: ${messageOf(error)}`);
	}
}

/**
 * The secret named by a file or an environment variable, or `undefined` when neither flag
 * was given.
 *
 * @param name - The flags' stem, `key` or `passphrase`, for the diagnostics.
 * @param source - The two flags as given.
 * @param ctx - The run's directory, environment and stdin.
 */
export async function readSecret(
	name: string,
	source: SecretSource,
	ctx: InputContext,
): Promise<Result<string | undefined, ExitError>> {
	if (source.file !== undefined && source.env !== undefined) {
		return exit(EXIT_CODES.usage, `Pass only one of --${name}-file and --${name}-env`);
	}
	if (source.file !== undefined) return readText(source.file, ctx);
	if (source.env === undefined) return success(undefined);
	let value = ctx.env[source.env];
	if (!value) return exit(EXIT_CODES.usage, `$${source.env} is not set`);
	return success(value);
}

/**
 * A passphrase from `--passphrase-file` or `--passphrase-env`, with the one trailing
 * newline a file written by `echo` ends in removed.
 *
 * @param source - The two flags as given.
 * @param ctx - The run's directory, environment and stdin.
 */
export async function readPassphrase(
	source: SecretSource,
	ctx: InputContext,
): Promise<Result<string | undefined, ExitError>> {
	let passphrase = await readSecret("passphrase", source, ctx);
	if (isFailure(passphrase)) return passphrase;
	return success(passphrase.data?.replace(/\r?\n$/, ""));
}

/**
 * An exit-2 failure for a protected key read without a passphrase, naming the flags that
 * supply one.
 *
 * @param source - Where the key came from.
 */
function lockedKey(source: string): Result<never, ExitError> {
	return exit(
		EXIT_CODES.usage,
		`The key in ${source} is passphrase-protected; pass --passphrase-file or --passphrase-env`,
	);
}

/**
 * An exit-2 failure for a key that cannot be used.
 *
 * @param error - The library's failure.
 * @param source - Where the key came from.
 */
function keyError(error: OpenPgpError, source: string): Result<never, ExitError> {
	if (error.code === "locked") return lockedKey(source);
	return exit(EXIT_CODES.usage, `Cannot read the key in ${source}: ${error.message}`);
}

/**
 * The unlocked private key named by exactly one of `--key-file` and `--key-env`.
 *
 * @param key - The two key flags as given.
 * @param passphrase - The two passphrase flags as given.
 * @param ctx - The run's directory, environment and stdin.
 */
export async function readSigningKey(
	key: SecretSource,
	passphrase: SecretSource,
	ctx: InputContext,
): Promise<Result<PrivateKey, ExitError>> {
	if (key.file === undefined && key.env === undefined) {
		return exit(EXIT_CODES.usage, "Pass --key-file <path> or --key-env <name>");
	}
	let source = key.file === undefined ? `$${key.env}` : sourceName(key.file);
	let text = await readSecret("key", key, ctx);
	if (isFailure(text)) return text;
	let secret = await readPassphrase(passphrase, ctx);
	if (isFailure(secret)) return secret;
	let read = await readPrivateKey(text.data ?? "", { passphrase: secret.data });
	if (isFailure(read)) return keyError(read.error, source);
	if (read.data.locked) return lockedKey(source);
	return success(read.data);
}

/**
 * Reads a key from a file or stdin: a private key when the input holds one, so a report can
 * say so, and otherwise a certificate.
 *
 * @param source - A path, or `-`.
 * @param ctx - The run's directory and stdin.
 */
export async function readAnyKey(
	source: string,
	ctx: InputContext,
): Promise<Result<PublicKey | PrivateKey, ExitError>> {
	let bytes = await readBytes(source, ctx);
	if (isFailure(bytes)) return bytes;
	let input = armoredOrBinary(bytes.data);
	let secret = await readPrivateKey(input);
	if (!isFailure(secret)) return secret;
	let certificate = await readPublicKey(input);
	if (isFailure(certificate)) return keyError(certificate.error, sourceName(source));
	return certificate;
}

/**
 * A certificate from a file or stdin; a private key block gives up its public half.
 *
 * @param source - A path, or `-`.
 * @param ctx - The run's directory and stdin.
 */
export async function readCertificate(
	source: string,
	ctx: InputContext,
): Promise<Result<PublicKey, ExitError>> {
	let bytes = await readBytes(source, ctx);
	if (isFailure(bytes)) return bytes;
	let certificate = await readPublicKey(armoredOrBinary(bytes.data));
	if (isFailure(certificate)) return keyError(certificate.error, sourceName(source));
	return certificate;
}

/**
 * The input as armored text when it starts like armor, and as binary packets otherwise,
 * so `gpg --export` output reads as well as `gpg --armor --export`.
 *
 * @param bytes - The octets read.
 */
export function armoredOrBinary(bytes: Uint8Array): string | Uint8Array {
	let head = new TextDecoder().decode(bytes.subarray(0, 512));
	return head.includes("-----BEGIN PGP ") ? new TextDecoder().decode(bytes) : bytes;
}
