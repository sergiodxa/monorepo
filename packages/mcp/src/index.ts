/**
 * Public `@sdxc/mcp/server` entry: tool and resource declaration trees, the
 * factories that type their implementations, the handler that serves them, and
 * the errors a handler throws to steer a result. Requires the `remix` peer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export {
	contextFor,
	CurrentResource,
	CurrentTool,
	ResourceUri,
	ResourceVariables,
	ToolInput,
} from "./context.js";
export type {
	AnyRequestContext,
	ResourceContext,
	ResourceVariableValues,
	ToolContext,
} from "./context.js";
export { ForbiddenError, InvalidArgumentsError, ToolError } from "./errors.js";
export { createHandler } from "./handler.js";
export type { CacheScope, HandlerOptions, McpHandler } from "./handler.js";
export { ErrorCode } from "./jsonrpc.js";
export { lazy } from "./lazy.js";
export type { Lazy } from "./lazy.js";
export { LATEST_PROTOCOL_VERSION, MetaKey, SUPPORTED_PROTOCOL_VERSIONS } from "./protocol.js";
export type { ClientCapabilities, Implementation } from "./protocol.js";
export { createResource, resource, resources, walkResources } from "./resources.js";
export type {
	ReadResult,
	Resource,
	ResourceAction,
	ResourceContents,
	ResourceDeclaration,
	ResourceDescriptor,
	ResourceGroup,
	ResourceListing,
	Routable,
} from "./resources.js";
export { createTool, createToolController, tool, tools, walk } from "./tools.js";
export type {
	Action,
	ActionOrHandler,
	CallToolResult,
	Controller,
	InputOf,
	TextContent,
	Tool,
	ToolAnnotations,
	ToolDefinition,
	ToolDescriptor,
	ToolGroup,
	ToolHandler,
	ToolMiddleware,
	ToolSchema,
} from "./tools.js";
export { validateArguments } from "./validate.js";
