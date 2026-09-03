/**
 * Public entry point for the MCP package: the tool and resource declaration trees, the
 * factories that type their implementations, the handler that serves them, and the errors a
 * handler throws to steer a result.
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
} from "./resources.js";
export type {
	ArraySchema,
	BooleanSchema,
	FromObjectSchema,
	FromSchema,
	NumberSchema,
	ObjectSchema,
	PropertySchema,
	StringSchema,
} from "./schema.js";
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
} from "./tools.js";
export { validateArguments } from "./validate.js";
