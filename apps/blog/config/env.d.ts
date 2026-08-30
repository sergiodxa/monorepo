/**
 * Ambient type declarations for the blog application environment. Augments the
 * global `App.Env` interface with the resolved secrets, flags, and KV-backed
 * bindings that request middleware injects into the router's request context.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { KVStore } from "../app/contracts/kv-store";

declare global {
	namespace App {
		interface Env {
			IS_PROD: boolean;
			CLIENT_ID: string;
			CLIENT_SECRET: string;
			COOKIE_SESSION_SECRET: string;
			AUTH: KVStore;
			REDIRECTS: KVStore;
			/**
			 * Typed as the raw platform binding because its only consumer,
			 * `@pkg/kv-cache`, needs the real namespace; `AUTH` and `REDIRECTS`
			 * keep the narrower `KVStore` contract for repositories and services.
			 */
			CACHE: KVNamespace;
			/** Present only once the deployment's bindings include a `ratelimits` entry. */
			MCP_RATE_LIMITER: RateLimit | undefined;
			/** Lets a deferred write finish after the response has been sent. */
			waitUntil(promise: Promise<unknown>): void;
		}
	}
}

export {};
