/**
 * The `sdxc-jwt verify` handler: checks a token's signature, `exp` and `nbf`, plus any issuer,
 * audience and algorithms asked for, against a key set from a URL or a file. A token that fails
 * exits 1; keys that cannot be read exit 2, so a script tells a bad token from a bad setup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ExitError } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { createCommand, EXIT_CODES, exit, failure, success, usage } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";

import type { InputContext } from "./cli-input.js";

import { JWT_COMMANDS } from "./cli-contract.js";
import {
	decodeToken,
	formatToken,
	importKeyPair,
	messageOf,
	parseJSON,
	readSource,
	readToken,
} from "./cli-input.js";
import { JWK } from "./jwk.js";
import { JWT } from "./jwt.js";

/** How long a key set URL has to answer before the run gives up on it. */
const JWKS_TIMEOUT_MS = 10_000;

/** One JWK, keeping every member: RFC 7517 requires only `kty`. */
const KEY = s.object({ kty: s.string() }, { unknownKeys: "passthrough" });

/** A JWKS document. */
const KEY_SET = s.object({ keys: s.array(KEY) });

/**
 * Fetches the key set served at `url`.
 *
 * @param url - What `--jwks` was given.
 * @param signal - Aborted when the run is cancelled.
 */
async function fetchKeys(url: string, signal: AbortSignal): Promise<Result<unknown, ExitError>> {
	let parsed = URL.parse(url);
	if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) {
		return exit(EXIT_CODES.usage, `--jwks expects an http(s) URL; got ${url}`);
	}
	try {
		let response = await fetch(parsed, {
			headers: { accept: "application/json" },
			signal: AbortSignal.any([signal, AbortSignal.timeout(JWKS_TIMEOUT_MS)]),
		});
		if (!response.ok) return exit(EXIT_CODES.usage, `${url} answered ${response.status}`);
		return parseJSON(await response.text(), url);
	} catch (error) {
		return exit(EXIT_CODES.usage, `Cannot fetch ${url}: ${messageOf(error)}`);
	}
}

/**
 * The key set in `value`, which may be a JWKS document, one public JWK, or a key pair from
 * `sdxc-jwt keygen` (its public half).
 *
 * @param value - The parsed JSON.
 * @param source - Where it came from, for the diagnostic.
 */
async function toKeySet(
	value: unknown,
	source: string,
): Promise<Result<JWK.PublishedKeySet, ExitError>> {
	let set = s.parseSafe(KEY_SET, value);
	if (set.success) return success(set.value as JWK.PublishedKeySet);
	let key = s.parseSafe(KEY, value);
	if (key.success) return success({ keys: [key.value as JWK.PublishedKey] });
	let pair = await importKeyPair(value, source);
	if (isFailure(pair)) {
		return exit(EXIT_CODES.usage, `${source} is not a JWKS, a JWK or a key pair from keygen`);
	}
	return success(JWK.toJSON([pair.data]));
}

/**
 * The key set named by exactly one of `--jwks` and `--key-file`.
 *
 * @param flags - The two flags as given.
 * @param ctx - The run's directory, stdin and abort signal.
 */
async function readKeys(
	flags: { jwks?: string; keyFile?: string },
	ctx: InputContext & { signal: AbortSignal },
): Promise<Result<JWK.PublishedKeySet, ExitError>> {
	let source = flags.jwks ?? flags.keyFile ?? "";
	let text = flags.jwks
		? await fetchKeys(flags.jwks, ctx.signal)
		: await readSource(source, ctx).then((read) =>
				isFailure(read) ? read : parseJSON(read.data, source),
			);
	if (isFailure(text)) return text;
	return toKeySet(text.data, source);
}

export default createCommand(JWT_COMMANDS.verify, async (ctx) => {
	let { jwks, keyFile, iss, aud, alg, json } = ctx.flags;
	if ((jwks === undefined) === (keyFile === undefined)) {
		return usage("Pass exactly one of --jwks <url> or --key-file <path>");
	}
	if (keyFile === "-" && ctx.arguments.token === "-") {
		return usage("Only one of the token and the key set can come from stdin");
	}
	let token = await readToken(ctx.arguments.token, ctx);
	if (isFailure(token)) return token;
	let keys = await readKeys({ jwks, keyFile }, ctx);
	if (isFailure(keys)) return keys;

	try {
		await JWT.verify(token.data, await JWK.importLocal(keys.data), {
			issuer: iss,
			audience: aud,
			algorithms: alg.length > 0 ? alg : undefined,
		});
	} catch (error) {
		let reason = messageOf(error);
		if (!json) return failure(new Error(`Invalid token: ${reason}`));
		ctx.stdout(`${JSON.stringify({ valid: false, error: reason })}\n`);
		return exit(EXIT_CODES.failure);
	}

	let decoded = decodeToken(token.data);
	if (isFailure(decoded)) return decoded;
	if (json) ctx.stdout(`${JSON.stringify({ valid: true, ...decoded.data })}\n`);
	else ctx.stdout(`Valid token\n\n${formatToken(decoded.data)}`);
	return success();
});
