/**
 * The tool declaration tree: the equivalent of a route table, where a tool's name is its
 * address and its input schema is the contract that types the handler.
 *
 * Declaration is separate from handling: this file says what exists and what it takes,
 * while binding a handler and its middleware happens at `map()`, where an application's
 * own concerns belong. Nothing here reads a request or runs anything.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyRequestContext, ToolContext } from "./context";
import type { FromObjectSchema, ObjectSchema } from "./schema";

/**
 * Hints a client may weigh when shaping the approval prompt a person sees before a tool
 * runs — `readOnlyHint` in particular is what lets a client run the tool right away,
 * skipping that prompt.
 */
export interface ToolAnnotations {
	/** Human-readable name, shown in place of the tool's identifier. */
	readonly title?: string;
	/** The tool only reads. */
	readonly readOnlyHint?: boolean;
	/** The tool may remove or overwrite something permanently. */
	readonly destructiveHint?: boolean;
	/** Calling twice with the same arguments has the same effect as calling once. */
	readonly idempotentHint?: boolean;
	/** The tool reaches something outside this server, such as the public internet. */
	readonly openWorldHint?: boolean;
}

/** Everything a tool declares about itself. */
export interface ToolDefinition<Schema extends ObjectSchema> {
	/** Human-readable name for a client that renders one. */
	title?: string;
	/**
	 * What the tool does and when to reach for it.
	 *
	 * This is the prompt — the only thing a model reads when choosing between this tool
	 * and its neighbours, so it should focus on purpose and occasion for use.
	 */
	description: string;
	/** The arguments, as JSON Schema. Also the source of the handler's argument type. */
	input: Schema;
	/**
	 * The shape of the structured result, when the tool returns one.
	 *
	 * Declaring it gives a model a result it can consume directly as data, and MCP only
	 * permits `structuredContent` when it is declared.
	 */
	output?: ObjectSchema;
	annotations?: ToolAnnotations;
}

/** A tool's entry in a `tools/list` response. */
export interface ToolDescriptor {
	name: string;
	title?: string;
	description: string;
	inputSchema: ObjectSchema;
	outputSchema?: ObjectSchema;
	annotations?: ToolAnnotations;
}

/** Brands a declared tool so a group can tell one from a nested group. */
const TOOL = Symbol.for("@sdxc/mcp.tool");

/** A declared tool; `map()` binds its handler separately. */
export interface Tool<Schema extends ObjectSchema = ObjectSchema> {
	readonly [TOOL]: true;
	/** The name a client calls, and the tool's identity in every response. */
	readonly name: string;
	/** The `tools/list` entry, built once at declaration. */
	readonly descriptor: ToolDescriptor;
	/** The declared input schema, kept for validating a call's arguments. */
	readonly inputSchema: Schema;
}

/**
 * The characters MCP allows in a tool name, checked at declaration. A name outside this
 * set must be Base64-encoded to survive the `Mcp-Name` header, so catching it here
 * avoids a header mismatch appearing later, one transport at a time.
 */
const TOOL_NAME = /^[a-zA-Z0-9_.-]{1,128}$/;

/**
 * Declares one tool.
 *
 * @param name The identifier a client calls. Letters, digits, `_`, `-` and `.`, up to
 * 128 characters.
 * @param definition What the tool takes and what it is for.
 * @returns The declared tool, ready to be mapped to a handler.
 * @throws Error When the name breaks the pattern MCP allows.
 * @example
 * let getPost = tool("get_post", {
 * 	description: "Reads one published post in full, as Markdown.",
 * 	input: { type: "object", properties: { slug: { type: "string" } }, required: ["slug"] },
 * });
 */
export function tool<const Schema extends ObjectSchema>(
	name: string,
	definition: ToolDefinition<Schema>,
): Tool<Schema> {
	if (!TOOL_NAME.test(name)) {
		throw new Error(
			`Invalid tool name ${JSON.stringify(name)}: use 1-128 characters from A-Z a-z 0-9 _ - .`,
		);
	}

	let descriptor: ToolDescriptor = {
		name,
		description: definition.description,
		inputSchema: definition.input,
	};
	if (definition.title !== undefined) descriptor.title = definition.title;
	if (definition.output !== undefined) descriptor.outputSchema = definition.output;
	if (definition.annotations !== undefined) descriptor.annotations = definition.annotations;

	return { [TOOL]: true, name, descriptor, inputSchema: definition.input };
}

/** A tree of declared tools, nested however an application wants to group them. */
export interface ToolGroup {
	readonly [key: string]: Tool | ToolGroup;
}

/** True for a tool in a declaration tree; false for a nested group of tools. */
export function isTool(value: Tool | ToolGroup): value is Tool<never> {
	return TOOL in value;
}

/**
 * Groups declared tools, checking that no name is used twice. Grouping is what lets one
 * `map()` call cover several tools under a shared middleware chain — a tool's address
 * stays the name it was declared with, wherever it sits in the tree.
 *
 * @param group Tools and nested groups.
 * @returns The same tree, typed so `map()` can require an action per tool.
 * @throws Error When two tools in the tree share a name, which would make one of them
 * permanently unreachable.
 * @example
 * export default tools({ search: searchPosts, posts: tools({ list, get }) });
 */
export function tools<const Group extends ToolGroup>(group: Group): Group {
	let seen = new Set<string>();

	for (let each of walk(group)) {
		if (seen.has(each.name)) {
			throw new Error(`Duplicate tool name ${JSON.stringify(each.name)} in the same tree`);
		}
		seen.add(each.name);
	}

	return group;
}

/**
 * Walks a declaration tree.
 *
 * @param group The tree to walk.
 * @yields Every tool in it, depth first in declaration order.
 */
export function* walk(group: ToolGroup): Generator<Tool> {
	for (let node of Object.values(group)) {
		if (isTool(node)) yield node;
		else yield* walk(node as ToolGroup);
	}
}

/**
 * The argument type a tool's handler receives.
 *
 * Exported so a middleware bound to one tool can name that tool's own input type
 * directly.
 *
 * @example
 * function requireOwnMonitor(): ToolMiddleware<InputOf<typeof toolset.monitors.get>> {}
 */
export type InputOf<T> = T extends Tool<infer Schema> ? FromObjectSchema<Schema> : never;

/** A value a handler or middleware may return directly or as a promise. */
type Awaitable<T> = T | Promise<T>;

/** One block of a tool's answer. Only text is produced; MCP allows more. */
export interface TextContent {
	type: "text";
	text: string;
}

/** What a `tools/call` answers with. */
export interface CallToolResult {
	content: TextContent[];
	/** Present only when the tool declared an output schema, as MCP requires. */
	structuredContent?: unknown;
	/** True when the tool ran and its outcome is a failure. */
	isError?: boolean;
}

/**
 * Middleware wrapping a tool call, given the call's own result directly so it can meter
 * or log the outcome. The erased default `Input` keeps this assignable across every
 * tool; name it with {@link InputOf} only when the middleware reads `ctx.input`.
 */
export type ToolMiddleware<Input = Record<string, unknown>> = (
	ctx: ToolContext<Input>,
	next: () => Promise<CallToolResult>,
) => Awaitable<CallToolResult>;

/**
 * A returned string becomes the answer verbatim; any other value is serialized as JSON.
 * Throw `ToolError` to report a failed call to the model.
 */
export type ToolHandler<Input = Record<string, unknown>> = (
	ctx: ToolContext<Input>,
) => Awaitable<unknown>;

/** One tool's handler, with the middleware and visibility that belong to it alone. */
export interface Action<Schema extends ObjectSchema = ObjectSchema> {
	/**
	 * Whether this tool exists for this caller. A tool this returns `false` for is absent
	 * from `tools/list` and reported by `tools/call` as unknown, keeping a write tool
	 * invisible to a read-only credential — checked before any argument is read.
	 */
	available?(ctx: AnyRequestContext): boolean;
	middleware?: ToolMiddleware<FromObjectSchema<Schema>>[];
	handler: ToolHandler<FromObjectSchema<Schema>>;
}

/** An action, or just its handler when it needs neither middleware nor a predicate. */
export type ActionOrHandler<Schema extends ObjectSchema = ObjectSchema> =
	| Action<Schema>
	| ToolHandler<FromObjectSchema<Schema>>;

/**
 * Handlers for every tool in one group, under a shared middleware chain. A nested group
 * resolves to `never`, requiring its own call and keeping each controller responsible
 * for exactly one level of the tree.
 */
export interface Controller<Group extends ToolGroup> {
	middleware?: ToolMiddleware[];
	actions: {
		[key in keyof Group]: Group[key] extends Tool<infer Schema> ? ActionOrHandler<Schema> : never;
	};
}

/**
 * Types one tool's implementation against its declaration, so it can live in its own
 * file. Purely a type anchor at runtime — it returns what it was given, and lets a
 * handler written apart from the `map()` call still get `ctx.input` typed from the schema.
 *
 * @param tool The declared tool this implements.
 * @param action The handler, or an action object with middleware and visibility.
 * @returns The action, typed for `map()`.
 * @example
 * export default createTool(toolset.searchPosts, (ctx) => Post.search(ctx.input.query));
 */
export function createTool<Schema extends ObjectSchema>(
	tool: Tool<Schema>,
	action: ActionOrHandler<Schema>,
): ActionOrHandler<Schema> {
	return action;
}

/**
 * Types a whole group's implementations against their declarations, requiring one
 * action per tool the group declares. A tool added later is therefore a type error
 * until this controller's `actions` answers for it.
 *
 * @param group The declared group this implements.
 * @param controller Shared middleware and one action per tool.
 * @returns The controller, typed for `map()`.
 * @example
 * export default createToolController(toolset.posts, { actions: { list, get } });
 */
export function createToolController<Group extends ToolGroup>(
	group: Group,
	controller: Controller<Group>,
): Controller<Group> {
	return controller;
}
