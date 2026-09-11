/**
 * The built-in `http` plugin: `get`/`post`/`put`/`patch`/`delete` tools that
 * issue real requests through the global fetch. A target is either an absolute
 * URL or a `/path` resolved against a configured base, which `on "web"`
 * selects; every request then checks the `net` grant against the *resolved*
 * host and port, so the grant a denial suggests is the one that would work.
 * The rest of the call is the shared request grammar (`request-options.ts`).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { SpecError } from "../errors.js";
import type { PermissionSet } from "../permissions.js";
import type { Plugin, ToolContext, ToolDescriptor } from "../plugin.js";
import type { ToolArg, Value, ValueObject } from "../values.js";

import { ToolError } from "../errors.js";

import type { HttpVerb } from "./request-options.js";

import {
	HTTP_VERBS,
	buildRequestInit,
	isHttpVerb,
	readRequestArgs,
	requestParams,
} from "./request-options.js";

/** How many redirect hops one request may follow before it is refused. */
const MAX_REDIRECTS = 10;

/**
 * Create the built-in `http` plugin (namespace `"http"`). Tools take a target
 * and optional body, resolve the target through the run's bases, check the
 * `net` permission for the resolved host and port, then fetch.
 */
export function createHttpPlugin(): Plugin {
	return {
		namespace: "http",
		describe() {
			return HTTP_VERBS.map((verb) => describeVerb(verb));
		},
		async call(tool, args, context) {
			if (!isHttpVerb(tool)) {
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
 * grant, over the shared request grammar.
 */
function describeVerb(verb: HttpVerb): ToolDescriptor {
	return {
		name: verb,
		summary: `Send an HTTP ${verb.toUpperCase()} request to a URL or a base-relative path.`,
		kind: "action",
		requires: "net",
		params: requestParams(),
	};
}

/**
 * Run one request tool end to end: validate the arguments, reject a body on
 * GET, resolve the target, and encode the request before checking the `net`
 * permission — that check gates last, so a malformed call never reaches the
 * network.
 */
async function request(
	verb: HttpVerb,
	args: ToolArg[],
	context: ToolContext,
): Promise<Result<Value, SpecError>> {
	let label = `http.${verb}`;
	let parsedArgs = readRequestArgs(label, args);
	if (isFailure(parsedArgs)) return parsedArgs;
	if (parsedArgs.data.body !== undefined && verb === "get") {
		return failure(
			new ToolError(`http.get cannot send a request body; a GET request carries no body`),
		);
	}
	let target = resolveTarget(label, parsedArgs.data.target, parsedArgs.data.base, context);
	if (isFailure(target)) return target;
	let init = buildRequestInit(label, verb, parsedArgs.data);
	if (isFailure(init)) return init;
	let allowed = context.permissions.checkNet(target.data.hostname, portOf(target.data));
	if (isFailure(allowed)) return allowed;
	return await perform(verb, target.data, init.data, context.permissions);
}

/**
 * Resolve a target through the run's bases and require the result to be an
 * http(s) URL, which is the only scheme this plugin can reach.
 */
function resolveTarget(
	label: string,
	target: string,
	base: string | undefined,
	context: ToolContext,
): Result<URL, SpecError> {
	let resolved = context.bases.resolve(target, base);
	if (isFailure(resolved)) return resolved;
	let url = resolved.data;
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return failure(new ToolError(`${label} supports http(s) URLs only; got "${url.href}"`));
	}
	return success(url);
}

/** The port the request will reach: the URL's own, or the scheme default (80/443). */
function portOf(url: URL): number {
	if (url.port !== "") return Number(url.port);
	return url.protocol === "https:" ? 443 : 80;
}

/**
 * Perform the fetch, following redirects by hand rather than through fetch's
 * own handling, so each redirect target passes the same `net` check as the
 * original URL before any request reaches it.
 *
 * @returns Success shaped as `{ status, ok, headers, text, json }` from the
 * final response, or a permission-denied or tool-error failure.
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
			new ToolError(`http.${verb} supports http(s) URLs only; a redirect pointed to "${url.href}"`),
		);
	}
	return success(url);
}

/** Credential headers the fetch standard strips on a cross-origin redirect. */
const CROSS_ORIGIN_STRIPPED_HEADERS = ["authorization", "cookie", "proxy-authorization"];

/**
 * The init for the next hop, per the fetch standard's method rewrite: 303,
 * or a non-GET 301/302, switches to GET and drops the body; other statuses
 * keep the init but strip credential headers when the hop crosses origins.
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
