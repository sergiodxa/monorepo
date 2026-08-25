/**
 * The tool declaration tree: the equivalent of a route table, where a tool's name is its
 * address and its input schema is the contract that types the handler.
 *
 * Declaration is separate from handling for the same reason `remix/routes` is separate
 * from `remix/router`. This file says what exists and what it takes; binding a handler
 * and its middleware happens at `map()`, which is where an application's own concerns
 * belong. Nothing here reads a request or runs anything.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyRequestContext, ToolContext } from "./context";
import type { FromObjectSchema, ObjectSchema } from "./schema";

/**
 * Behavioural hints a client shows a person before letting a tool run.
 *
 * They are hints, not enforcement: nothing here changes what a handler may do, and a
 * client may ignore them. Stating them is still worth it, because the approval prompt a
 * person sees is built from them — `readOnlyHint` in particular is what lets a client
 * run a tool without stopping to ask.
 */
export interface ToolAnnotations {
	/** Human-readable name, shown in place of the tool's identifier. */
	readonly title?: string;
	/** The tool only reads. */
	readonly readOnlyHint?: boolean;
	/** The tool may remove or overwrite something that cannot be recovered. */
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
	 * This is the prompt. It is the only thing a model reads when deciding between this
	 * tool and its neighbours, so it should say what the tool is for, not how it works.
	 */
	description: string;
	/** The arguments, as JSON Schema. Also the source of the handler's argument type. */
	input: Schema;
	/**
	 * The shape of the structured result, when the tool returns one.
	 *
	 * Declaring it is what makes a result machine-readable rather than prose a model has
	 * to re-parse, and MCP only permits `structuredContent` when it is declared.
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
const TOOL = Symbol.for("@pkg/mcp.tool");

/** A declared tool. Holds no handler — `map()` binds that. */
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
 * The characters MCP allows in a tool name.
 *
 * Enforced at declaration rather than left to convention, because a name outside this
 * set has to be Base64-encoded to survive the `Mcp-Name` header — so an unusual name
 * does not fail here, it fails later in a client, on one transport, as a header mismatch.
 */
const TOOL_NAME = /^[a-zA-Z0-9_.-]{1,128}$/;

/**
 * Declares one tool.
 *
 * @param name The identifier a client calls. Letters, digits, `_`, `-` and `.`, up to
 * 128 characters.
 * @param definition What the tool takes and what it is for.
 * @returns The declared tool, ready to be mapped to a handler.
 * @throws Error When the name is not one MCP allows.
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

/** Reports whether a node of a declaration tree is a tool rather than a nested group. */
export function isTool(value: Tool | ToolGroup): value is Tool<never> {
	return TOOL in value;
}

/**
 * Groups declared tools, checking that no name is used twice.
 *
 * Grouping is what lets one `map()` call cover several tools under a shared middleware
 * chain, the way a route group does. It carries no prefix and changes no name: a tool's
 * address is the name it was declared with, wherever it sits in the tree.
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
 * Exported so a middleware bound to one tool can name that tool's input rather than
 * accepting the erased default.
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
	/** True when the tool ran and could not do what was asked. */
	isError?: boolean;
}

/**
 * Middleware wrapping a tool call.
 *
 * Distinct from `remix/router`'s `Middleware`, which wraps the HTTP request and returns a
 * `Response`: a tool call is not a request and its answer is not a response, so a
 * middleware that meters or logs an outcome needs the result itself. Request-level
 * concerns — authentication, logging, providing a database — are remix middleware on the
 * route, not this.
 *
 * The default `Input` is erased, and because parameters are contravariant a middleware
 * written against it is assignable anywhere. Name a tool's input with {@link InputOf} only
 * when the middleware actually reads `ctx.input`.
 */
export type ToolMiddleware<Input = Record<string, unknown>> = (
	ctx: ToolContext<Input>,
	next: () => Promise<CallToolResult>,
) => Awaitable<CallToolResult>;

/**
 * Does the work.
 *
 * A returned string becomes the answer verbatim; any other value is serialized as JSON.
 * Throw `ToolError` to tell the model the call could not be completed.
 */
export type ToolHandler<Input = Record<string, unknown>> = (
	ctx: ToolContext<Input>,
) => Awaitable<unknown>;

/** One tool's handler, with the middleware and visibility that belong to it alone. */
export interface Action<Schema extends ObjectSchema = ObjectSchema> {
	/**
	 * Whether this tool exists for this caller.
	 *
	 * A tool this returns `false` for is absent from `tools/list` and reported by
	 * `tools/call` as an unknown tool, so a read-only credential never learns that a write
	 * tool is there. It runs before any argument is read, which is why it takes the request
	 * context rather than a tool context.
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
 * Handlers for every tool in one group, under a shared middleware chain.
 *
 * A nested group resolves to `never`, so it cannot be answered here and has to be mapped
 * by its own call — the same rule `remix/router` applies to nested route maps, so each
 * controller owns exactly one level.
 */
export interface Controller<Group extends ToolGroup> {
	middleware?: ToolMiddleware[];
	actions: {
		[key in keyof Group]: Group[key] extends Tool<infer Schema> ? ActionOrHandler<Schema> : never;
	};
}

/**
 * Types one tool's implementation against its declaration, so it can live in its own file.
 *
 * Purely a type anchor at runtime — it returns what it was given. Its value is that a
 * handler written apart from the `map()` call still gets `ctx.input` typed from the
 * schema, which is what `createAction` does for a route in `remix/router`.
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
 * Types a whole group's implementations against their declarations.
 *
 * The `createController` of this package: one file owns one group, and every tool in that
 * group must be answered, so a tool added to the declaration is a type error until it is
 * handled.
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
