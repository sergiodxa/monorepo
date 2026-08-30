/**
 * The contexts a tool or resource handler receives, and the keys the
 * dispatcher publishes them through. Both are the request's own
 * `RequestContext` — the one the surrounding remix middleware wrote to —
 * with a couple of properties installed on it, so `ctx.get(Database)`
 * inside a tool reads through that same shared context.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ContextEntries } from "remix/router";

import { createContextKey, RequestContext } from "remix/router";

import type { ResourceDescriptor } from "./resources";
import type { ToolDescriptor } from "./tools";

/**
 * A request context whatever its params and middleware entries.
 *
 * Mounted by applications whose middleware chains it cannot know, so it stays generic over both;
 * typing the entries as `ContextEntries` keeps `ctx.get()` resolving to each key's real value type.
 */
// oxlint-disable-next-line typescript/no-explicit-any -- params are never read here
export type AnyRequestContext = RequestContext<any, ContextEntries>;

/** The context a tool's middleware and handler receive. */
export type ToolContext<Input = Record<string, unknown>> = AnyRequestContext & {
	/** The call's arguments, validated against the tool's declared schema. */
	readonly input: Input;
	/** The tool being called, as `tools/list` describes it. */
	readonly tool: ToolDescriptor;
};

/** The variables a URI pattern captured, as `route-pattern` reports them. */
export type ResourceVariableValues = Record<string, string | undefined>;

/** The context a resource's read handler receives. */
export type ResourceContext<Variables = ResourceVariableValues> = AnyRequestContext & {
	/** The URI as the client asked for it. */
	readonly uri: string;
	/**
	 * What the URI pattern captured, named for RFC 6570's term to keep
	 * `RequestContext.params` reserved for the route's own params; installing captures
	 * there would shadow them, safe for now only because the MCP route's own param set stays empty.
	 */
	readonly variables: Variables;
	/** The resource being read. */
	readonly resource: ResourceDescriptor;
};

/** Context key holding a call's validated arguments, exposed as `ctx.input`. */
export const ToolInput = createContextKey<Record<string, unknown>>();

/** Context key holding the tool being called, exposed as `ctx.tool`. */
export const CurrentTool = createContextKey<ToolDescriptor>();

/** Context key holding the requested URI, exposed as `ctx.uri`. */
export const ResourceUri = createContextKey<string>();

/** Context key holding the captured URI variables, exposed as `ctx.variables`. */
export const ResourceVariables = createContextKey<ResourceVariableValues>();

/** Context key holding the resource being read, exposed as `ctx.resource`. */
export const CurrentResource = createContextKey<ResourceDescriptor>();

/** True when the value is already a request context; false for a bare request. */
export function isRequestContext(value: Request | AnyRequestContext): value is AnyRequestContext {
	return value instanceof RequestContext;
}

/** Builds a context for a host that has none of its own, such as a bare Worker export. */
export function contextFor(input: Request | AnyRequestContext): AnyRequestContext {
	return isRequestContext(input) ? input : new RequestContext(input);
}
