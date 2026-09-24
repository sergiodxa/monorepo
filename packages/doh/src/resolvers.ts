/**
 * The public resolvers that answer the DoH JSON API, ready to pass as `resolver`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DoH } from "./types.js";

/** Cloudflare's 1.1.1.1, the default resolver; it answers JSON when asked with `Accept: application/dns-json`. */
export const CLOUDFLARE: DoH.Resolver = {
	url: "https://cloudflare-dns.com/dns-query",
	format: "json",
};

/** Google Public DNS, which answers JSON at `/resolve` regardless of `Accept`. */
export const GOOGLE: DoH.Resolver = { url: "https://dns.google/resolve", format: "json" };
