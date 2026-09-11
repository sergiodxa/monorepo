/**
 * The request grammar `http.<verb>` and `browser.fetch.<verb>` both speak: a
 * target, an optional bare body, and the word-tagged options `on`, `headers`,
 * `form`, `json`, `text`, `bearer` and `basic`, in any order.
 *
 * It lives apart from either caller so the two namespaces cannot drift: a spec
 * that moves a request into the browser session changes the tool name and
 * nothing else.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { SpecError } from "../errors.js";
import type { ToolParam } from "../plugin.js";
import type { ToolArg, Value } from "../values.js";

import { ToolError } from "../errors.js";

/** The request verbs both namespaces expose; each issues its uppercased method. */
export const HTTP_VERBS = ["get", "post", "put", "patch", "delete"] as const;

/** One of the request verbs. */
export type HttpVerb = (typeof HTTP_VERBS)[number];

/** The word that selects which configured base a relative target resolves against. */
const BASE_WORD = "on";

/**
 * The words that tag an optional request argument. Each consumes the argument
 * that follows it: `headers`/`form` an object, `json` any value, `text` a
 * string.
 */
const OPTION_WORDS = ["headers", "form", "json", "text"] as const;

/**
 * The words that tag an authentication shortcut, filling the `Authorization`
 * header from author-provided values: `bearer` consumes one following value (the
 * token), `basic` consumes two (the username and password).
 */
const AUTH_WORDS = ["bearer", "basic"] as const;

/** Every accepted option word, for the unknown-word diagnostic. */
const ALL_OPTION_WORDS = [BASE_WORD, ...OPTION_WORDS, ...AUTH_WORDS] as const;

/** One of the option-tag words a call may use. */
type OptionWord = (typeof OPTION_WORDS)[number];

/** One of the authentication-tag words a call may use. */
type AuthWord = (typeof AUTH_WORDS)[number];

/**
 * How a call supplied credentials: a `bearer` token, or a `basic` user/password
 * pair. Both resolve to an `Authorization` header when the init is built.
 */
export type AuthSpec =
	| { kind: "bearer"; token: string }
	| { kind: "basic"; user: string; pass: string };

/** How a request body was supplied, carrying the raw value to encode. */
export interface BodySpec {
	/** The encoding the body will use. */
	kind: "json" | "form" | "text";
	/** The raw value as the spec wrote it, encoded per {@link kind}. */
	value: Value;
	/** How the body was written, for a conflict message. */
	source: "bare" | OptionWord;
}

/** The validated arguments of one request call. */
export interface RequestArguments {
	/** The target exactly as the spec wrote it: absolute, or `/path`. */
	target: string;
	/** The base `on "…"` selected; undefined when the call named none. */
	base: string | undefined;
	/** The optional request body; undefined when the call sent none. */
	body: BodySpec | undefined;
	/** The optional raw `headers` object; validated when the init is built. */
	headers: Value | undefined;
	/** The optional `bearer`/`basic` credential; undefined when the call sent none. */
	auth: AuthSpec | undefined;
}

/** Narrow a tool name to one of the request verbs. */
export function isHttpVerb(tool: string): tool is HttpVerb {
	return (HTTP_VERBS as readonly string[]).includes(tool);
}

/**
 * The declared parameters of one request tool, which both namespaces publish
 * verbatim so their documentation cannot disagree with their behavior.
 *
 * @returns The parameter list, in positional order.
 */
export function requestParams(): ToolParam[] {
	return [
		{
			name: "target",
			kind: "value",
			required: true,
			summary: "An absolute URL, or a `/path` resolved against a configured base.",
		},
		{
			name: "body",
			kind: "value",
			required: false,
			summary: "Optional bare body: a string is sent as text/plain, any other value as JSON.",
		},
		{
			name: "on",
			kind: "word",
			required: false,
			summary: "Tag before the name of the base a relative target resolves against.",
		},
		{
			name: "headers",
			kind: "word",
			required: false,
			summary:
				"Tag before an object of header name/value pairs; an explicit content-type overrides the body's.",
		},
		{
			name: "form",
			kind: "word",
			required: false,
			summary: "Tag before an object sent as an application/x-www-form-urlencoded body.",
		},
		{
			name: "json",
			kind: "word",
			required: false,
			summary: "Tag before any value sent as an application/json body.",
		},
		{
			name: "text",
			kind: "word",
			required: false,
			summary: "Tag before a string sent as a text/plain body.",
		},
		{
			name: "bearer",
			kind: "word",
			required: false,
			summary: "Tag before a token string, sent as an Authorization: Bearer header.",
		},
		{
			name: "basic",
			kind: "word",
			required: false,
			summary: "Tag before a username and a password, sent as an Authorization: Basic header.",
		},
	];
}

/**
 * Validate the raw tool arguments into a target, a base name, an optional
 * body, headers, and an auth credential. The word-tagged options may follow in
 * any order, but each of body, `on`, `headers`, and auth is accepted once.
 *
 * @param label - The qualified tool name, which every message names.
 * @param args - The call's raw arguments.
 * @returns The validated arguments, or the misuse that made them unreadable.
 */
export function readRequestArgs(
	label: string,
	args: ToolArg[],
): Result<RequestArguments, SpecError> {
	let first = args[0];
	if (first === undefined) {
		return failure(new ToolError(`${label} requires a URL; got no arguments`));
	}
	if (first.kind !== "value" || typeof first.value !== "string") {
		return failure(new ToolError(`${label} requires its first argument to be a URL string`));
	}
	let target = first.value;
	let base: string | undefined;
	let body: BodySpec | undefined;
	let headers: Value | undefined;
	let auth: AuthSpec | undefined;
	let index = 1;
	while (index < args.length) {
		let arg = args[index];
		if (arg === undefined) break;
		if (arg.kind === "word") {
			let word = arg.word;
			if (word === BASE_WORD) {
				if (base !== undefined) {
					return failure(new ToolError(`${label} accepts at most one \`on\` base selection`));
				}
				let named = optionString(label, word, args[index + 1], "base name");
				if (isFailure(named)) return named;
				base = named.data;
				index += 2;
				continue;
			}
			if (isAuthWord(word)) {
				if (auth !== undefined) {
					return failure(
						new ToolError(
							`${label} accepts at most one auth option (bearer or basic), but got more than one`,
						),
					);
				}
				let parsed = readAuth(label, word, args, index);
				if (isFailure(parsed)) return parsed;
				auth = parsed.data.auth;
				index += parsed.data.consumed;
				continue;
			}
			if (!isOptionWord(word)) {
				return failure(
					new ToolError(
						`${label} got the unknown option word "${word}"; expected one of ${ALL_OPTION_WORDS.join(", ")}`,
					),
				);
			}
			let next = args[index + 1];
			if (next === undefined || next.kind !== "value") {
				return failure(new ToolError(`${label} option "${word}" needs a value argument after it`));
			}
			if (word === "headers") {
				if (headers !== undefined) {
					return failure(new ToolError(`${label} accepts at most one headers block`));
				}
				headers = next.value;
			} else {
				let incoming: BodySpec = { kind: word, value: next.value, source: word };
				if (body !== undefined) return failure(twoBodies(label, body, incoming));
				body = incoming;
			}
			index += 2;
			continue;
		}
		let incoming: BodySpec =
			typeof arg.value === "string"
				? { kind: "text", value: arg.value, source: "bare" }
				: { kind: "json", value: arg.value, source: "bare" };
		if (body !== undefined) return failure(twoBodies(label, body, incoming));
		body = incoming;
		index += 1;
	}
	return success({ target, base, body, headers, auth });
}

/**
 * Read a `bearer` or `basic` auth option starting at its tag: `bearer`
 * consumes one following string (the token), `basic` two (the username and
 * password), reporting how many arguments, tag included, it consumed.
 */
function readAuth(
	label: string,
	word: AuthWord,
	args: ToolArg[],
	index: number,
): Result<{ auth: AuthSpec; consumed: number }, SpecError> {
	if (word === "bearer") {
		let token = optionString(label, "bearer", args[index + 1], "token");
		if (isFailure(token)) return token;
		return success({ auth: { kind: "bearer", token: token.data }, consumed: 2 });
	}
	let user = optionString(label, "basic", args[index + 1], "username");
	if (isFailure(user)) return user;
	let pass = optionString(label, "basic", args[index + 2], "password");
	if (isFailure(pass)) return pass;
	return success({ auth: { kind: "basic", user: user.data, pass: pass.data }, consumed: 3 });
}

/** Read one word-tagged argument as a required string, or a tool error. */
function optionString(
	label: string,
	word: string,
	arg: ToolArg | undefined,
	role: string,
): Result<string, SpecError> {
	if (arg === undefined || arg.kind !== "value" || typeof arg.value !== "string") {
		return failure(
			new ToolError(`${label} option "${word}" needs a ${role} string argument after it`),
		);
	}
	return success(arg.value);
}

/** Narrow a bare-word argument to one of the option tags. */
function isOptionWord(word: string): word is OptionWord {
	return (OPTION_WORDS as readonly string[]).includes(word);
}

/** Narrow a bare-word argument to one of the auth tags. */
function isAuthWord(word: string): word is AuthWord {
	return (AUTH_WORDS as readonly string[]).includes(word);
}

/** The tool error raised when a call supplies more than one request body. */
function twoBodies(label: string, existing: BodySpec, incoming: BodySpec): ToolError {
	return new ToolError(
		`${label} accepts one request body, but got ${bodyLabel(existing.source)} and ${bodyLabel(incoming.source)}`,
	);
}

/** How a body reads in a conflict message: the bare body, or a tagged one. */
function bodyLabel(source: "bare" | OptionWord): string {
	return source === "bare" ? "a bare body" : `a \`${source}\` body`;
}

/** A serialized request body and the content type it implies, if any. */
interface EncodedBody {
	/** The serialized body string, or undefined when the call sent none. */
	body: string | undefined;
	/** The default content type for this body, before author headers apply. */
	contentType: string | undefined;
}

/**
 * Build the fetch init for a verb and the call's options, layered so an
 * explicit `content-type` overrides the body's default and an explicit
 * `authorization` overrides `bearer`/`basic`.
 *
 * @param label - The qualified tool name, which every message names.
 * @param verb - The request verb, uppercased into the method.
 * @param request - The call's validated arguments.
 * @returns The init to hand `fetch`, or the misuse that made one impossible.
 */
export function buildRequestInit(
	label: string,
	verb: HttpVerb,
	request: RequestArguments,
): Result<RequestInit, SpecError> {
	let encoded = encodeBody(label, request.body);
	if (isFailure(encoded)) return encoded;
	let finalHeaders: Record<string, string> = {};
	if (encoded.data.contentType !== undefined) {
		finalHeaders["content-type"] = encoded.data.contentType;
	}
	if (request.auth !== undefined) {
		let authorization = authorizationHeader(label, request.auth);
		if (isFailure(authorization)) return authorization;
		finalHeaders["authorization"] = authorization.data;
	}
	if (request.headers !== undefined) {
		let coerced = coerceFields(label, "headers", request.headers);
		if (isFailure(coerced)) return coerced;
		for (let [name, value] of Object.entries(coerced.data)) {
			finalHeaders[name.toLowerCase()] = value;
		}
	}
	let init: RequestInit = { method: verb.toUpperCase() };
	if (encoded.data.body !== undefined) init.body = encoded.data.body;
	if (Object.keys(finalHeaders).length > 0) init.headers = finalHeaders;
	return success(init);
}

/**
 * Render an auth spec into its `Authorization` header value: `bearer`
 * becomes `Bearer <token>`; `basic` becomes `Basic <base64(user:pass)>` per
 * RFC 7617, reporting a credential outside Latin-1 as a tool error.
 */
function authorizationHeader(label: string, auth: AuthSpec): Result<string, SpecError> {
	if (auth.kind === "bearer") return success(`Bearer ${auth.token}`);
	try {
		return success(`Basic ${btoa(`${auth.user}:${auth.pass}`)}`);
	} catch {
		return failure(
			new ToolError(
				`${label} basic credentials must be Latin-1 (base64-encodable); got a value outside that range`,
			),
		);
	}
}

/**
 * Serialize a body spec into its wire string and default content type:
 * `text` verbatim as text/plain, `form` urlencoded via URLSearchParams as
 * application/x-www-form-urlencoded, and `json` as JSON of any value.
 */
function encodeBody(label: string, body: BodySpec | undefined): Result<EncodedBody, SpecError> {
	if (body === undefined) return success({ body: undefined, contentType: undefined });
	if (body.kind === "text") {
		if (typeof body.value !== "string") {
			return failure(new ToolError(`${label} text body must be a string`));
		}
		return success({ body: body.value, contentType: "text/plain" });
	}
	if (body.kind === "form") {
		let coerced = coerceFields(label, "form", body.value);
		if (isFailure(coerced)) return coerced;
		return success({
			body: new URLSearchParams(coerced.data).toString(),
			contentType: "application/x-www-form-urlencoded",
		});
	}
	return success({ body: JSON.stringify(body.value), contentType: "application/json" });
}

/**
 * Coerce a `headers` or `form` object into a string map: string values pass
 * through, numbers and booleans stringify, and a non-object container or a
 * null/array/object field value is a tool error naming the offending field.
 */
function coerceFields(
	label: string,
	kind: string,
	value: Value,
): Result<Record<string, string>, SpecError> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return failure(new ToolError(`${label} ${kind} must be an object of string values`));
	}
	let fields: Record<string, string> = {};
	for (let [key, raw] of Object.entries(value)) {
		if (typeof raw === "string") fields[key] = raw;
		else if (typeof raw === "number" || typeof raw === "boolean") fields[key] = String(raw);
		else {
			return failure(
				new ToolError(`${label} ${kind} field "${key}" must be a string, number, or boolean`),
			);
		}
	}
	return success(fields);
}
