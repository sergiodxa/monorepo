/**
 * The `sdxc-http-signatures verify` handler: reads a raw HTTP request, verifies its RFC 9421 or
 * draft-cavage signature against a key from a file, an environment variable or a key set URL,
 * and names the check that failed. A bad signature exits 1; a key or request that cannot be
 * read exits 2, so a script tells a bad signature from a bad setup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ExitError } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { createCommand, EXIT_CODES, exit, success, usage } from "@sdxc/cli";
import { parse as parseDuration } from "@sdxc/duration";
import { failure, isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";

import type { HttpSignatureError } from "./errors.js";
import type { Algorithm, KeyLookup } from "./types.js";

import { parseCavageSignature } from "./cavage-field.js";
import { ALGORITHMS, HTTP_SIGNATURES_COMMANDS } from "./cli-contract.js";
import { messageOf, parseRequest, readBytes, readKeyText } from "./cli-input.js";
import { parseSignatureInput, serializeIdentifier } from "./fields.js";
import { importSignatureKey } from "./key.js";
import { verify } from "./verify.js";

/** How long a key set URL has to answer before the run gives up on it. */
const JWKS_TIMEOUT_MS = 10_000;

/** One JWK, keeping every member: RFC 7517 requires only `kty`. */
const KEY = s.object({ kty: s.string() }, { unknownKeys: "passthrough" });

/** A JWKS document, which a Web Bot Auth key directory also is. */
const KEY_SET = s.object({ keys: s.array(KEY) });

/** A key set member, which names its key with `kid`. */
interface SetKey extends JsonWebKey {
	kid?: string;
}

/** What the key flags resolve to: one key, or a set to pick from by `kid`. */
type KeySource = { kind: "key"; text: string } | { kind: "set"; keys: SetKey[] };

/**
 * Fetches the key set served at `url`.
 *
 * @param url - What `--jwks` was given.
 * @param signal - Aborted when the run is cancelled.
 */
async function fetchKeySet(
	url: string,
	signal: AbortSignal,
): Promise<Result<KeySource, ExitError>> {
	let parsed = URL.parse(url);
	if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) {
		return exit(EXIT_CODES.usage, `--jwks expects an http(s) URL; got ${url}`);
	}
	let text = "";
	try {
		let response = await fetch(parsed, {
			headers: { accept: "application/json, application/http-message-signatures-directory+json" },
			signal: AbortSignal.any([signal, AbortSignal.timeout(JWKS_TIMEOUT_MS)]),
		});
		if (!response.ok) return exit(EXIT_CODES.usage, `${url} answered ${response.status}`);
		text = await response.text();
	} catch (error) {
		return exit(EXIT_CODES.usage, `Cannot fetch ${url}: ${messageOf(error)}`);
	}
	let set = toKeySet(text);
	if (set === null) return exit(EXIT_CODES.usage, `${url} does not serve a key set`);
	return success(set);
}

/**
 * The key set in `text`, or `null` when it holds a single key or no JSON at all.
 *
 * @param text - A key file's text.
 */
function toKeySet(text: string): KeySource | null {
	try {
		let set = s.parseSafe(KEY_SET, JSON.parse(text));
		return set.success ? { kind: "set", keys: set.value.keys as SetKey[] } : null;
	} catch {
		return null;
	}
}

/**
 * The key named by exactly one of `--jwks`, `--key-file` and `--key-env`.
 *
 * @param flags - The three flags as given.
 * @param ctx - The run's directory, environment, stdin and abort signal.
 */
async function readKeySource(
	flags: { jwks?: string; keyFile?: string; keyEnv?: string },
	ctx: Parameters<typeof readKeyText>[1] & { signal: AbortSignal },
): Promise<Result<KeySource, ExitError>> {
	if (flags.jwks !== undefined) return fetchKeySet(flags.jwks, ctx.signal);
	let read = await readKeyText(flags, ctx);
	if (isFailure(read)) return read;
	return success(toKeySet(read.data.text) ?? { kind: "key", text: read.data.text });
}

/**
 * A `KeyLookup` over the key source: a set answers the key whose `kid` is the keyid, or its
 * only key; the algorithm is `--alg`, else the one the signature declared. A key that will
 * not import is kept in `problems`, since it means a bad setup rather than a bad signature.
 *
 * @param source - The key or key set.
 * @param alg - `--alg`, if given.
 * @param problems - Collects keys that would not import.
 */
function lookupFor(source: KeySource, alg: Algorithm | undefined, problems: string[]): KeyLookup {
	return async (keyId, declared) => {
		let algorithm = alg ?? ALGORITHMS.find((name) => name === declared);
		let key: string | JsonWebKey | undefined =
			source.kind === "key"
				? source.text
				: (source.keys.find((candidate) => candidate.kid === keyId) ??
					(source.keys.length === 1 ? source.keys[0] : undefined));
		if (key === undefined) return success(null);

		let imported = await importSignatureKey(key, { usage: "verify", algorithm });
		if (isFailure(imported)) {
			problems.push(imported.error.message);
			return failure(imported.error);
		}
		return success(imported.data);
	};
}

/**
 * What the request's signature claims to cover, for a failure report; empty when its fields
 * cannot be read.
 *
 * @param headers - The request's headers.
 * @param label - `--label`, if given.
 */
function claimedComponents(headers: Headers, label: string | undefined): string[] {
	let input = headers.get("signature-input");
	if (input !== null) {
		let parsed = parseSignatureInput(input);
		if (isFailure(parsed)) return [];
		let chosen = label === undefined ? Object.values(parsed.data)[0] : parsed.data[label];
		return (chosen?.components ?? []).flatMap((component) => {
			let identifier = serializeIdentifier(component);
			return isFailure(identifier) ? [] : [identifier.data];
		});
	}
	let cavage =
		headers.get("signature") ?? headers.get("authorization")?.replace(/^Signature /i, "");
	if (!cavage) return [];
	let parsed = parseCavageSignature(cavage);
	return isFailure(parsed) ? [] : (parsed.data.headers ?? []);
}

/**
 * Reads `--now` as an ISO date or a Unix time in seconds.
 *
 * @param value - The flag as typed.
 */
function parseNow(value: string): Result<Date, ExitError> {
	let date = /^\d+$/.test(value) ? new Date(Number(value) * 1000) : new Date(value);
	if (Number.isNaN(date.getTime())) {
		return exit(EXIT_CODES.usage, `--now expects an ISO date or Unix time; got ${value}`);
	}
	return success(date);
}

/**
 * The failure report for people: the code and message, and what the signature covers, so a
 * mismatch can be traced to the component a verifier and a signer disagree on.
 *
 * @param error - Why verification failed.
 * @param components - What the signature claims to cover.
 */
function describeFailure(error: HttpSignatureError, components: string[]): string {
	let lines = [`Invalid signature (${error.code}): ${error.message}`];
	if (error.code === "invalid-signature" && components.length > 0) {
		lines.push("The signature base differs from the signer's in one of the covered components.");
	}
	if (components.length > 0) lines.push(`Covers: ${components.join(" ")}`);
	return lines.join("\n");
}

export default createCommand(HTTP_SIGNATURES_COMMANDS.verify, async (ctx) => {
	let { jwks, keyFile, keyEnv, alg, maxAge, label, http, json } = ctx.flags;
	let given = [jwks, keyFile, keyEnv].filter((value) => value !== undefined);
	if (given.length !== 1) {
		return usage("Pass exactly one of --jwks <url>, --key-file <path> or --key-env <name>");
	}
	if (keyFile === "-" && ctx.arguments.request === "-") {
		return usage("Only one of the request and the key can come from stdin");
	}
	let age = parseDuration(maxAge);
	if (isFailure(age)) return usage(`--max-age expects a duration such as 5 minutes; got ${maxAge}`);
	let now = ctx.flags.now === undefined ? success(new Date()) : parseNow(ctx.flags.now);
	if (isFailure(now)) return now;

	let bytes = await readBytes(ctx.arguments.request, ctx);
	if (isFailure(bytes)) return bytes;
	let source = ctx.arguments.request === "-" ? "stdin" : ctx.arguments.request;
	let raw = parseRequest(bytes.data, http ? "http" : "https", source);
	if (isFailure(raw)) return raw;
	let keys = await readKeySource({ jwks, keyFile, keyEnv }, ctx);
	if (isFailure(keys)) return keys;

	let { method, url, headers, body } = raw.data;
	let request: Request;
	try {
		request = new Request(url, {
			method,
			headers,
			body: body.length > 0 && method !== "GET" && method !== "HEAD" ? body : null,
		});
	} catch (error) {
		return exit(EXIT_CODES.usage, `${source} is not a valid request: ${messageOf(error)}`);
	}

	let problems: string[] = [];
	let verified = await verify(request, {
		body,
		key: lookupFor(keys.data, alg, problems),
		maxAge: age.data,
		now: now.data,
		label,
	});
	if (problems.length > 0) return exit(EXIT_CODES.usage, `Cannot use the key: ${problems[0]}`);

	if (isFailure(verified)) {
		let components = claimedComponents(headers, label);
		if (!json) return exit(EXIT_CODES.failure, describeFailure(verified.error, components));
		let { code, message } = verified.error;
		ctx.stdout(`${JSON.stringify({ valid: false, code, message, components })}\n`);
		return exit(EXIT_CODES.failure);
	}

	let { scheme, keyId, created, components } = verified.data;
	if (json) {
		ctx.stdout(
			`${JSON.stringify({ valid: true, scheme, label: verified.data.label, keyId, created, components })}\n`,
		);
		return success();
	}
	let labelled = verified.data.label === null ? "" : ` ${verified.data.label}`;
	ctx.stdout(
		[
			`Valid ${scheme} signature${labelled} by ${keyId}`,
			`Created: ${created.toISOString()}`,
			`Covers: ${components.join(" ")}`,
		].join("\n") + "\n",
	);
	return success();
});
