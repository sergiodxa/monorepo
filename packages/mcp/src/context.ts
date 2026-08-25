/**
 * The contexts a tool or resource handler receives, and the keys the dispatcher
 * publishes them through.
 *
 * Neither context is a new object. Each is the request's own `RequestContext` — the one
 * the surrounding remix middleware wrote to — with a couple of properties installed on it,
 * so `ctx.get(Database)` inside a tool reads exactly what the app's database middleware
 * provided and no second context system exists.
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
 * `RequestContext` is generic over both, and a context that has been through middleware is
 * a different type from a bare one. This package is mounted by applications whose chains it
 * cannot know, so it accepts any of them rather than naming one.
 *
 * `ContextEntries` rather than `any` for the entries: `any` matches both arms of the
 * conditional that resolves `ctx.get()`, which collapses every lookup to `{}`. The broad
 * list falls back to the key's own value type, so `ctx.get(Database)` still reads as
 * `Database | undefined`.
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
	 * What the URI pattern captured.
	 *
	 * Named for RFC 6570's term rather than "params", because `RequestContext.params`
	 * already holds the *route's* params — installing these there would shadow them, which
	 * is silent today only because the MCP route happens to have none.
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

/** Reports whether a value is a request context rather than a bare request. */
export function isRequestContext(value: Request | AnyRequestContext): value is AnyRequestContext {
	return value instanceof RequestContext;
}

/** Builds a context for a host that has none of its own, such as a bare Worker export. */
export function contextFor(input: Request | AnyRequestContext): AnyRequestContext {
	return isRequestContext(input) ? input : new RequestContext(input);
}
