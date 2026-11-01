/**
 * Input reading shared by the `sdxc-crypto` handlers: a payload from a path or stdin, a secret
 * from a file or a named environment variable, and digests printed in the chosen encoding.
 * Every failure here is an exit-2 usage or unreadable-input error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Env, Stdin } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { exit, usage } from "@sdxc/cli";
import { isFailure, success, wrap } from "@sdxc/result";

import type { Bytes } from "./lib/bytes.js";

import { Base64, Base64Url, Hex } from "./encoding.js";

/** What a handler reads input from: its working directory, environment and stdin. */
export interface InputSource {
	readonly cwd: string;
	readonly env: Env;
	readonly stdin: Stdin;
}

/** Where a secret comes from: the paired `--*-file` and `--*-env` flags, and their names. */
export interface SecretFlags {
	file: string | undefined;
	env: string | undefined;
	/** The flag pair's prefix as typed, `key` for `--key-file` / `--key-env`. */
	name: string;
}

/**
 * The payload at `path`, as bytes, or stdin as UTF-8 text when `path` is `-` or absent. Stdin at
 * a terminal is a usage error, so a run without input fails at once instead of waiting.
 *
 * @param source - The run's directory and stdin
 * @param path - The path argument as typed
 */
export async function readPayload(
	source: InputSource,
	path: string | undefined,
): Promise<Result<string | Bytes, Error>> {
	if (path === undefined || path === "-") {
		if (source.stdin.isTTY) return usage("Pass a file, or pipe the input on stdin");
		return success(await source.stdin.text());
	}
	return readPath(source, path);
}

/**
 * The secret one of `flags` names, with one trailing line ending dropped so a file written by
 * `echo` holds the same key as the variable. Exactly one of the pair must be given.
 *
 * @param source - The run's directory, environment and stdin
 * @param flags - The `--*-file` / `--*-env` values
 */
export async function readSecret(
	source: InputSource,
	flags: SecretFlags,
): Promise<Result<string, Error>> {
	if ((flags.file === undefined) === (flags.env === undefined)) {
		return usage(`Pass exactly one of --${flags.name}-file or --${flags.name}-env`);
	}
	if (flags.env !== undefined) {
		let value = source.env[flags.env];
		if (value === undefined || value === "") {
			return exit(2, `Environment variable ${flags.env} is unset or empty`);
		}
		return success(value);
	}
	let text = await readSecretFile(source, flags.file ?? "-");
	if (isFailure(text)) return text;
	let secret = dropLineEnding(text.data);
	if (secret === "") return exit(2, `--${flags.name}-file holds an empty ${flags.name}`);
	return success(secret);
}

/**
 * A password piped on stdin with one trailing line ending dropped, or typed at a terminal
 * behind a masked prompt. An empty password is a usage error.
 *
 * @param source - The run's stdin
 * @param ask - Asks for the password when stdin is a terminal
 */
export async function readPassword(
	source: InputSource,
	ask: () => Promise<Result<string, Error>>,
): Promise<Result<string, Error>> {
	let typed = source.stdin.isTTY ? await ask() : success(dropLineEnding(await source.stdin.text()));
	if (isFailure(typed)) return typed;
	if (typed.data === "") return usage("Pipe the password on stdin, or type it at the prompt");
	return typed;
}

/**
 * `bytes` as text in `encoding`, matching `sha256sum` for hex.
 *
 * @param bytes - A digest or MAC
 * @param encoding - One of the `--encoding` choices
 */
export function encodeBytes(bytes: Bytes, encoding: "hex" | "base64" | "base64url"): string {
	if (encoding === "base64") return Base64.encode(bytes);
	if (encoding === "base64url") return Base64Url.encode(bytes);
	return Hex.encode(bytes);
}

/** The file at `path`, resolved against the run's directory, as bytes; unreadable exits 2. */
async function readPath(source: InputSource, path: string): Promise<Result<Bytes, Error>> {
	let read = await wrap(() => readFile(resolve(source.cwd, path)));
	if (isFailure(read)) return exit(2, `Cannot read ${path}: ${read.error.message}`);
	return success(new Uint8Array(read.data));
}

/** A secret file's text, or stdin's when `path` is `-`. */
async function readSecretFile(source: InputSource, path: string): Promise<Result<string, Error>> {
	if (path === "-") {
		if (source.stdin.isTTY) return usage("Pipe the secret on stdin, or pass a file path");
		return success(await source.stdin.text());
	}
	let bytes = await readPath(source, path);
	if (isFailure(bytes)) return bytes;
	return success(new TextDecoder().decode(bytes.data));
}

/** `text` without one trailing `\n` or `\r\n`. */
function dropLineEnding(text: string): string {
	return text.replace(/\r?\n$/, "");
}
