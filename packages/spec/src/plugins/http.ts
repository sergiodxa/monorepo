/**
 * The built-in `http` plugin: `get`/`post`/`put`/`patch`/`delete` tools that
 * issue real requests through the global fetch. Every tool requires the `net`
 * grant, checked against the URL's host and port, and URLs must be absolute
 * because v1 ships no environments mechanism to bind a base URL against.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, isFailure, success } from "@pkg/result";

import type { SpecError } from "../errors";
import type { Plugin, ToolContext, ToolDescriptor } from "../plugin";
import type { ToolArg, Value, ValueObject } from "../values";

import { ToolError } from "../errors";

/** The request tools the plugin exposes; each issues its uppercased method. */
const HTTP_VERBS = ["get", "post", "put", "patch", "delete"] as const;

/** One of the plugin's request tool names. */
type HttpVerb = (typeof HTTP_VERBS)[number];

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
 * grant, taking an absolute URL and an optional body value.
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
				summary: "Optional request body: a string is sent as text/plain, any other value as JSON.",
			},
		],
	};
}

/** Narrow a tool name to one of the plugin's request verbs. */
function isVerb(tool: string): tool is HttpVerb {
	return (HTTP_VERBS as readonly string[]).includes(tool);
}

/**
 * Run one request tool end to end: validate the arguments, require an
 * absolute http(s) URL, pass the permission gate for the URL's host and
 * port, then fetch and shape the response.
 */
async function request(
	verb: HttpVerb,
	args: ToolArg[],
	context: ToolContext,
): Promise<Result<Value, SpecError>> {
	let parsedArgs = readArgs(verb, args);
	if (isFailure(parsedArgs)) return parsedArgs;
	let target = parseTarget(verb, parsedArgs.data.url);
	if (isFailure(target)) return target;
	let allowed = context.permissions.checkNet(target.data.hostname, portOf(target.data));
	if (isFailure(allowed)) return allowed;
	return await perform(verb, target.data, parsedArgs.data.body);
}

/** The validated positional arguments of one request tool call. */
interface RequestArguments {
	/** The URL exactly as the spec wrote it. */
	url: string;
	/** The optional body value; undefined when the call sent none. */
	body: Value | undefined;
}

/**
 * Validate the raw tool arguments: a required URL string, an optional body
 * value, nothing else — words are meaningless to HTTP tools and rejected.
 */
function readArgs(verb: HttpVerb, args: ToolArg[]): Result<RequestArguments, SpecError> {
	for (let arg of args) {
		if (arg.kind === "word") {
			return failure(
				new ToolError(
					`http.${verb} accepts value arguments only; the word "${arg.word}" is not one`,
				),
			);
		}
	}
	if (args.length === 0 || args.length > 2) {
		return failure(
			new ToolError(`http.${verb} takes a URL and an optional body; got ${args.length} arguments`),
		);
	}
	let first = args[0];
	if (first?.kind !== "value" || typeof first.value !== "string") {
		return failure(new ToolError(`http.${verb} requires its first argument to be a URL string`));
	}
	let second = args[1];
	let body = second !== undefined && second.kind === "value" ? second.value : undefined;
	return success({ url: first.value, body });
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
 */
async function perform(
	verb: HttpVerb,
	url: URL,
	body: Value | undefined,
): Promise<Result<Value, SpecError>> {
	let response: Response;
	let text: string;
	try {
		response = await fetch(url, buildInit(verb, body));
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

/**
 * Build the fetch init for a verb and optional body: strings travel as
 * text/plain, every other value is serialized as JSON with the matching
 * content type; an absent body sets neither.
 */
function buildInit(verb: HttpVerb, body: Value | undefined): RequestInit {
	let method = verb.toUpperCase();
	if (body === undefined) return { method };
	if (typeof body === "string") {
		return { method, body, headers: { "content-type": "text/plain" } };
	}
	return { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } };
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
