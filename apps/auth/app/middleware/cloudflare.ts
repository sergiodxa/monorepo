/**
 * Cloudflare context accessors for the auth app. Defines the router context
 * holding the Worker env, execution context, and request cf properties, and
 * exposes helpers to read the bindings and to schedule background work via
 * `waitUntil`, giving request handlers access to platform-level primitives.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createContext } from "react-router";

import { getContext } from "~/middleware/context-storage";

export const CloudflareContext = createContext<{
	env: Cloudflare.Env;
	ctx: ExecutionContext;
	cf?: RequestInitCfProperties;
}>();

export function bindings() {
	return getContext().get(CloudflareContext).env;
}

function getExecutionContext(): ExecutionContext {
	return getContext().get(CloudflareContext).ctx;
}

export function waitUntil<T>(promise: Promise<T>) {
	return getExecutionContext().waitUntil(promise);
}
