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
} from "./context";
export type {
	AnyRequestContext,
	ResourceContext,
	ResourceVariableValues,
	ToolContext,
} from "./context";
export { ForbiddenError, InvalidArgumentsError, ToolError } from "./errors";
export { createHandler } from "./handler";
export type { CacheScope, HandlerOptions, McpHandler } from "./handler";
export { ErrorCode } from "./jsonrpc";
export { LATEST_PROTOCOL_VERSION, MetaKey, SUPPORTED_PROTOCOL_VERSIONS } from "./protocol";
export type { ClientCapabilities, Implementation } from "./protocol";
export { createResource, resource, resources } from "./resources";
export type {
	ReadResult,
	Resource,
	ResourceAction,
	ResourceContents,
	ResourceDeclaration,
	ResourceDescriptor,
	ResourceGroup,
	ResourceListing,
} from "./resources";
export type {
	ArraySchema,
	BooleanSchema,
	FromObjectSchema,
	FromSchema,
	NumberSchema,
	ObjectSchema,
	PropertySchema,
	StringSchema,
} from "./schema";
export { createTool, createToolController, tool, tools } from "./tools";
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
} from "./tools";
export { validateArguments } from "./validate";
