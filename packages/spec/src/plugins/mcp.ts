/**
 * The built-in `mcp` plugin: call a Streamable HTTP MCP server (the shape
 * `@sdxc/mcp` serves) through the global fetch. Each tool posts one JSON-RPC
 * message with the headers and `_meta` that revision requires, so a `.spec`
 * names a tool and its arguments without spelling the protocol. Targets resolve
 * through the run's bases the same way `http` does, and every request checks
 * the `net` grant against the resolved host and port.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { iife } from "@sdxc/iife";
import { failure, isFailure, success } from "@sdxc/result";

import type { SpecError } from "../errors.js";
import type { Plugin, ToolContext, ToolDescriptor, ToolParam } from "../plugin.js";
import type { ToolArg, Value, ValueObject } from "../values.js";

import { ResponseTooLargeError, ToolError } from "../errors.js";
import { formatValue } from "../values.js";

/** The MCP protocol revision this client speaks. */
const PROTOCOL_VERSION = "2026-07-28";

/** Header mirroring the `_meta` protocol version. */
const PROTOCOL_VERSION_HEADER = "MCP-Protocol-Version";

/** Header mirroring the JSON-RPC `method`. */
const METHOD_HEADER = "Mcp-Method";

/** Header mirroring `params.name` on `tools/call`. */
const NAME_HEADER = "Mcp-Name";

/** Reserved `_meta` keys for this revision. */
const META_KEY = {
	ProtocolVersion: "io.modelcontextprotocol/protocolVersion",
	ClientInfo: "io.modelcontextprotocol/clientInfo",
	ClientCapabilities: "io.modelcontextprotocol/clientCapabilities",
} as const;

/** How this client identifies itself on every request. */
const CLIENT_INFO = { name: "spec", version: "1.0.0" };

/** The tools this namespace exposes, in descriptor order. */
const TOOLS = ["discover", "list_tools", "call"] as const;

/** One of the MCP tools. */
type McpTool = (typeof TOOLS)[number];

/** Host policy for the `mcp` plugin, chosen where the plugin is constructed. */
export interface McpPluginOptions {
	/**
	 * The most a single response body may be, in bytes. Omitted reads whatever
	 * arrives; a host running untrusted specs in a bounded isolate sets it so one
	 * response cannot exhaust the memory a later parse needs.
	 */
	maxResponseBytes?: number;
}

/** Credentials supplied through `bearer` or `basic`. */
interface AuthSpec {
	kind: "bearer" | "basic";
	token?: string;
	user?: string;
	pass?: string;
}

/** Validated arguments shared by every MCP tool. */
interface McpRequestArgs {
	target: string;
	base: string | undefined;
	headers: Value | undefined;
	auth: AuthSpec | undefined;
	/** Tool name for `call`; unused otherwise. */
	name: string | undefined;
	/** Tool arguments for `call`; unused otherwise. */
	arguments: ValueObject | undefined;
}

/**
 * Create the built-in `mcp` plugin (namespace `"mcp"`). Tools take a target
 * (and for `call`, a tool name and optional arguments object), resolve the
 * target through the run's bases, check the `net` permission, then POST one
 * JSON-RPC message.
 *
 * @param options - Host policy; `maxResponseBytes` caps each response body.
 */
export function createMcpPlugin(options: McpPluginOptions = {}): Plugin {
	let maxResponseBytes = options.maxResponseBytes;
	let nextId = 1;
	return {
		namespace: "mcp",
		describe() {
			return TOOLS.map((tool) => describeTool(tool));
		},
		async call(tool, args, context) {
			if (!isMcpTool(tool)) {
				return failure(
					new ToolError(`mcp has no tool "${tool}"; available tools: ${TOOLS.join(", ")}`),
				);
			}
			return await invoke(tool, args, context, maxResponseBytes, () => nextId++);
		},
	};
}

/** Narrow a tool name to one of the MCP tools. */
function isMcpTool(tool: string): tool is McpTool {
	return (TOOLS as readonly string[]).includes(tool);
}

/** Build the descriptor of one MCP tool. */
function describeTool(tool: McpTool): ToolDescriptor {
	let params: ToolParam[] = [
		{
			name: "target",
			kind: "value",
			required: true,
			summary: "An absolute MCP URL, or a `/path` resolved against a configured base.",
		},
	];
	if (tool === "call") {
		params.push(
			{
				name: "name",
				kind: "value",
				required: true,
				summary: "The MCP tool name to invoke.",
			},
			{
				name: "arguments",
				kind: "value",
				required: false,
				summary: "Optional object of arguments for the tool; omitted sends `{}`.",
			},
		);
	}
	params.push(
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
			summary: "Tag before an object of extra header name/value pairs.",
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
	);
	let summaries: Record<McpTool, string> = {
		discover: "Ask an MCP server what it supports (`server/discover`).",
		list_tools: "List the tools an MCP server exposes (`tools/list`).",
		call: "Call one MCP tool by name (`tools/call`) and return its result.",
	};
	return {
		name: tool,
		summary: summaries[tool],
		kind: tool === "call" ? "action" : "observable",
		requires: "net",
		params,
	};
}

/**
 * Validate arguments, resolve the target, check `net`, then POST the JSON-RPC
 * message for `tool`.
 */
async function invoke(
	tool: McpTool,
	args: ToolArg[],
	context: ToolContext,
	maxResponseBytes: number | undefined,
	nextId: () => number,
): Promise<Result<Value, SpecError>> {
	let label = `mcp.${tool}`;
	let parsed = readArgs(label, tool, args);
	if (isFailure(parsed)) return parsed;
	let target = resolveTarget(label, parsed.data.target, parsed.data.base, context);
	if (isFailure(target)) return target;
	let allowed = context.permissions.checkNet(target.data.hostname, portOf(target.data));
	if (isFailure(allowed)) return allowed;
	let method = methodOf(tool);
	let params: ValueObject = {
		_meta: {
			[META_KEY.ProtocolVersion]: PROTOCOL_VERSION,
			[META_KEY.ClientInfo]: CLIENT_INFO,
			[META_KEY.ClientCapabilities]: {},
		},
	};
	if (tool === "call") {
		params.name = parsed.data.name as string;
		params.arguments = parsed.data.arguments ?? {};
	}
	let headers = buildHeaders(label, method, parsed.data);
	if (isFailure(headers)) return headers;
	let body = JSON.stringify({
		jsonrpc: "2.0",
		id: nextId(),
		method,
		params,
	});
	return await perform(label, tool, target.data, headers.data, body, maxResponseBytes);
}

/** The JSON-RPC method each tool posts. */
function methodOf(tool: McpTool): string {
	if (tool === "discover") return "server/discover";
	if (tool === "list_tools") return "tools/list";
	return "tools/call";
}

/**
 * Read positional and word-tagged arguments for one MCP tool. `call` takes a
 * tool name and an optional arguments object before the shared options.
 */
function readArgs(
	label: string,
	tool: McpTool,
	args: ToolArg[],
): Result<McpRequestArgs, SpecError> {
	let first = args[0];
	if (first === undefined) {
		return failure(new ToolError(`${label} requires a URL; got no arguments`));
	}
	if (first.kind !== "value" || typeof first.value !== "string") {
		return failure(new ToolError(`${label} requires its first argument to be a URL string`));
	}
	let target = first.value;
	let index = 1;
	let name: string | undefined;
	let toolArguments: ValueObject | undefined;
	if (tool === "call") {
		let nameArg = args[index];
		if (nameArg === undefined || nameArg.kind !== "value" || typeof nameArg.value !== "string") {
			return failure(new ToolError(`${label} requires a tool name string after the URL`));
		}
		name = nameArg.value;
		index += 1;
		let next = args[index];
		if (next !== undefined && next.kind === "value") {
			if (typeof next.value !== "object" || next.value === null || Array.isArray(next.value)) {
				return failure(new ToolError(`${label} arguments must be an object when provided`));
			}
			toolArguments = next.value;
			index += 1;
		}
	}
	let base: string | undefined;
	let headers: Value | undefined;
	let auth: AuthSpec | undefined;
	while (index < args.length) {
		let arg = args[index];
		if (arg === undefined) break;
		if (arg.kind !== "word") {
			return failure(
				new ToolError(
					`${label} got an unexpected value argument; expected one of on, headers, bearer, basic`,
				),
			);
		}
		let word = arg.word;
		if (word === "on") {
			if (base !== undefined) {
				return failure(new ToolError(`${label} accepts at most one \`on\` base selection`));
			}
			let named = optionString(label, word, args[index + 1], "base name");
			if (isFailure(named)) return named;
			base = named.data;
			index += 2;
			continue;
		}
		if (word === "headers") {
			if (headers !== undefined) {
				return failure(new ToolError(`${label} accepts at most one headers block`));
			}
			let next = args[index + 1];
			if (next === undefined || next.kind !== "value") {
				return failure(new ToolError(`${label} option "headers" needs a value argument after it`));
			}
			headers = next.value;
			index += 2;
			continue;
		}
		if (word === "bearer") {
			if (auth !== undefined) {
				return failure(
					new ToolError(
						`${label} accepts at most one auth option (bearer or basic), but got more than one`,
					),
				);
			}
			let token = optionString(label, "bearer", args[index + 1], "token");
			if (isFailure(token)) return token;
			auth = { kind: "bearer", token: token.data };
			index += 2;
			continue;
		}
		if (word === "basic") {
			if (auth !== undefined) {
				return failure(
					new ToolError(
						`${label} accepts at most one auth option (bearer or basic), but got more than one`,
					),
				);
			}
			let user = optionString(label, "basic", args[index + 1], "username");
			if (isFailure(user)) return user;
			let pass = optionString(label, "basic", args[index + 2], "password");
			if (isFailure(pass)) return pass;
			auth = { kind: "basic", user: user.data, pass: pass.data };
			index += 3;
			continue;
		}
		return failure(
			new ToolError(
				`${label} got the unknown option word "${word}"; expected one of on, headers, bearer, basic`,
			),
		);
	}
	return success({ target, base, headers, auth, name, arguments: toolArguments });
}

/** Read one word-tagged argument as a required string. */
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

/**
 * Resolve a target through the run's bases and require an http(s) URL.
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

/** The port the request will reach: the URL's own, or the scheme default. */
function portOf(url: URL): number {
	if (url.port !== "") return Number(url.port);
	return url.protocol === "https:" ? 443 : 80;
}

/**
 * Build the request headers: the MCP routing headers first, then auth, then
 * author headers so an explicit `authorization` wins over `bearer`/`basic`.
 */
function buildHeaders(
	label: string,
	method: string,
	args: McpRequestArgs,
): Result<Record<string, string>, SpecError> {
	let headers: Record<string, string> = {
		"content-type": "application/json",
		[PROTOCOL_VERSION_HEADER]: PROTOCOL_VERSION,
		[METHOD_HEADER]: method,
	};
	if (method === "tools/call" && args.name !== undefined) {
		headers[NAME_HEADER] = args.name;
	}
	if (args.auth !== undefined) {
		let authorization = authorizationHeader(label, args.auth);
		if (isFailure(authorization)) return authorization;
		headers.authorization = authorization.data;
	}
	if (args.headers !== undefined) {
		let coerced = coerceFields(label, args.headers);
		if (isFailure(coerced)) return coerced;
		for (let [name, value] of Object.entries(coerced.data)) {
			headers[name.toLowerCase()] = value;
		}
	}
	return success(headers);
}

/** Render auth into an `Authorization` header value. */
function authorizationHeader(label: string, auth: AuthSpec): Result<string, SpecError> {
	if (auth.kind === "bearer") return success(`Bearer ${auth.token ?? ""}`);
	try {
		return success(`Basic ${btoa(`${auth.user ?? ""}:${auth.pass ?? ""}`)}`);
	} catch {
		return failure(
			new ToolError(
				`${label} basic credentials must be Latin-1 (base64-encodable); got a value outside that range`,
			),
		);
	}
}

/** Coerce a headers object into a string map. */
function coerceFields(label: string, value: Value): Result<Record<string, string>, SpecError> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return failure(new ToolError(`${label} headers must be an object of string values`));
	}
	let fields: Record<string, string> = {};
	for (let [key, raw] of Object.entries(value)) {
		if (typeof raw === "string") fields[key] = raw;
		else if (typeof raw === "number" || typeof raw === "boolean") fields[key] = String(raw);
		else {
			return failure(
				new ToolError(`${label} headers field "${key}" must be a string, number, or boolean`),
			);
		}
	}
	return success(fields);
}

/**
 * POST the JSON-RPC body and shape the response for the calling tool.
 */
async function perform(
	label: string,
	tool: McpTool,
	url: URL,
	headers: Record<string, string>,
	body: string,
	maxResponseBytes: number | undefined,
): Promise<Result<Value, SpecError>> {
	let response: Response;
	try {
		response = await fetch(url, { method: "POST", headers, body });
	} catch (error) {
		return failure(
			new ToolError(`${label} request to ${url.href} failed: ${describeFailure(error)}`),
		);
	}
	let text = await readBody(label, url, response, maxResponseBytes);
	if (isFailure(text)) return text;
	let parsed = parseJson(text.data);
	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		return failure(
			new ToolError(
				`${label} response from ${url.href} is not a JSON object; got ${formatValue(parsed)}`,
			),
		);
	}
	return success(shapeResult(tool, response, parsed));
}

/**
 * Shape one JSON-RPC response into the fields a `.spec` asserts on. `ok` is
 * true only when the HTTP status is 2xx and the body carries no JSON-RPC
 * error; `text` and `json` surface the first text content block and any
 * structured content so callers need not walk `content` by hand.
 */
function shapeResult(tool: McpTool, response: Response, body: ValueObject): ValueObject {
	let rpcError = asObject(body.error);
	let result = asObject(body.result);
	let content = Array.isArray(result?.content) ? result.content : [];
	let text = firstText(content);
	let structured = result?.structuredContent;
	let json = iife((): Value => {
		if (structured !== undefined) return structured;
		if (text !== null) return parseJson(text);
		return null;
	});
	let status = response.status;
	let ok = response.ok && rpcError === null;
	if (tool === "discover") {
		return {
			status,
			ok,
			capabilities: asObject(result?.capabilities) ?? {},
			instructions: typeof result?.instructions === "string" ? result.instructions : null,
			supported_versions: Array.isArray(result?.supportedVersions) ? result.supportedVersions : [],
			json: result,
			error: rpcError,
		};
	}
	if (tool === "list_tools") {
		return {
			status,
			ok,
			tools: Array.isArray(result?.tools) ? result.tools : [],
			json: result,
			error: rpcError,
		};
	}
	return {
		status,
		ok,
		result_type: typeof result?.resultType === "string" ? result.resultType : null,
		is_error: result?.isError === true,
		text: text ?? "",
		content,
		json,
		error: rpcError,
	};
}

/** The first text content block, or null when none exists. */
function firstText(content: Value[]): string | null {
	for (let entry of content) {
		if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
		if (entry.type === "text" && typeof entry.text === "string") return entry.text;
	}
	return null;
}

/** Narrow a value to an object, or null. */
function asObject(value: Value | undefined): ValueObject | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
	return value;
}

/**
 * Read a response body as text, refusing anything past `limit` bytes.
 */
async function readBody(
	label: string,
	url: URL,
	response: Response,
	limit: number | undefined,
): Promise<Result<string, SpecError>> {
	if (limit === undefined) {
		try {
			return success(await response.text());
		} catch (error) {
			return failure(
				new ToolError(`${label} request to ${url.href} failed: ${describeFailure(error)}`),
			);
		}
	}
	let declared = response.headers.get("content-length");
	if (declared !== null) {
		let length = Number(declared);
		if (Number.isFinite(length) && length > limit) {
			return failure(
				new ResponseTooLargeError(
					`${label} response from ${url.href} is ${length} bytes; this run reads at most ${limit} bytes of a response body`,
					limit,
					length,
				),
			);
		}
	}
	let body = response.body;
	if (body === null) return success("");
	let reader = body.getReader();
	let decoder = new TextDecoder();
	let read = 0;
	let text = "";
	try {
		for (;;) {
			let chunk = await reader.read();
			if (chunk.done) break;
			read += chunk.value.byteLength;
			if (read > limit) {
				await reader.cancel().catch(() => undefined);
				return failure(
					new ResponseTooLargeError(
						`${label} response from ${url.href} is more than ${limit} bytes; this run reads at most ${limit} bytes of a response body`,
						limit,
						undefined,
					),
				);
			}
			text += decoder.decode(chunk.value, { stream: true });
		}
	} catch (error) {
		return failure(
			new ToolError(`${label} request to ${url.href} failed: ${describeFailure(error)}`),
		);
	}
	return success(text + decoder.decode());
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
