/**
 * The `WWW-Authenticate` challenge a bearer-token API answers a refusal with: RFC 6750 §3
 * parameters, RFC 9470's step-up `acr_values` and `max_age`, and RFC 9728's
 * `resource_metadata`, written with RFC 9110 quoting and read from a multi-scheme header;
 * RFC 9449's `DPoP` scheme shares the parameters and adds `algs`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

/** The error codes RFC 6750 §3.1 registers, plus RFC 9470 §3's step-up refusal. */
export type BearerError =
	| "invalid_request"
	| "invalid_token"
	| "insufficient_scope"
	| "insufficient_user_authentication";

/** The error codes a `DPoP` challenge carries: the bearer ones plus RFC 9449 §7.1's and §9's. */
export type DPoPError = BearerError | "invalid_dpop_proof" | "use_dpop_nonce";

/** One `Bearer` challenge, with its registered parameters typed and the rest kept by name. */
export interface BearerChallenge {
	realm: string | null;
	/** The scopes the request needs, from the space-separated `scope` parameter. */
	scope: string[];
	error: BearerError | null;
	errorDescription: string | null;
	errorUri: URL | null;
	/**
	 * The authentication context classes a step-up asks for (RFC 9470 §3), in order of
	 * preference, from the space-separated `acr_values` parameter.
	 */
	acrValues: string[];
	/** How many seconds old the user's authentication may be (RFC 9470 §3). */
	maxAge: number | null;
	/** Where the resource's RFC 9728 metadata is served. */
	resourceMetadata: URL | null;
	/**
	 * Every other auth-param by lowercased name. A registered parameter whose value fits
	 * no typed field (an unregistered `error` code, a relative `error_uri`, a `max_age`
	 * that is no whole number) stays here under its own name, so reading loses nothing.
	 */
	extensions: Record<string, string>;
}

/** One `DPoP` challenge (RFC 9449 §7.1): the bearer parameters plus the accepted `algs`. */
export interface DPoPChallenge extends Omit<BearerChallenge, "error"> {
	error: DPoPError | null;
	/** The JWS algorithms the server accepts a proof signed with. */
	algs: string[];
}

/** Why a `WWW-Authenticate` value could not be read, with the offset where it broke. */
export class ChallengeParseError extends Error {
	override name = "ChallengeParseError";
	/** The zero-based character offset the reader stopped at. */
	readonly offset: number;

	/**
	 * @param message - What the reader expected.
	 * @param offset - Where in the header it stopped.
	 */
	constructor(message: string, offset: number) {
		super(`${message} (at offset ${offset})`);
		this.offset = offset;
	}
}

/** How one scheme's challenge is read: its name and the `error` codes it registers. */
interface SchemeRules {
	/** The scheme as written, compared case-insensitively. */
	name: string;
	errors: readonly string[];
}

/** The registered codes, which a parsed `error` is held to. */
const BEARER_ERRORS: readonly string[] = [
	"invalid_request",
	"invalid_token",
	"insufficient_scope",
	"insufficient_user_authentication",
];

/** The `Bearer` scheme of RFC 6750 §3. */
const BEARER: SchemeRules = { name: "Bearer", errors: BEARER_ERRORS };

/** The `DPoP` scheme of RFC 9449 §7.1. */
const DPOP: SchemeRules = {
	name: "DPoP",
	errors: [...BEARER_ERRORS, "invalid_dpop_proof", "use_dpop_nonce"],
};

/** A `max_age` RFC 9470 §3 can mean: a non-negative whole number of seconds. */
const SECONDS = /^\d+$/;

/** An RFC 9110 §5.6.2 token at the start of the input. */
const TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+/;

/**
 * An RFC 9110 §11.2 token68 standing alone before the end of the header or the next list
 * element, which tells it apart from the first `name=value` auth-param.
 */
const TOKEN68 = /^[A-Za-z0-9\-._~+/]+=*(?=[ \t]*(?:,|$))/;

/** Optional whitespace, RFC 9110 §5.6.3's OWS and BWS. */
const WHITESPACE = /^[ \t]*/;

/**
 * Control characters, which a header value cannot carry; a written value replaces each
 * with a space, so no parameter can end the header line.
 */
// oxlint-disable-next-line no-control-regex -- matching control characters is the point: they are what a header value must not carry
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;

/** A challenge as RFC 9110 §11 frames it, before any scheme reads meaning into it. */
interface RawChallenge {
	scheme: string;
	token68: string | null;
	params: [name: string, value: string][];
}

/**
 * A cursor over a header value, answering every read with what it consumed so the
 * grammar below reads as a sequence of steps.
 */
class Reader {
	#input: string;
	offset = 0;

	/** @param input - The header value. */
	constructor(input: string) {
		this.#input = input;
	}

	/** Whether every character has been consumed. */
	get done(): boolean {
		return this.offset >= this.#input.length;
	}

	/** The character under the cursor, empty at the end. */
	peek(): string {
		return this.#input.charAt(this.offset);
	}

	/**
	 * Consumes a match of the pattern at the cursor.
	 *
	 * @param pattern - Anchored at the start with `^`.
	 * @returns The matched text, or `null` when the input does not match there.
	 */
	match(pattern: RegExp): string | null {
		let found = pattern.exec(this.#input.slice(this.offset));
		if (found === null) return null;
		this.offset += found[0].length;
		return found[0];
	}

	/** Consumes optional whitespace, reporting whether there was any. */
	space(): boolean {
		return (this.match(WHITESPACE) ?? "").length > 0;
	}

	/**
	 * Consumes an RFC 9110 §5.6.4 quoted-string, unescaping each quoted-pair.
	 *
	 * @returns The unquoted value, or `null` when the string never closes.
	 */
	quoted(): string | null {
		let value = "";
		let at = this.offset + 1;

		while (at < this.#input.length) {
			let char = this.#input.charAt(at);
			if (char === '"') {
				this.offset = at + 1;
				return value;
			}
			if (char === "\\") at += 1;
			value += this.#input.charAt(at);
			at += 1;
		}

		return null;
	}
}

/**
 * Consumes list separators, which RFC 9110 §5.6.1 lets repeat and lets surround with
 * whitespace.
 *
 * @param reader - The cursor.
 */
function skipSeparators(reader: Reader): void {
	while (!reader.done) {
		reader.space();
		if (reader.peek() !== ",") return;
		reader.offset += 1;
	}
}

/**
 * Reports whether the next list element is another auth-param of the current challenge
 * rather than the scheme of a new one: a token followed by `=`.
 *
 * @param reader - The cursor, left where it was.
 */
function paramAhead(reader: Reader): boolean {
	let start = reader.offset;
	let name = reader.match(TOKEN);
	reader.space();
	let ahead = name !== null && reader.peek() === "=";
	reader.offset = start;
	return ahead;
}

/**
 * Reads the auth-params after a scheme, stopping before the element that starts the
 * next challenge.
 *
 * @param reader - The cursor, at the first parameter's name.
 */
function readParams(reader: Reader): Result<RawChallenge["params"], ChallengeParseError> {
	let params: RawChallenge["params"] = [];

	while (true) {
		let name = reader.match(TOKEN);
		if (name === null)
			return failure(new ChallengeParseError("Expected a parameter name", reader.offset));

		reader.space();
		if (reader.peek() !== "=") {
			return failure(new ChallengeParseError(`Expected "=" after "${name}"`, reader.offset));
		}
		reader.offset += 1;
		reader.space();

		let value = reader.peek() === '"' ? reader.quoted() : reader.match(TOKEN);
		if (value === null) {
			return failure(new ChallengeParseError(`Expected a value for "${name}"`, reader.offset));
		}
		params.push([name.toLowerCase(), value]);

		reader.space();
		if (reader.done) return success(params);
		if (reader.peek() !== ",") {
			return failure(new ChallengeParseError('Expected "," between parameters', reader.offset));
		}

		let separator = reader.offset;
		skipSeparators(reader);
		if (reader.done) return success(params);
		if (!paramAhead(reader)) {
			reader.offset = separator;
			return success(params);
		}
	}
}

/**
 * Reads every challenge in a `WWW-Authenticate` value (RFC 9110 §11.6.1), whatever its
 * scheme, so a scheme listed before `Bearer` is stepped over by its grammar.
 *
 * @param header - The header value, several header lines joined with commas.
 */
function readChallenges(header: string): Result<RawChallenge[], ChallengeParseError> {
	let reader = new Reader(header);
	let challenges: RawChallenge[] = [];

	while (true) {
		skipSeparators(reader);
		if (reader.done) return success(challenges);

		let scheme = reader.match(TOKEN);
		if (scheme === null) {
			return failure(new ChallengeParseError("Expected an authentication scheme", reader.offset));
		}

		let challenge: RawChallenge = { scheme, token68: null, params: [] };
		challenges.push(challenge);

		let spaced = reader.space();
		if (reader.done || reader.peek() === ",") continue;
		if (!spaced) {
			return failure(new ChallengeParseError(`Expected a space after "${scheme}"`, reader.offset));
		}

		let token68 = reader.match(TOKEN68);
		if (token68 !== null) {
			challenge.token68 = token68;
			continue;
		}

		let params = readParams(reader);
		if (isFailure(params)) return params;
		challenge.params = params.data;
	}
}

/**
 * Gives a raw challenge its registered meaning under one scheme's rules.
 *
 * @param raw - A challenge whose scheme is the one `rules` names.
 * @param offset - Where the header ended, which a failure names.
 * @param rules - The scheme's name and registered error codes.
 * @returns The typed challenge; a token68 or a repeated parameter fails, since neither
 *   RFC 6750 §3 nor RFC 9449 §7.1 allows one.
 */
function toChallenge(
	raw: RawChallenge,
	offset: number,
	rules: SchemeRules,
): Result<DPoPChallenge, ChallengeParseError> {
	if (raw.token68 !== null) {
		return failure(
			new ChallengeParseError(
				`A ${rules.name} challenge carries parameters, not a token68`,
				offset,
			),
		);
	}

	let challenge: DPoPChallenge = {
		realm: null,
		scope: [],
		error: null,
		errorDescription: null,
		errorUri: null,
		acrValues: [],
		maxAge: null,
		resourceMetadata: null,
		algs: [],
		extensions: {},
	};
	let seen = new Set<string>();

	for (let [name, value] of raw.params) {
		if (seen.has(name)) {
			return failure(
				new ChallengeParseError(`The ${rules.name} challenge repeats "${name}"`, offset),
			);
		}
		seen.add(name);

		if (name === "realm") challenge.realm = value;
		else if (name === "scope") challenge.scope = value.split(" ").filter(Boolean);
		else if (name === "acr_values") challenge.acrValues = value.split(" ").filter(Boolean);
		else if (name === "max_age" && SECONDS.test(value)) challenge.maxAge = Number(value);
		else if (name === "algs" && rules === DPOP) challenge.algs = value.split(" ").filter(Boolean);
		else if (name === "error_description") challenge.errorDescription = value;
		else if (name === "error" && rules.errors.includes(value)) {
			challenge.error = value as DPoPError;
		} else if (name === "error_uri" && URL.canParse(value)) challenge.errorUri = new URL(value);
		else if (name === "resource_metadata" && URL.canParse(value)) {
			challenge.resourceMetadata = new URL(value);
		} else challenge.extensions[name] = value;
	}

	return success(challenge);
}

/**
 * Reads every challenge of one scheme out of a header.
 *
 * @param header - The header value.
 * @param rules - The scheme to read.
 */
function parseScheme(
	header: string,
	rules: SchemeRules,
): Result<DPoPChallenge[], ChallengeParseError> {
	let raw = readChallenges(header);
	if (isFailure(raw)) return raw;

	let challenges: DPoPChallenge[] = [];

	for (let challenge of raw.data) {
		if (challenge.scheme.toLowerCase() !== rules.name.toLowerCase()) continue;
		let typed = toChallenge(challenge, header.length, rules);
		if (isFailure(typed)) return typed;
		challenges.push(typed.data);
	}

	return success(challenges);
}

/**
 * Quotes a parameter value per RFC 9110 §5.6.4, escaping `"` and `\` and replacing each
 * control character with a space.
 *
 * @param value - The value as the caller stated it.
 */
function quote(value: string): string {
	let safe = value.replace(CONTROL_CHARACTERS, " ").replace(/["\\]/g, "\\$&");
	return `"${safe}"`;
}

/**
 * Writes one challenge under a scheme, every value quoted, absent ones left out.
 *
 * @param scheme - The scheme name.
 * @param challenge - The parameters to send.
 */
function write(scheme: string, challenge: Partial<DPoPChallenge>): string {
	let params: [string, string | null | undefined][] = [
		["realm", challenge.realm],
		["scope", challenge.scope?.length ? challenge.scope.join(" ") : null],
		["error", challenge.error],
		["error_description", challenge.errorDescription],
		["error_uri", challenge.errorUri?.href],
		["acr_values", challenge.acrValues?.length ? challenge.acrValues.join(" ") : null],
		["max_age", challenge.maxAge == null ? null : String(challenge.maxAge)],
		["algs", challenge.algs?.length ? challenge.algs.join(" ") : null],
		["resource_metadata", challenge.resourceMetadata?.href],
		...Object.entries(challenge.extensions ?? {}),
	];

	let written = params.flatMap(([name, value]) =>
		value === null || value === undefined ? [] : [`${name}=${quote(value)}`],
	);

	return written.length === 0 ? scheme : `${scheme} ${written.join(", ")}`;
}

/**
 * Writes one `Bearer` challenge. Parameters appear in RFC order (`realm`, `scope`,
 * `error`, `error_description`, `error_uri`, `acr_values`, `max_age`, `resource_metadata`)
 * with extensions after them, every value quoted; no parameters is the bare scheme.
 *
 * @param challenge - The parameters to send; absent, `null` and empty ones are left out.
 * @example
 * stringify({ error: "invalid_token", resourceMetadata: api.metadataUrl });
 * @example
 * stringify({ error: "insufficient_scope", scope: ["reports:write"] });
 * @example
 * stringify({ error: "insufficient_user_authentication", acrValues: ["mfa"], maxAge: 300 });
 */
export function stringify(challenge: Partial<BearerChallenge>): string {
	return write(BEARER.name, challenge);
}

/**
 * Writes one `DPoP` challenge, in the same order as {@link stringify} with `algs` before
 * `resource_metadata`.
 *
 * @param challenge - The parameters to send; absent, `null` and empty ones are left out.
 * @example
 * stringifyDPoP({ algs: ["ES256"], error: "use_dpop_nonce" });
 */
export function stringifyDPoP(challenge: Partial<DPoPChallenge>): string {
	return write(DPOP.name, challenge);
}

/**
 * Reads the `Bearer` challenges in a `WWW-Authenticate` value, which may list other
 * schemes beside them. A header naming no `Bearer` challenge is an empty list.
 *
 * @param header - The header value, as `headers.get("www-authenticate")` joins it.
 * @returns The challenges in header order, or the place the header broke RFC 9110's
 *   grammar or RFC 6750's rules.
 * @example
 * let challenges = parse(response.headers.get("www-authenticate") ?? "");
 */
export function parse(header: string): Result<BearerChallenge[], ChallengeParseError> {
	let challenges = parseScheme(header, BEARER);
	if (isFailure(challenges)) return challenges;
	return success(
		challenges.data.map(({ algs: _algs, ...challenge }) => challenge as BearerChallenge),
	);
}

/**
 * Reads the `DPoP` challenges in a `WWW-Authenticate` value, which may list other schemes
 * beside them, so a client finds the `use_dpop_nonce` refusal it retries.
 *
 * @param header - The header value, as `headers.get("www-authenticate")` joins it.
 * @returns The challenges in header order, or where the header broke the grammar.
 * @example
 * let [dpop] = unwrap(parseDPoP(response.headers.get("www-authenticate") ?? ""));
 */
export function parseDPoP(header: string): Result<DPoPChallenge[], ChallengeParseError> {
	return parseScheme(header, DPOP);
}
