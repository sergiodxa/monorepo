/**
 * The Streamable HTTP transport and method dispatch: one request in, one response out,
 * complete and self-contained.
 *
 * Revision `2026-07-28` made MCP stateless, which lets this run as an ordinary remix action
 * that returns after every request. `fetch` accepts a `RequestContext`, so an application's
 * existing middleware — session, logger, database, authentication — is the middleware for
 * its MCP surface too, and a handler reads what that middleware set with the same
 * `ctx.get()` every other handler in the app uses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
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
 * A method absent from here skips the `Mcp-Name` check entirely. Adding `prompts/get`
 * later is one entry.
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
	/** This server's own version, independent of the protocol version it negotiates. */
	version: string;
	/**
	 * How to use this server as a whole, delivered with `server/discover`.
	 *
	 * A client may put it in the model's system prompt: the place for guidance spanning the
	 * whole server, beyond what one tool or resource description covers.
	 */
	instructions?: string;
	/**
	 * Middleware wrapping every tool call, before any group or action middleware.
	 *
	 * This slot exists for what has to see a tool's result, such as metering; request-level
	 * concerns belong on the route's own `remix/router` middleware.
	 */
	toolMiddleware?: ToolMiddleware[];
	/**
	 * How long a client may cache a list result, in milliseconds.
	 *
	 * Required on the wire by this revision, trading how quickly a client notices a change
	 * against how much of each turn goes to re-listing.
	 */
	listTtlMs?: number;
	/**
	 * Whether a shared cache may store list results.
	 *
	 * Defaults to `"private"` once any tool or resource declares `available`, since such a
	 * list varies by credential; only a list identical for every caller may be `"public"`.
	 */
	cacheScope?: CacheScope;
	/**
	 * Origins allowed to call this endpoint, checked when a request carries `Origin`.
	 *
	 * Omitted means any origin, right for a public endpoint but wrong for one bound to
	 * localhost, where the check is what stops a web page from reaching it via DNS rebinding.
	 */
	allowedOrigins?: readonly string[] | ((origin: string) => boolean);
	/**
	 * Reports an exception a handler did not expect, so an operator can see it even though
	 * the caller receives only a generic failure sentence.
	 */
	onError?(error: unknown, info: { method: string; tool?: string; uri?: string }): void;
}

interface ToolRegistration {
	tool: Tool;
	available: ((ctx: AnyRequestContext) => boolean) | undefined;
	middleware: ToolMiddleware[];
	handler: ToolHandler;
}

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
		 * Mapping is what registers a tool: only a mapped tool exists, the same way only a
		 * mapped route is served.
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
		 * Every pattern joins one matcher, so a URI matching more than one resource resolves
		 * to the most specific match.
		 *
		 * @throws Error When a resource is mapped twice.
		 */
		map<Pattern extends string>(resource: Resource<Pattern>, action: ResourceAction<Pattern>): void;
	};
	/**
	 * Answers one MCP request.
	 *
	 * Pass the `RequestContext` when there is one, so handlers read what the surrounding
	 * middleware provided; pass a bare `Request` and one is built for a plain Worker export.
	 */
	fetch(input: Request | AnyRequestContext): Promise<Response>;
}

/**
 * Builds the MCP handler for one application.
 *
 * Tools and resources register into a `Map`, so every list stays in insertion order and
 * deterministic for whatever cache a client keeps of it.
 *
 * @param options The server's identity, and how its results may be cached.
 * @returns A handler to map tools and resources onto, and to answer requests with.
 * @example
 * let mcp = createHandler({ name: "blog", version: "1.0.0" });
 * router.map(routes.mcp, (ctx) => mcp.fetch(ctx));
 */
export function createHandler(options: HandlerOptions): McpHandler {
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

/**
 * Runs one request end to end, from method check to serialized response.
 *
 * An unknown method answers with 404, so a client can tell a modern server that merely
 * lacks that method from a legacy server that lacks this endpoint entirely.
 */
async function answer(
	ctx: AnyRequestContext,
	options: HandlerOptions,
	registry: Registry,
): Promise<Response> {
	let request = ctx.request;

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

	if (Array.isArray(body)) {
		return json(
			replyError(null, ErrorCode.InvalidRequest, "Batched requests are not supported"),
			400,
		);
	}

	if (!isJsonRpcMessage(body)) {
		return json(replyError(null, ErrorCode.InvalidRequest, "Not a JSON-RPC 2.0 message"), 400);
	}

	if (!isRequest(body)) return new Response(null, { status: 202 });

	let id: RequestId = body.id;

	let headerProblem = checkHeaders(request, body.method, body.params);
	if (headerProblem) return json(replyError(id, ErrorCode.HeaderMismatch, headerProblem), 400);

	let metadata = readRequestMetadata(body.params);
	if (isMetadataProblem(metadata)) {
		return json(replyError(id, ErrorCode.InvalidParams, metadata.reason), 400);
	}

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
			return json(replyError(id, ErrorCode.MethodNotFound, `Unknown method: ${body.method}`), 404);
		}
	}
}

/**
 * Validates and runs one tool call, mapping each failure to where MCP reports it.
 *
 * An unavailable tool is reported as unknown, so the refusal carries no more than what
 * `tools/list` already told the caller.
 */
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

/**
 * Runs the middleware chain, then the handler, and shapes what it returned.
 *
 * Only a `ToolError`'s message reaches the model; any other thrown error is treated as an
 * operator-facing detail and rethrown for the caller to turn into a generic failure.
 */
function runChain(
	ctx: ToolContext,
	chain: readonly ToolMiddleware[],
	entry: ToolRegistration,
): Promise<CallToolResult> {
	let entered = -1;

	async function step(index: number): Promise<CallToolResult> {
		if (index <= entered) throw new Error("next() was called more than once");
		entered = index;

		let middleware = chain[index];
		if (middleware) return middleware(ctx, () => step(index + 1));

		try {
			let output = await entry.handler(ctx);
			return toResult(output, entry.tool.descriptor.outputSchema !== undefined);
		} catch (error) {
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
 * The text block always carries the full answer; a schema-declaring tool additionally gets
 * it attached as `structuredContent`, so a client reading only content blocks stays conformant.
 */
function toResult(output: unknown, hasOutputSchema: boolean): CallToolResult {
	if (typeof output === "string") return { content: [{ type: "text", text: output }] };

	let text = JSON.stringify(output ?? null, null, 2);
	let result: CallToolResult = { content: [{ type: "text", text }] };
	if (hasOutputSchema) result.structuredContent = output;
	return result;
}

/**
 * Matches a URI to a mapped resource and reads it.
 *
 * A failure here always becomes a JSON-RPC error, since MCP gives a resource read only
 * that channel to report one.
 */
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
		return json(replyError(id, ErrorCode.InternalError, "Failed to read the resource"), 200);
	}

	let contents: ResourceContents[] | null = toContents(output, uri, resource.descriptor.mimeType);
	if (contents === null) {
		return json(replyError(id, ErrorCode.InvalidParams, "Resource not found", { uri }), 200);
	}

	return json(reply(id, { resultType: "complete", contents, ...listing, _meta: meta }), 200);
}

/**
 * The most specific mapped resource matching a URI, with its captured variables.
 *
 * Returns `null` for a URI the matcher cannot parse, exactly as it would for one that
 * matches no registered resource.
 */
function matchUri(
	registry: Registry,
	uri: string,
): { data: ResourceRegistration; params: Record<string, string | undefined> } | null {
	let match: unknown;
	try {
		match = registry.matcher.match(uri);
	} catch {
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
 * Writes a transport-level failure as a bare `{ error }` object.
 *
 * These happen before a message exists — a wrong method, an unreadable content type, a
 * refused origin — so the status code alone carries the failure.
 */
function httpError(status: number, message: string): Response {
	return new Response(JSON.stringify({ error: message }), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}
