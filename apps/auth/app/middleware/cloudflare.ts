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
