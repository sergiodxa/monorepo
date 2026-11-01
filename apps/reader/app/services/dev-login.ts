/**
 * Whether the development sign-in exists for a request. It takes two answers at once: the
 * `DEV_LOGIN` switch only a local `.dev.vars` sets, and a request addressed to this machine,
 * so a deployed Worker answers the route as one it never mapped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";

/** The host names a request reaching this machine's own dev server is addressed to. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * True when the switch is on and `url` names this machine, which is the only pairing the
 * development sign-in answers under.
 *
 * @param url - The request's own URL.
 * @example if (!devLoginEnabled(ctx.url)) return defaultHandler(ctx);
 */
export function devLoginEnabled(url: URL): boolean {
	if (!("DEV_LOGIN" in env) || env.DEV_LOGIN !== "true") return false;
	return LOCAL_HOSTS.has(url.hostname) || url.hostname.endsWith(".localhost");
}
