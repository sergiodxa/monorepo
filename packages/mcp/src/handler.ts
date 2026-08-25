/**
 * The Streamable HTTP transport and method dispatch: one request in, one response out,
 * with no session, no handshake, and nothing carried between calls.
 *
 * Revision `2026-07-28` made MCP stateless, which is what lets this be an ordinary remix
 * action rather than a connection-holding process. `fetch` accepts a `RequestContext`, so
 * an application's existing middleware — session, logger, database, authentication — is the
 * middleware for its MCP surface too, and a handler reads what that middleware set with the
 * same `ctx.get()` every other handler in the app uses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@pkg/result";
import { createMultiMatcher } from "remix/route-pattern/match";

import type { AnyRequestContext, ResourceContext, ToolContext } from "./context";
import type { JsonRpcResponse, RequestId } from "./jsonrpc";
import type {
	ReadResult,
	Resource,
	ResourceAction,
	ResourceContents,
	ResourceListing,
} from "./resources";
import type { ObjectSchema } from "./schema";
import type {
	Action,
	ActionOrHandler,
	CallToolResult,
	Controller,
	Tool,
	ToolGroup,
	ToolHandler,
	ToolMiddleware,
} from "./tools";

import {
	contextFor,
	CurrentResource,
	CurrentTool,
	ResourceUri,
	ResourceVariables,
	ToolInput,
} from "./context";
import { ForbiddenError, InvalidArgumentsError, ToolError } from "./errors";
import { ErrorCode, isJsonRpcMessage, isRequest, reply, replyError } from "./jsonrpc";
import {
	decodeHeaderValue,
	isMetadataProblem,
	isSupportedVersion,
	METHOD_HEADER,
	MetaKey,
	NAME_HEADER,
	PROTOCOL_VERSION_HEADER,
	readRequestMetadata,
	SUPPORTED_PROTOCOL_VERSIONS,
} from "./protocol";
import { toContents } from "./resources";
import { isTool } from "./tools";
import { validateArguments } from "./validate";

/** How results advertise their own cacheability. */
export type CacheScope = "public" | "private";

/** How long a client may cache a list when the application does not say. */
const DEFAULT_LIST_TTL_MS = 60_000;

/**
 * Which body field each method's `Mcp-Name` header mirrors.
 *
 * A method absent from here carries no `Mcp-Name`, so nothing is required and nothing is
 * compared. Adding `prompts/get` later is one entry.
 */
const NAME_SOURCE: Record<string, "name" | "uri"> = {
	"tools/call": "name",
	"resources/read": "uri",
};

/** How to build an MCP handler. */
export interface HandlerOptions {
	/** Stable identifier, conventionally the product or worker name. */
	name: string;
	/** Human-readable name for a client that renders one. */
	title?: string;
	/** The server's own version, not the protocol's. */
	version: string;
	/**
	 * How to use this server as a whole, delivered with `server/discover`.
	 *
	 * A client may put it in the model's system prompt, so it is the place for what no single
	 * tool or resource description can say.
	 */
	instructions?: string;
	/**
	 * Middleware wrapping every tool call, before any group or action middleware.
	 *
	 * For request-level concerns use `remix/router` middleware on the route instead; this
	 * slot exists for what has to see a tool's result, such as metering.
	 */
	toolMiddleware?: ToolMiddleware[];
	/**
	 * How long a client may cache a list result, in milliseconds.
	 *
	 * Required on the wire by this revision. It is a freshness hint that lets a client stop
	 * re-listing every turn, so it trades how quickly a change is noticed against how much
	 * of each conversation is spent re-reading a list.
	 */
	listTtlMs?: number;
	/**
	 * Whether a shared cache may store list results.
	 *
	 * Defaults to `"private"` as soon as any tool or resource declares `available`, because
	 * such a list varies by credential and a shared intermediary holding one caller's copy
	 * would serve it to another. Only a list identical for every caller may be `"public"`.
	 */
	cacheScope?: CacheScope;
	/**
	 * Origins allowed to call this endpoint, checked when a request carries `Origin`.
	 *
	 * Omitted means any origin, which is right for a public endpoint on the internet and
	 * wrong for one bound to localhost, where the check is what stops a web page from
	 * reaching a local server through DNS rebinding.
	 */
	allowedOrigins?: readonly string[] | ((origin: string) => boolean);
	/**
	 * Reports an exception a handler did not expect, which the caller is told nothing about.
	 *
	 * Without it the only trace of an internal failure is a generic sentence, so a handler
	 * with nothing wired here fails silently from an operator's side.
	 */
	onError?(error: unknown, info: { method: string; tool?: string; uri?: string }): void;
}

/** A tool, its handler, and every middleware that wraps it. */
interface ToolRegistration {
	tool: Tool;
	available: ((ctx: AnyRequestContext) => boolean) | undefined;
	middleware: ToolMiddleware[];
	handler: ToolHandler;
}

/** A resource and how it is listed and read. */
interface ResourceRegistration {
	resource: Resource;
	action: ResourceAction;
}

/** What {@link createHandler} returns. */
export interface McpHandler {
	tools: {
		/**
		 * Binds a handler to one tool, or a controller to a group of them.
		 *
		 * Mapping is what registers a tool: one declared and never mapped does not exist,
		 * exactly as an unmapped route is not served.
		 *
		 * @throws Error When a tool is mapped twice, or a nested group appears as an action.
		 */
		map<Schema extends ObjectSchema>(tool: Tool<Schema>, action: ActionOrHandler<Schema>): void;
		map<Group extends ToolGroup>(group: Group, controller: Controller<Group>): void;
	};
	resources: {
		/**
		 * Binds list and read handlers to one resource.
		 *
		 * @throws Error When a resource is mapped twice.
		 */
		map<Pattern extends string>(resource: Resource<Pattern>, action: ResourceAction<Pattern>): void;
	};
	/**
	 * Answers one MCP request.
	 *
	 * Pass the `RequestContext` when there is one, so handlers read what the surrounding
	 * middleware provided; pass a `Request` and one is built, which is the shape a bare
	 * Worker export needs.
	 */
	fetch(input: Request | AnyRequestContext): Promise<Response>;
}

/**
 * Builds the MCP handler for one application.
 *
 * @param options The server's identity, and how its results may be cached.
 * @returns A handler to map tools and resources onto, and to answer requests with.
 * @example
 * let mcp = createHandler({ name: "blog", version: "1.0.0" });
 * router.map(routes.mcp, (ctx) => mcp.fetch(ctx));
 */
export function createHandler(options: HandlerOptions): McpHandler {
	// Insertion-ordered, which is what makes every list deterministic across requests — a
	// client caches these, and a set that reorders itself defeats the cache.
	let tools = new Map<string, ToolRegistration>();
	let resources = new Map<string, ResourceRegistration>();
	let matcher = createMultiMatcher<ResourceRegistration>();
	let conditional = false;

	function registerTool(tool: Tool, action: ActionOrHandler, shared: ToolMiddleware[]): void {
		if (tools.has(tool.name)) {
			throw new Error(`Tool ${JSON.stringify(tool.name)} is already mapped`);
		}

		let resolved: Action =
			typeof action === "function" ? { handler: action as ToolHandler } : (action as Action);
		if (resolved.available) conditional = true;

		tools.set(tool.name, {
			tool,
			available: resolved.available?.bind(resolved),
			middleware: [...shared, ...(resolved.middleware ?? [])] as ToolMiddleware[],
			handler: resolved.handler as ToolHandler,
		});
	}

	return {
		tools: {
			map(target: Tool | ToolGroup, binding: unknown): void {
				if (isTool(target)) {
					registerTool(target, binding as ActionOrHandler, []);
					return;
				}

				let controller = binding as {
					middleware?: ToolMiddleware[];
					actions: Record<string, unknown>;
				};
				for (let [key, node] of Object.entries(target)) {
					if (!isTool(node)) {
						throw new Error(
							`${key} is a nested group; map it with its own map() call rather than as an action`,
						);
					}
					registerTool(
						node,
						controller.actions[key] as ActionOrHandler,
						controller.middleware ?? [],
					);
				}
			},
		},

		resources: {
			map(resource: Resource, action: ResourceAction): void {
				if (resources.has(resource.pattern)) {
					throw new Error(`Resource ${JSON.stringify(resource.pattern)} is already mapped`);
				}
				if (action.available) conditional = true;

				let registration: ResourceRegistration = { resource, action };
				resources.set(resource.pattern, registration);
				// One matcher over every pattern, so an ambiguous URI resolves by specificity
				// rather than by which resource happened to be mapped first.
				matcher.add(resource.pattern, registration);
			},
		},

		fetch(input: Request | AnyRequestContext): Promise<Response> {
			return answer(contextFor(input), options, { tools, resources, matcher, conditional });
		},
	};
}

/** Everything the dispatcher reads out of a handler's registrations. */
interface Registry {
	tools: Map<string, ToolRegistration>;
	resources: Map<string, ResourceRegistration>;
	matcher: ReturnType<typeof createMultiMatcher<ResourceRegistration>>;
	conditional: boolean;
}

/** Runs one request end to end, from method check to serialized response. */
async function answer(
	ctx: AnyRequestContext,
	options: HandlerOptions,
	registry: Registry,
): Promise<Response> {
	let request = ctx.request;

	// GET and DELETE were the session-era stream and teardown; this revision has neither, and
	// the spec names 405 as the answer an older client should get for them.
	if (request.method !== "POST") {
		return new Response(null, { status: 405, headers: { Allow: "POST" } });
	}

	let origin = request.headers.get("Origin");
	if (origin !== null && !isAllowedOrigin(origin, options.allowedOrigins)) {
		return httpError(403, "Origin is not allowed");
	}

	if (!hasJsonBody(request)) return httpError(415, "Expected a Content-Type of application/json");

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json(replyError(null, ErrorCode.ParseError, "Request body was not valid JSON"), 400);
	}

	// Batching was removed in this revision, and under the previous one it only ever saved
	// round trips — which a stateless server does not need enough to justify the ambiguity of
	// a batch that half-fails.
	if (Array.isArray(body)) {
		return json(
			replyError(null, ErrorCode.InvalidRequest, "Batched requests are not supported"),
			400,
		);
	}

	if (!isJsonRpcMessage(body)) {
		return json(replyError(null, ErrorCode.InvalidRequest, "Not a JSON-RPC 2.0 message"), 400);
	}

	// A notification expects no answer. This revision defines no client-to-server notification
	// over HTTP, so anything arriving here is acknowledged and dropped rather than validated —
	// its header requirements are deliberately unspecified.
	if (!isRequest(body)) return new Response(null, { status: 202 });

	let id: RequestId = body.id;

	let headerProblem = checkHeaders(request, body.method, body.params);
	if (headerProblem) return json(replyError(id, ErrorCode.HeaderMismatch, headerProblem), 400);

	let metadata = readRequestMetadata(body.params);
	if (isMetadataProblem(metadata)) {
		return json(replyError(id, ErrorCode.InvalidParams, metadata.reason), 400);
	}

	// The header and the body both state the version, and a gateway may route on the header
	// while this code executes the body. Making them agree is what stops those two from being
	// different requests.
	if (request.headers.get(PROTOCOL_VERSION_HEADER) !== metadata.protocolVersion) {
		return json(
			replyError(
				id,
				ErrorCode.HeaderMismatch,
				`${PROTOCOL_VERSION_HEADER} does not match ${MetaKey.ProtocolVersion}`,
			),
			400,
		);
	}

	if (!isSupportedVersion(metadata.protocolVersion)) {
		return json(
			replyError(id, ErrorCode.UnsupportedProtocolVersion, "Unsupported protocol version", {
				supported: SUPPORTED_PROTOCOL_VERSIONS,
				requested: metadata.protocolVersion,
			}),
			400,
		);
	}

	let listing = {
		ttlMs: options.listTtlMs ?? DEFAULT_LIST_TTL_MS,
		cacheScope: options.cacheScope ?? (registry.conditional ? "private" : "public"),
	};
	let meta = {
		[MetaKey.ServerInfo]: {
			name: options.name,
			...(options.title === undefined ? {} : { title: options.title }),
			version: options.version,
		},
	};

	switch (body.method) {
		case "server/discover": {
			let capabilities: Record<string, unknown> = {};
			if (registry.tools.size > 0) capabilities.tools = { listChanged: false };
			if (registry.resources.size > 0) capabilities.resources = {};

			return json(
				reply(id, {
					resultType: "complete",
					supportedVersions: SUPPORTED_PROTOCOL_VERSIONS,
					capabilities,
					...(options.instructions === undefined ? {} : { instructions: options.instructions }),
					...listing,
					_meta: meta,
				}),
				200,
			);
		}

		case "tools/list": {
			let visible = [...registry.tools.values()].filter((entry) => entry.available?.(ctx) ?? true);
			return json(
				reply(id, {
					resultType: "complete",
					tools: visible.map((entry) => entry.tool.descriptor),
					...listing,
					_meta: meta,
				}),
				200,
			);
		}

		case "tools/call": {
			return callTool(ctx, options, registry, body.params, id, meta);
		}

		case "resources/list": {
			let entries: ResourceListing[] = [];
			for (let entry of registry.resources.values()) {
				if (!(entry.action.available?.(ctx) ?? true)) continue;
				// A resource with variables and no enumerator is a template only; one without
				// variables is already a single concrete URI and needs no enumerator at all.
				if (entry.action.list) entries.push(...(await entry.action.list(ctx)));
				else if (!entry.resource.hasVariables) {
					entries.push({ uri: entry.resource.href(), ...entry.resource.descriptor });
				}
			}

			return json(
				reply(id, { resultType: "complete", resources: entries, ...listing, _meta: meta }),
				200,
			);
		}

		case "resources/templates/list": {
			let templates = [...registry.resources.values()]
				.filter((entry) => entry.resource.hasVariables)
				.filter((entry) => entry.action.available?.(ctx) ?? true)
				.map((entry) => entry.resource.descriptor);

			return json(
				reply(id, {
					resultType: "complete",
					resourceTemplates: templates,
					...listing,
					_meta: meta,
				}),
				200,
			);
		}

		case "resources/read": {
			return readResource(ctx, options, registry, body.params, id, meta, listing);
		}

		default: {
			// 404 rather than a 200 carrying the error: this revision uses the status to tell a
			// modern server that lacks a method from a legacy server that lacks the endpoint.
			return json(replyError(id, ErrorCode.MethodNotFound, `Unknown method: ${body.method}`), 404);
		}
	}
}

/** Validates and runs one tool call, mapping each failure to where MCP reports it. */
async function callTool(
	ctx: AnyRequestContext,
	options: HandlerOptions,
	registry: Registry,
	params: Record<string, unknown> | undefined,
	id: RequestId,
	meta: Record<string, unknown>,
): Promise<Response> {
	let name = params?.name;
	if (typeof name !== "string") {
		return json(replyError(id, ErrorCode.InvalidParams, "Expected a tool name"), 200);
	}

	let entry = registry.tools.get(name);
	// A tool this caller may not use is reported as absent rather than as forbidden, so the
	// refusal says exactly as much as `tools/list` already did and no more.
	if (!entry || !(entry.available?.(ctx) ?? true)) {
		return json(replyError(id, ErrorCode.InvalidParams, `Unknown tool: ${name}`), 200);
	}

	let checked = validateArguments(entry.tool.inputSchema, params?.arguments);
	if (isFailure(checked)) {
		return json(
			replyError(id, ErrorCode.InvalidParams, checked.error.message, {
				issues: checked.error.issues,
			}),
			200,
		);
	}

	// Installed on the request's own context, not on a wrapper: `headers` and `router` are
	// getters over private fields, so anything reading them through a derived object throws.
	ctx.set(ToolInput, checked.data, { property: "input" });
	ctx.set(CurrentTool, entry.tool.descriptor, { property: "tool" });

	let chain = [...(options.toolMiddleware ?? []), ...entry.middleware];

	try {
		let result = await runChain(ctx as ToolContext, chain, entry);
		return json(reply(id, { resultType: "complete", ...result, _meta: meta }), 200);
	} catch (error) {
		if (error instanceof InvalidArgumentsError) {
			return json(
				replyError(id, ErrorCode.InvalidParams, error.message, { issues: error.issues }),
				200,
			);
		}
		if (error instanceof ForbiddenError) {
			return json(replyError(id, ErrorCode.InvalidParams, error.message), 200);
		}

		options.onError?.(error, { method: "tools/call", tool: name });
		// The model is told the call failed and nothing more: an unexpected error's message was
		// written for an operator. `ToolError` is how a handler says something the model should
		// read, and it is handled inside the chain before ever reaching here.
		return json(
			reply(id, {
				resultType: "complete",
				content: [{ type: "text", text: `The ${name} tool failed unexpectedly.` }],
				isError: true,
				_meta: meta,
			}),
			200,
		);
	}
}

/** Runs the middleware chain, then the handler, and shapes what it returned. */
function runChain(
	ctx: ToolContext,
	chain: readonly ToolMiddleware[],
	entry: ToolRegistration,
): Promise<CallToolResult> {
	let entered = -1;

	async function step(index: number): Promise<CallToolResult> {
		// A middleware that calls `next()` twice would run the rest of the chain, and the
		// handler, a second time — which for a tool that writes is a duplicated write.
		if (index <= entered) throw new Error("next() was called more than once");
		entered = index;

		let middleware = chain[index];
		if (middleware) return middleware(ctx, () => step(index + 1));

		try {
			let output = await entry.handler(ctx);
			return toResult(output, entry.tool.descriptor.outputSchema !== undefined);
		} catch (error) {
			// Only a `ToolError`'s message is written for the model. Anything else came from code
			// that did not expect to fail, and its message is an operator's detail — a query
			// fragment, an upstream URL — that the caller must not read.
			if (error instanceof ToolError) {
				return { content: [{ type: "text", text: error.message }], isError: true };
			}
			throw error;
		}
	}

	return step(0);
}

/**
 * Shapes a tool handler's return value into a result.
 *
 * A string is the answer as written. Anything else is serialized, and additionally attached
 * as `structuredContent` when the tool declared an output schema — the text block stays
 * either way, since a client that reads only content blocks is conformant.
 */
function toResult(output: unknown, hasOutputSchema: boolean): CallToolResult {
	if (typeof output === "string") return { content: [{ type: "text", text: output }] };

	let text = JSON.stringify(output ?? null, null, 2);
	let result: CallToolResult = { content: [{ type: "text", text }] };
	if (hasOutputSchema) result.structuredContent = output;
	return result;
}

/** Matches a URI to a mapped resource and reads it. */
async function readResource(
	ctx: AnyRequestContext,
	options: HandlerOptions,
	registry: Registry,
	params: Record<string, unknown> | undefined,
	id: RequestId,
	meta: Record<string, unknown>,
	listing: { ttlMs: number; cacheScope: CacheScope },
): Promise<Response> {
	let uri = params?.uri;
	if (typeof uri !== "string") {
		return json(replyError(id, ErrorCode.InvalidParams, "Expected a resource uri"), 200);
	}

	let match = matchUri(registry, uri);
	// Not found and hidden are the same answer, for the same reason a hidden tool reports as
	// unknown: the refusal says exactly as much as the list already did.
	if (!match || !(match.data.action.available?.(ctx) ?? true)) {
		return json(replyError(id, ErrorCode.InvalidParams, "Resource not found", { uri }), 200);
	}

	let { resource, action } = match.data;

	ctx.set(ResourceUri, uri, { property: "uri" });
	ctx.set(ResourceVariables, match.params, { property: "variables" });
	ctx.set(CurrentResource, resource.descriptor, { property: "resource" });

	let output: ReadResult;
	try {
		output = await action.read(ctx as ResourceContext);
	} catch (error) {
		options.onError?.(error, { method: "resources/read", uri });
		// A resource read has no `isError` channel — MCP gives it only JSON-RPC errors — so
		// there is nothing a resource can say to the model, and every failure is a protocol one.
		return json(replyError(id, ErrorCode.InternalError, "Failed to read the resource"), 200);
	}

	let contents: ResourceContents[] | null = toContents(output, uri, resource.descriptor.mimeType);
	if (contents === null) {
		return json(replyError(id, ErrorCode.InvalidParams, "Resource not found", { uri }), 200);
	}

	return json(reply(id, { resultType: "complete", contents, ...listing, _meta: meta }), 200);
}

/** The most specific mapped resource matching a URI, with its captured variables. */
function matchUri(
	registry: Registry,
	uri: string,
): { data: ResourceRegistration; params: Record<string, string | undefined> } | null {
	let match: unknown;
	try {
		match = registry.matcher.match(uri);
	} catch {
		// A URI the matcher cannot parse is simply not one of ours.
		return null;
	}
	if (!match) return null;

	let found = match as { data: ResourceRegistration; params: Record<string, string | undefined> };
	return { data: found.data, params: found.params };
}

/**
 * Checks the headers this revision requires against the body they mirror.
 *
 * @returns The reason they disagree, or `undefined` when they match.
 */
function checkHeaders(
	request: Request,
	method: string,
	params: Record<string, unknown> | undefined,
): string | undefined {
	if (request.headers.get(PROTOCOL_VERSION_HEADER) === null) {
		return `Missing required ${PROTOCOL_VERSION_HEADER} header`;
	}

	let headerMethod = request.headers.get(METHOD_HEADER);
	if (headerMethod === null) return `Missing required ${METHOD_HEADER} header`;
	if (headerMethod !== method) {
		return `${METHOD_HEADER} header value ${JSON.stringify(headerMethod)} does not match body value ${JSON.stringify(method)}`;
	}

	let source = NAME_SOURCE[method];
	if (source === undefined) return undefined;

	let value = params?.[source];
	if (typeof value !== "string") return undefined;

	let headerName = request.headers.get(NAME_HEADER);
	if (headerName === null) return `Missing required ${NAME_HEADER} header`;
	if (decodeHeaderValue(headerName) !== value) {
		return `${NAME_HEADER} header value does not match body value ${JSON.stringify(value)}`;
	}

	return undefined;
}

/** Whether the request declares a JSON body, ignoring any charset parameter. */
function hasJsonBody(request: Request): boolean {
	let contentType = request.headers.get("Content-Type");
	return contentType !== null && contentType.split(";")[0]?.trim() === "application/json";
}

/** Whether a request's `Origin` is one the application accepts. */
function isAllowedOrigin(origin: string, allowed: HandlerOptions["allowedOrigins"]): boolean {
	if (allowed === undefined) return true;
	if (typeof allowed === "function") return allowed(origin);
	return allowed.includes(origin);
}

/** Writes a JSON-RPC response at the status this revision assigns it. */
function json(body: JsonRpcResponse, status: number): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

/**
 * Writes a transport-level failure, which is not a JSON-RPC message.
 *
 * These happen before a message exists — a wrong method, an unreadable content type, a
 * refused origin — so there is no id to answer and no envelope to put an error in.
 */
function httpError(status: number, message: string): Response {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}
