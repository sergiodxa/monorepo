/**
 * Where an MCP tool call reaches the real management route: the `SELF` service
 * binding, so a tool's forwarded request runs the same Worker's own routing and
 * controllers in-process rather than a second, parallel implementation of what
 * a management operation does. Overridable only for tests, the same way
 * `platform-tenant.ts` swaps the platform tenant's own Durable Object for one a
 * test constructs itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";

/** Sends a request through the same Worker's own `SELF` service binding. */
let resolveDispatch: () => (request: Request) => Promise<Response> = () => (request) =>
	env.SELF.fetch(request);

/**
 * Forwards a request built from an MCP tool call to the real management route,
 * exactly as `SELF.fetch` would from any other in-process caller.
 *
 * @param request - The request built from the tool call's own method, path and body.
 * @returns The management route's own response, unread and unmodified.
 */
export function dispatchManagementRequest(request: Request): Promise<Response> {
	return resolveDispatch()(request);
}

/**
 * Points every later {@link dispatchManagementRequest} call at a test's own
 * handler instead of the real `SELF` binding. Call once, in a test's own
 * setup, before an MCP tool call reaching this module runs.
 *
 * @param dispatch - The test's own stand-in for the real management route.
 */
export function useManagementDispatchForTesting(
	dispatch: (request: Request) => Promise<Response>,
): void {
	resolveDispatch = () => dispatch;
}
