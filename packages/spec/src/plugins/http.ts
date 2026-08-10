/**
 * The built-in `http` plugin: `get`/`post`/`put`/`patch`/`delete` tools that
 * issue real requests through the global fetch. Every tool requires the `net`
 * grant, checked against the URL's host and port, and URLs must be absolute
 * because v1 ships no environments mechanism to bind a base URL against. Beyond
 * the URL, calls may carry word-tagged options — `headers { … }`, `form { … }`,
 * `json …`, `text "…"` — in any order, alongside the back-compatible bare body.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, isFailure, success } from "@pkg/result";

import type { SpecError } from "../errors";
import type { PermissionSet } from "../permissions";
import type { Plugin, ToolContext, ToolDescriptor } from "../plugin";
import type { ToolArg, Value, ValueObject } from "../values";

import { ToolError } from "../errors";

/** The request tools the plugin exposes; each issues its uppercased method. */
const HTTP_VERBS = ["get", "post", "put", "patch", "delete"] as const;

/**
 * The words that tag an optional request argument. Each consumes the argument
 * that follows it: `headers`/`form` an object, `json` any value, `text` a
 * string.
 */
const OPTION_WORDS = ["headers", "form", "json", "text"] as const;

/** How many redirect hops one request may follow before it is refused. */
const MAX_REDIRECTS = 10;

/** One of the plugin's request tool names. */
type HttpVerb = (typeof HTTP_VERBS)[number];

/** One of the option-tag words a call may use. */
type OptionWord = (typeof OPTION_WORDS)[number];

/** How a request body was supplied, carrying the raw value to encode. */
interface BodySpec {
	/** The encoding the body will use. */
	kind: "json" | "form" | "text";
	/** The raw value as the spec wrote it, encoded per {@link kind}. */
	value: Value;
	/** How the body was written, for a conflict message. */
	source: "bare" | OptionWord;
}

/**
 * Create the built-in `http` plugin (namespace `"http"`). Its tools take an
 * absolute URL and an optional body, pass the runtime's `net` permission
 * check for the URL's host and port, and perform the request with the global
 * fetch. HTTP error statuses are result values; only network-level failures
 * (and misuse) are errors.
 */
export function createHttpPlugin(): Plugin {
	return {
		namespace: "http",
		describe() {
			return HTTP_VERBS.map((verb) => describeVerb(verb));
		},
		async call(tool, args, context) {
			if (!isVerb(tool)) {
				return failure(
					new ToolError(`http has no tool "${tool}"; available tools: ${HTTP_VERBS.join(", ")}`),
				);
			}
			return await request(tool, args, context);
		},
	};
}

/**
 * Build the descriptor of one request tool: an action requiring the `net`
 * grant, taking an absolute URL, an optional bare body, and the word-tagged
 * `headers`/`form`/`json`/`text` options that may follow in any order.
 */
function describeVerb(verb: HttpVerb): ToolDescriptor {
	return {
		name: verb,
		summary: `Send an HTTP ${verb.toUpperCase()} request to an absolute URL.`,
		kind: "action",
		requires: "net",
		params: [
			{
				name: "url",
				kind: "value",
				required: true,
				summary: "Absolute URL of the request; v1 has no base-URL binding.",
			},
			{
				name: "body",
				kind: "value",
				required: false,
				summary: "Optional bare body: a string is sent as text/plain, any other value as JSON.",
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
		],
	};
}

/** Narrow a tool name to one of the plugin's request verbs. */
function isVerb(tool: string): tool is HttpVerb {
	return (HTTP_VERBS as readonly string[]).includes(tool);
}

/**
 * Run one request tool end to end: parse the URL and its optional
 * word-tagged arguments, reject a body on GET, encode the body and headers,
 * require an absolute http(s) URL, pass the permission gate for the URL's
 * host and port, then fetch and shape the response. The permission check is
 * the last guard before the fetch, so no malformed call ever reaches the
 * network.
 */
async function request(
	verb: HttpVerb,
	args: ToolArg[],
	context: ToolContext,
): Promise<Result<Value, SpecError>> {
	let parsedArgs = readArgs(verb, args);
	if (isFailure(parsedArgs)) return parsedArgs;
	if (parsedArgs.data.body !== undefined && verb === "get") {
		return failure(
			new ToolError(`http.get cannot send a request body; a GET request carries no body`),
		);
	}
	let target = parseTarget(verb, parsedArgs.data.url);
	if (isFailure(target)) return target;
	let init = buildInit(verb, parsedArgs.data.body, parsedArgs.data.headers);
	if (isFailure(init)) return init;
	let allowed = context.permissions.checkNet(target.data.hostname, portOf(target.data));
	if (isFailure(allowed)) return allowed;
	return await perform(verb, target.data, init.data, context.permissions);
}

/** The validated arguments of one request tool call. */
interface RequestArguments {
	/** The URL exactly as the spec wrote it. */
	url: string;
	/** The optional request body; undefined when the call sent none. */
	body: BodySpec | undefined;
	/** The optional raw `headers` object; validated when the init is built. */
	headers: Value | undefined;
}

/**
 * Validate the raw tool arguments: a required URL string, then any mix of
 * word-tagged options (`headers`/`form`/`json`/`text`, each consuming the
 * next argument) and a single back-compatible bare body (a string is text,
 * any other value is JSON). At most one body and one `headers` block; a
 * second body, a second `headers`, an unknown word, or a word missing its
 * value is a tool error.
 */
function readArgs(verb: HttpVerb, args: ToolArg[]): Result<RequestArguments, SpecError> {
	let first = args[0];
	if (first === undefined) {
		return failure(new ToolError(`http.${verb} requires a URL; got no arguments`));
	}
	if (first.kind !== "value" || typeof first.value !== "string") {
		return failure(new ToolError(`http.${verb} requires its first argument to be a URL string`));
	}
	let url = first.value;
	let body: BodySpec | undefined;
	let headers: Value | undefined;
	let index = 1;
	while (index < args.length) {
		let arg = args[index];
		if (arg === undefined) break;
		if (arg.kind === "word") {
			let word = arg.word;
			if (!isOptionWord(word)) {
				return failure(
					new ToolError(
						`http.${verb} got the unknown option word "${word}"; expected one of ${OPTION_WORDS.join(", ")}`,
					),
				);
			}
			let next = args[index + 1];
			if (next === undefined || next.kind !== "value") {
				return failure(
					new ToolError(`http.${verb} option "${word}" needs a value argument after it`),
				);
			}
			if (word === "headers") {
				if (headers !== undefined) {
					return failure(new ToolError(`http.${verb} accepts at most one headers block`));
				}
				headers = next.value;
			} else {
				let incoming: BodySpec = { kind: word, value: next.value, source: word };
				if (body !== undefined) return failure(twoBodies(verb, body, incoming));
				body = incoming;
			}
			index += 2;
			continue;
		}
		let incoming: BodySpec =
			typeof arg.value === "string"
				? { kind: "text", value: arg.value, source: "bare" }
				: { kind: "json", value: arg.value, source: "bare" };
		if (body !== undefined) return failure(twoBodies(verb, body, incoming));
		body = incoming;
		index += 1;
	}
	return success({ url, body, headers });
}

/** Narrow a bare-word argument to one of the option tags. */
function isOptionWord(word: string): word is OptionWord {
	return (OPTION_WORDS as readonly string[]).includes(word);
}

/** The tool error raised when a call supplies more than one request body. */
function twoBodies(verb: HttpVerb, existing: BodySpec, incoming: BodySpec): ToolError {
	return new ToolError(
		`http.${verb} accepts one request body, but got ${bodyLabel(existing.source)} and ${bodyLabel(incoming.source)}`,
	);
}

/** How a body reads in a conflict message: the bare body, or a tagged one. */
function bodyLabel(source: "bare" | OptionWord): string {
	return source === "bare" ? "a bare body" : `a \`${source}\` body`;
}

/**
 * Parse the spec-written URL, requiring an absolute http(s) URL. Relative
 * URLs are refused with the v1 rationale: there is no environments mechanism
 * to bind a base URL against yet.
 */
function parseTarget(verb: HttpVerb, raw: string): Result<URL, SpecError> {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return failure(
			new ToolError(
				`http.${verb} received the relative URL "${raw}"; v1 has no environments mechanism to bind a base URL against, so URLs must be absolute (see docs/adr/spec/ADR-008-environments-and-compatibility.md)`,
			),
		);
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return failure(new ToolError(`http.${verb} supports absolute http(s) URLs only; got "${raw}"`));
	}
	return success(url);
}

/** The port the request will reach: the URL's own, or the scheme default (80/443). */
function portOf(url: URL): number {
	if (url.port !== "") return Number(url.port);
	return url.protocol === "https:" ? 443 : 80;
}

/**
 * Perform the fetch and shape the response into the tool's result value:
 * `{ status, ok, headers, text, json }`, where `headers` maps lowercased
 * names to values and `json` is the parsed body when parseable, else null.
 * Redirects are followed by hand, never by fetch: every redirect target is a
 * new network destination and must pass the same `net` check as the
 * spec-written URL — otherwise a granted host could bounce the request to a
 * host the caller never granted. The prebuilt `init` (method, body, and any
 * author headers) carries forward on a body-preserving redirect, except the
 * credential headers (`Authorization`/`Cookie`/`Proxy-Authorization`), which
 * are stripped when the hop crosses origins so they never leak to another
 * host; a redirect that rewrites the method to GET drops the body and all its
 * headers with it.
 */
async function perform(
	verb: HttpVerb,
	url: URL,
	init: RequestInit,
	permissions: PermissionSet,
): Promise<Result<Value, SpecError>> {
	let current = url;
	for (let redirects = 0; ; redirects++) {
		let response: Response;
		try {
			response = await fetch(current, { ...init, redirect: "manual" });
		} catch (error) {
			return failure(
				new ToolError(`http.${verb} request to ${current.href} failed: ${describeFailure(error)}`),
			);
		}
		let location = response.headers.get("location");
		if (!isRedirectStatus(response.status) || location === null) {
			return await shapeResponse(verb, current, response);
		}
		if (redirects >= MAX_REDIRECTS) {
			return failure(
				new ToolError(
					`http.${verb} request to ${url.href} followed more than ${MAX_REDIRECTS} redirects`,
				),
			);
		}
		let next = parseLocation(verb, location, current);
		if (isFailure(next)) return next;
		let allowed = permissions.checkNet(next.data.hostname, portOf(next.data));
		if (isFailure(allowed)) return allowed;
		init = redirectInit(init, response.status, current, next.data);
		current = next.data;
	}
}

/**
 * Shape one final (non-redirect) response into the tool's result value.
 */
async function shapeResponse(
	verb: HttpVerb,
	url: URL,
	response: Response,
): Promise<Result<Value, SpecError>> {
	let text: string;
	try {
		text = await response.text();
	} catch (error) {
		return failure(
			new ToolError(`http.${verb} request to ${url.href} failed: ${describeFailure(error)}`),
		);
	}
	let headers: ValueObject = {};
	for (let [name, value] of response.headers) headers[name.toLowerCase()] = value;
	return success({
		status: response.status,
		ok: response.ok,
		headers,
		text,
		json: parseJson(text),
	});
}

/** The redirect statuses a default fetch would transparently follow. */
function isRedirectStatus(status: number): boolean {
	return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

/**
 * Resolve a `Location` header against the URL that sent it, requiring the
 * result to stay an http(s) URL.
 */
function parseLocation(verb: HttpVerb, location: string, base: URL): Result<URL, SpecError> {
	let url: URL;
	try {
		url = new URL(location, base);
	} catch {
		return failure(
			new ToolError(`http.${verb} received an unparsable redirect Location: "${location}"`),
		);
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return failure(
			new ToolError(
				`http.${verb} supports absolute http(s) URLs only; a redirect pointed to "${url.href}"`,
			),
		);
	}
	return success(url);
}

/** Credential headers the fetch standard strips on a cross-origin redirect. */
const CROSS_ORIGIN_STRIPPED_HEADERS = ["authorization", "cookie", "proxy-authorization"];

/**
 * The init for the next hop, per the fetch standard's method rewrite: a 303 —
 * and a 301/302 answering a non-GET — switches to GET and drops the body (and
 * the author headers that rode with it); a body-preserving redirect (307/308,
 * or 301/302 on a GET) keeps the init, but strips the credential headers
 * (`Authorization`/`Cookie`/`Proxy-Authorization`) when the hop crosses
 * origins, matching fetch so a credential set for one host never rides along
 * to a different one.
 */
function redirectInit(init: RequestInit, status: number, from: URL, to: URL): RequestInit {
	if (status === 303 || ((status === 301 || status === 302) && init.method !== "GET")) {
		return { method: "GET" };
	}
	if (from.origin === to.origin) return init;
	return stripCredentialHeaders(init);
}

/**
 * Drop the credential headers the fetch standard removes on a cross-origin
 * redirect. The prebuilt init's header names are already lowercased, but the
 * comparison lowercases too so the guard holds regardless.
 */
function stripCredentialHeaders(init: RequestInit): RequestInit {
	if (init.headers === undefined) return init;
	let kept: Record<string, string> = {};
	for (let [name, value] of Object.entries(init.headers as Record<string, string>)) {
		if (!CROSS_ORIGIN_STRIPPED_HEADERS.includes(name.toLowerCase())) kept[name] = value;
	}
	if (Object.keys(kept).length === Object.keys(init.headers as Record<string, string>).length) {
		return init;
	}
	let { headers: _stripped, ...rest } = init;
	return Object.keys(kept).length === 0 ? rest : { ...rest, headers: kept };
}

/**
 * Build the fetch init for a verb, its optional body, and its optional
 * `headers` object. The body picks a default content type (text/plain,
 * application/json, or application/x-www-form-urlencoded); the author's
 * headers are then layered on top with lowercased names, so an explicit
 * `content-type` overrides the body's default. An absent body sets no body
 * and no default content type.
 */
function buildInit(
	verb: HttpVerb,
	body: BodySpec | undefined,
	headers: Value | undefined,
): Result<RequestInit, SpecError> {
	let encoded = encodeBody(verb, body);
	if (isFailure(encoded)) return encoded;
	let finalHeaders: Record<string, string> = {};
	if (encoded.data.contentType !== undefined) {
		finalHeaders["content-type"] = encoded.data.contentType;
	}
	if (headers !== undefined) {
		let coerced = coerceFields(verb, "headers", headers);
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

/** A serialized request body and the content type it implies, if any. */
interface EncodedBody {
	/** The serialized body string, or undefined when the call sent none. */
	body: string | undefined;
	/** The default content type for this body, before author headers apply. */
	contentType: string | undefined;
}

/**
 * Serialize a body spec into its wire string and default content type:
 * `text` verbatim as text/plain (a non-string value is a tool error), `form`
 * urlencoded via URLSearchParams as application/x-www-form-urlencoded, and
 * `json` as JSON of any value as application/json. An absent body yields
 * neither.
 */
function encodeBody(verb: HttpVerb, body: BodySpec | undefined): Result<EncodedBody, SpecError> {
	if (body === undefined) return success({ body: undefined, contentType: undefined });
	if (body.kind === "text") {
		if (typeof body.value !== "string") {
			return failure(new ToolError(`http.${verb} text body must be a string`));
		}
		return success({ body: body.value, contentType: "text/plain" });
	}
	if (body.kind === "form") {
		let coerced = coerceFields(verb, "form", body.value);
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
	verb: HttpVerb,
	label: string,
	value: Value,
): Result<Record<string, string>, SpecError> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return failure(new ToolError(`http.${verb} ${label} must be an object of string values`));
	}
	let fields: Record<string, string> = {};
	for (let [key, raw] of Object.entries(value)) {
		if (typeof raw === "string") fields[key] = raw;
		else if (typeof raw === "number" || typeof raw === "boolean") fields[key] = String(raw);
		else {
			return failure(
				new ToolError(`http.${verb} ${label} field "${key}" must be a string, number, or boolean`),
			);
		}
	}
	return success(fields);
}

/** Parse a response body as JSON, yielding null when it is not valid JSON. */
function parseJson(text: string): Value {
	try {
		return JSON.parse(text) as Value;
	} catch {
		return null;
	}
}

/** Render an unknown thrown value into a one-line failure description. */
function describeFailure(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}
