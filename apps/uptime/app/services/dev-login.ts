/**
 * Decides whether the development login answers a request. It opens only when the Worker
 * runs with `DEV_LOGIN=true`, which only a local `.dev.vars` sets, and the request arrived on
 * a loopback host, so a deployed Worker answers its route with a 404 either way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";

/** Hosts a local `bun dev` serves on; `*.localhost` names resolve to loopback as well. */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Whether the request's host is the machine it runs on.
 *
 * @param url - The request's URL.
 */
function isLoopback(url: URL): boolean {
	return LOOPBACK_HOSTS.has(url.hostname) || url.hostname.endsWith(".localhost");
}

/**
 * Whether the development login answers this request: both the `DEV_LOGIN` flag and a
 * loopback host are required. The flag stays out of the generated `Env` type, since no
 * deployed configuration declares it.
 *
 * @param url - The request's URL.
 * @example if (!isDevLoginEnabled(ctx.url)) return notFound("Not Found");
 */
export function isDevLoginEnabled(url: URL): boolean {
	return Reflect.get(env, "DEV_LOGIN") === "true" && isLoopback(url);
}
